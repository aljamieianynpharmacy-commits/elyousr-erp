require('dotenv').config(); // Load .env file
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';
const DEBUG_CUSTOMERS_QUERIES = process.env.DEBUG_CUSTOMERS_QUERIES === '1';
const ENABLE_PERF_LOGS = process.env.ENABLE_PERF_LOGS === '1';
const PERF_SLOW_QUERY_MS = Math.max(0, parseInt(process.env.PERF_SLOW_QUERY_MS || '250', 10) || 250);

const customerQueryLog = (...args) => {
    if (DEBUG_CUSTOMERS_QUERIES) {
        console.log(...args);
    }
};

const perfNow = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const startPerfTimer = (endpoint, params = {}) => {
    const startedAt = perfNow();
    return ({ rows = null, error = null } = {}) => {
        if (!ENABLE_PERF_LOGS) return;
        const durationMs = Number((perfNow() - startedAt).toFixed(2));
        if (!error && durationMs < PERF_SLOW_QUERY_MS) return;

        const payload = {
            endpoint,
            durationMs,
            rows,
            params
        };

        if (error) {
            console.warn('[PERF][ERROR]', payload, error?.message || error);
        } else {
            console.log('[PERF]', payload);
        }
    };
};

const parsePositiveInt = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toValidDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
};

const pickEarlierDate = (a, b) => {
    const da = toValidDate(a);
    const db = toValidDate(b);
    if (da && db) return da < db ? da : db;
    return da || db || null;
};

const computeCustomerPaymentStatus = (firstActivityDate, lastPaymentDate, overdueThreshold) => {
    const start = toValidDate(firstActivityDate);
    const lastPayment = toValidDate(lastPaymentDate);
    const referenceDate = lastPayment || start;
    if (!referenceDate) {
        return { lastPaymentDays: 0, isOverdue: false };
    }
    const diffTime = Math.max(0, Date.now() - referenceDate.getTime());
    const lastPaymentDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
        lastPaymentDays,
        isOverdue: lastPaymentDays > overdueThreshold
    };
};

const isCreditSaleType = (saleType) => {
    const normalized = String(saleType || '').trim().toLowerCase();
    return (
        normalized === '\u0622\u062c\u0644' || // آجل
        normalized === '\u0627\u062c\u0644' || // اجل
        normalized === 'ø¢ø¬ù„' || // legacy mojibake value seen in some environments
        normalized === 'credit' ||
        normalized === 'deferred'
    );
};

const computeSaleOutstandingAmount = ({ total, discount = 0, paid = 0, saleType }) => {
    const netTotal = Math.max(0, toNumber(total) - toNumber(discount));
    const paidAmount = Math.max(0, toNumber(paid));
    const remaining = Math.max(0, netTotal - paidAmount);

    if (remaining <= 0) return 0;
    if (isCreditSaleType(saleType)) return remaining;

    // Defensive fallback: if paid amount is missing/incorrect but there is remaining, keep receivable consistent.
    return remaining;
};

const parsePaymentDateInput = (value) => {
    if (!value) return new Date();

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parsed = new Date(`${value}T00:00:00Z`);
        return Number.isFinite(parsed.getTime()) ? parsed : new Date();
    }

    const parsed = toValidDate(value);
    return parsed || new Date();
};

const applyCustomerFinancialDelta = async (tx, {
    customerId,
    balanceDelta = 0,
    activityDate = null,
    paymentDate = null
} = {}) => {
    const parsedCustomerId = parsePositiveInt(customerId);
    if (!parsedCustomerId) return;

    const safeBalanceDelta = toNumber(balanceDelta, 0);
    const safeActivityDate = toValidDate(activityDate);
    const safePaymentDate = toValidDate(paymentDate);

    await tx.$executeRaw`
        UPDATE "Customer"
        SET
            "balance" = COALESCE("balance", 0) + ${safeBalanceDelta},
            "firstActivityDate" = CASE
                WHEN ${safeActivityDate} IS NULL THEN "firstActivityDate"
                WHEN "firstActivityDate" IS NULL OR "firstActivityDate" > ${safeActivityDate} THEN ${safeActivityDate}
                ELSE "firstActivityDate"
            END,
            "lastPaymentDate" = CASE
                WHEN ${safePaymentDate} IS NULL THEN "lastPaymentDate"
                WHEN "lastPaymentDate" IS NULL OR "lastPaymentDate" < ${safePaymentDate} THEN ${safePaymentDate}
                ELSE "lastPaymentDate"
            END,
            "financialsUpdatedAt" = NOW()
        WHERE "id" = ${parsedCustomerId}
    `;
};

const recalculateCustomerActivityDates = async (tx, customerId) => {
    const parsedCustomerId = parsePositiveInt(customerId);
    if (!parsedCustomerId) return null;

    const [saleAgg, paymentMinAgg, paymentMaxAgg] = await Promise.all([
        tx.sale.aggregate({
            where: { customerId: parsedCustomerId },
            _min: { invoiceDate: true }
        }),
        tx.customerPayment.aggregate({
            where: { customerId: parsedCustomerId },
            _min: { paymentDate: true }
        }),
        tx.customerPayment.aggregate({
            where: { customerId: parsedCustomerId },
            _max: { paymentDate: true }
        })
    ]);

    const firstActivityDate = pickEarlierDate(
        saleAgg?._min?.invoiceDate || null,
        paymentMinAgg?._min?.paymentDate || null,
    );
    const lastPaymentDate = paymentMaxAgg?._max?.paymentDate || null;

    await tx.customer.update({
        where: { id: parsedCustomerId },
        data: {
            firstActivityDate,
            lastPaymentDate,
            financialsUpdatedAt: new Date()
        }
    });

    return { firstActivityDate, lastPaymentDate };
};

const calculateCustomerFinancialSummaries = async (txOrClient, customerIds = []) => {

    const ids = [...new Set(
        customerIds
            .map((id) => parseInt(id, 10))
            .filter((id) => Number.isFinite(id) && id > 0),
    )];

    if (ids.length === 0) return new Map();

    const [balances, paymentStats, saleStats] = await Promise.all([
        txOrClient.customerTransaction.groupBy({
            by: ['customerId'],
            _sum: {
                debit: true,
                credit: true
            },
            where: {
                customerId: { in: ids }
            }
        }),
        txOrClient.customerPayment.groupBy({
            by: ['customerId'],
            _max: { paymentDate: true },
            _min: { paymentDate: true },
            where: { customerId: { in: ids } }
        }),
        txOrClient.sale.groupBy({
            by: ['customerId'],
            _min: { invoiceDate: true },
            where: { customerId: { in: ids } }
        })
    ]);

    const balanceMap = new Map();
    balances.forEach((entry) => {
        balanceMap.set(
            entry.customerId,
            (entry._sum.debit || 0) - (entry._sum.credit || 0),
        );
    });

    const paymentMap = new Map();
    paymentStats.forEach((entry) => {
        paymentMap.set(entry.customerId, {
            firstPaymentDate: entry._min.paymentDate || null,
            lastPaymentDate: entry._max.paymentDate || null
        });
    });

    const saleMap = new Map();
    saleStats.forEach((entry) => {
        saleMap.set(entry.customerId, entry._min.invoiceDate || null);
    });

    const financialsUpdatedAt = new Date();
    const updates = ids.map((customerId) => {
        const paymentInfo = paymentMap.get(customerId);
        const firstPaymentDate = paymentInfo?.firstPaymentDate || null;
        const firstSaleDate = saleMap.get(customerId) || null;
        const firstActivityDate = pickEarlierDate(firstSaleDate, firstPaymentDate);
        const lastPaymentDate = paymentInfo?.lastPaymentDate || null;

        return {
            customerId,
            balance: balanceMap.get(customerId) || 0,
            firstActivityDate,
            lastPaymentDate,
            financialsUpdatedAt
        };
    });

    const summaryMap = new Map();
    updates.forEach((summary) => {
        summaryMap.set(summary.customerId, summary);
    });
    return summaryMap;
};

const persistCustomerFinancialSummaries = async (txOrClient, summaryMap) => {
    const updates = [...summaryMap.values()];
    if (updates.length === 0) return 0;

    const updateBatchSize = 50;
    for (let i = 0; i < updates.length; i += updateBatchSize) {
        const batch = updates.slice(i, i + updateBatchSize);
        await Promise.all(
            batch.map((summary) => txOrClient.customer.update({
                where: { id: summary.customerId },
                data: {
                    balance: summary.balance,
                    firstActivityDate: summary.firstActivityDate,
                    lastPaymentDate: summary.lastPaymentDate,
                    financialsUpdatedAt: summary.financialsUpdatedAt
                }
            })),
        );
    }

    return updates.length;
};

const rebuildCustomerFinancialSummary = async (txOrClient, customerId) => {
    const summaryMap = await calculateCustomerFinancialSummaries(txOrClient, [customerId]);
    await persistCustomerFinancialSummaries(txOrClient, summaryMap);
    return summaryMap.get(parseInt(customerId, 10)) || null;
};

const dbService = {
    // ==================== AUTH ====================
    async login({ username, password }) {
        try {
            const user = await prisma.user.findUnique({
                where: { username }
            });

            if (!user) return { error: 'Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' };

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) return { error: 'ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± ØºÙŠØ± ØµØ­ÙŠØ­Ø©' };

            const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY);
            return { token, user: { id: user.id, name: user.name, role: user.role } };
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== DASHBOARD ====================
    async getDashboardStats() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const sales = await prisma.sale.findMany({
                where: { createdAt: { gte: today } }
            });

            const expenses = await prisma.expense.findMany({
                where: { createdAt: { gte: today } }
            });

            const productsCount = await prisma.product.count();

            const lowStockVariants = await prisma.variant.findMany({
                where: { quantity: { lte: 5 } },
                include: { product: true },
                take: 10
            });

            const salesAmount = sales.reduce((sum, sale) => sum + sale.total, 0);
            const expensesAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

            // Ø­Ø³Ø§Ø¨ Ø§Ù„Ø¯ÙŠÙˆÙ† Ù…Ù† CustomerTransaction
            const customerDebtResult = await prisma.customerTransaction.aggregate({
                _sum: {
                    debit: true,
                    credit: true
                }
            });

            const totalDebit = customerDebtResult._sum.debit || 0;
            const totalCredit = customerDebtResult._sum.credit || 0;
            const customersDebt = totalDebit - totalCredit;

            const suppliersDebt = await prisma.supplier.aggregate({
                _sum: { balance: true }
            });

            return {
                salesAmount,
                salesCount: sales.length,
                expensesAmount,
                productsCount,
                customersDebt: customersDebt || 0,
                suppliersDebt: suppliersDebt._sum.balance || 0,
                netProfit: salesAmount - expensesAmount,
                lowStockVariants: lowStockVariants.map(v => ({
                    id: v.id,
                    productName: v.product.name,
                    size: v.productSize,
                    color: v.color,
                    quantity: v.quantity,
                    price: v.price
                }))
            };
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== PRODUCTS ====================
    async getProducts({ page = 1, pageSize = 50, searchTerm = '', categoryId = null, sortCol = 'id', sortDir = 'desc' } = {}) {
        try {
            const skip = (page - 1) * pageSize;
            const where = {};

            if (categoryId) where.categoryId = parseInt(categoryId);

            if (searchTerm) {
                where.OR = [
                    { name: { contains: searchTerm } }, // Ø­Ø°ÙÙ†Ø§ mode: 'insensitive' Ù„Ø£Ù†Ù‡ ØºÙŠØ± Ù…Ø¯Ø¹ÙˆÙ… ÙÙŠ SQLite Ø¨Ø´ÙƒÙ„ Ø§ÙØªØ±Ø§Ø¶ÙŠØŒ Ø¥Ù„Ø§ Ø¥Ø°Ø§ ÙƒÙ†Øª ØªØ³ØªØ®Ø¯Ù… PostgreSQL
                    { sku: { contains: searchTerm } },
                    { description: { contains: searchTerm } }
                ];
                // Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ù„Ø¨Ø­Ø« Ø±Ù‚Ù…Ø§ØŒ Ø§Ø¨Ø­Ø« ÙÙŠ Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯
                if (!isNaN(searchTerm)) {
                    where.OR.push({ barcode: { contains: searchTerm } });
                }
            }

            // Ø§Ù„ØªØ£ÙƒØ¯ Ù…Ù† Ø£Ù† Ø­Ù‚Ù„ Ø§Ù„ØªØ±ØªÙŠØ¨ ØµØ§Ù„Ø­
            const validSortCols = ['id', 'name', 'price', 'cost', 'createdAt'];
            const orderBy = validSortCols.includes(sortCol) ? { [sortCol]: sortDir } : { id: 'desc' };

            const [products, total] = await Promise.all([
                prisma.product.findMany({
                    skip,
                    take: pageSize,
                    where,
                    orderBy,
                    include: {
                        variants: true,
                        category: true,
                        inventory: true
                    },
                }),
                prisma.product.count({ where })
            ]);

            return {
                data: products,
                total,
                page,
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            return { error: error.message };
        }
    },

    async addProduct(productData) {
        try {
            // ØªÙ†Ø¸ÙŠÙ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª
            const cleanData = {
                name: productData.name,
                description: productData.description || null,
                categoryId: productData.categoryId ? parseInt(productData.categoryId) : null,
                brand: productData.brand || null,
                basePrice: parseFloat(productData.basePrice || 0),
                cost: parseFloat(productData.cost || 0),
                image: productData.image || null,
                sku: productData.sku || null,
                barcode: productData.barcode || null,
                weight: productData.weight || null,
                dimensions: productData.dimensions || null
            };

            return await prisma.product.create({
                data: cleanData,
                include: { variants: true, category: true, inventory: true }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateProduct(id, productData) {
        try {
            // ØªÙ†Ø¸ÙŠÙ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª
            const cleanData = {};
            if (productData.name !== undefined) cleanData.name = productData.name;
            if (productData.description !== undefined) cleanData.description = productData.description || null;
            if (productData.categoryId !== undefined) cleanData.categoryId = productData.categoryId ? parseInt(productData.categoryId) : null;
            if (productData.brand !== undefined) cleanData.brand = productData.brand || null;
            if (productData.basePrice !== undefined) cleanData.basePrice = parseFloat(productData.basePrice);
            if (productData.cost !== undefined) cleanData.cost = parseFloat(productData.cost);
            if (productData.image !== undefined) cleanData.image = productData.image || null;
            if (productData.sku !== undefined) cleanData.sku = productData.sku || null;
            if (productData.barcode !== undefined) cleanData.barcode = productData.barcode || null;
            if (productData.weight !== undefined) cleanData.weight = productData.weight || null;
            if (productData.dimensions !== undefined) cleanData.dimensions = productData.dimensions || null;

            return await prisma.product.update({
                where: { id: parseInt(id) },
                data: cleanData,
                include: { variants: true, category: true, inventory: true }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteProduct(id) {
        try {
            return await prisma.product.delete({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async searchProducts(query) {
        try {
            return await prisma.product.findMany({
                where: {
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { barcode: { contains: query } },
                        { sku: { contains: query, mode: 'insensitive' } }
                    ]
                },
                include: { variants: true, category: true, inventory: true },
                take: 20
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== CATEGORIES ====================
    async getCategories() {
        try {
            return await prisma.category.findMany({
                orderBy: { name: 'asc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addCategory(categoryData) {
        try {
            return await prisma.category.create({
                data: categoryData
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateCategory(id, categoryData) {
        try {
            return await prisma.category.update({
                where: { id: parseInt(id) },
                data: categoryData
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteCategory(id) {
        try {
            return await prisma.category.delete({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== INVENTORY ====================
    async getInventory(productId) {
        try {
            return await prisma.inventory.findUnique({
                where: { productId: parseInt(productId) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateInventory(productId, inventoryData) {
        try {
            const existing = await prisma.inventory.findUnique({
                where: { productId: parseInt(productId) }
            });

            if (existing) {
                return await prisma.inventory.update({
                    where: { productId: parseInt(productId) },
                    data: inventoryData
                });
            } else {
                return await prisma.inventory.create({
                    data: {
                        productId: parseInt(productId),
                        ...inventoryData
                    }
                });
            }
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== VARIANTS ====================
    async getVariants() {
        try {
            return await prisma.variant.findMany({
                include: { product: true },
                orderBy: { id: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async searchVariants(query) {
        try {
            return await prisma.variant.findMany({
                where: {
                    OR: [
                        { barcode: { contains: query } },
                        { product: { name: { contains: query, mode: 'insensitive' } } },
                        { product: { barcode: { contains: query } } }
                    ]
                },
                include: { product: true },
                take: 20
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addVariant(variantData) {
        try {
            return await prisma.variant.create({
                data: {
                    productId: parseInt(variantData.productId),
                    productSize: variantData.size,
                    color: variantData.color,
                    price: parseFloat(variantData.price),
                    cost: parseFloat(variantData.cost),
                    quantity: parseInt(variantData.quantity),
                    barcode: variantData.barcode || null
                },
                include: { product: true }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateVariant(id, variantData) {
        try {
            const updateData = {};
            if (variantData.size) updateData.productSize = variantData.size;
            if (variantData.color) updateData.color = variantData.color;
            if (variantData.price) updateData.price = parseFloat(variantData.price);
            if (variantData.cost) updateData.cost = parseFloat(variantData.cost);
            if (variantData.quantity !== undefined) updateData.quantity = parseInt(variantData.quantity);
            if (variantData.barcode !== undefined) updateData.barcode = variantData.barcode || null;

            return await prisma.variant.update({
                where: { id: parseInt(id) },
                data: updateData,
                include: { product: true }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== SALES ====================
    async getSales() {
        try {
            return await prisma.sale.findMany({
                include: {
                    customer: true,
                    items: {
                        include: {
                            variant: {
                                include: { product: true }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async createSale(saleData) {
        const perf = startPerfTimer('db:createSale', {
            hasCustomer: Boolean(saleData?.customerId),
            saleType: saleData?.saleType || null,
            itemCount: Array.isArray(saleData?.items) ? saleData.items.length : 0
        });

        try {
            const result = await prisma.$transaction(async (tx) => {
                const parsedCustomerId = parsePositiveInt(saleData.customerId);

                const newSale = await tx.sale.create({
                    data: {
                        customer: parsedCustomerId ? {
                            connect: { id: parsedCustomerId }
                        } : undefined,
                        total: parseFloat(saleData.total),
                        discount: parseFloat(saleData.discount || 0),
                        saleType: saleData.saleType || '\u0646\u0642\u062f\u064a',
                        notes: saleData.notes || null,
                        invoiceDate: saleData.invoiceDate
                            ? new Date(saleData.invoiceDate)
                            : undefined
                    }
                });

                // Ø¥Ù†Ø´Ø§Ø¡ Ø¨Ù†ÙˆØ¯ Ø§Ù„ÙØ§ØªÙˆØ±Ø© ÙˆØªØ­Ø¯ÙŠØ« Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
                for (let i = 0; i < saleData.items.length; i++) {
                    const item = saleData.items[i];

                    await tx.saleItem.create({
                        data: {
                            id: i + 1,
                            saleId: newSale.id,
                            variantId: parseInt(item.variantId),
                            quantity: parseInt(item.quantity),
                            price: parseFloat(item.price),
                            discount: parseFloat(item.discount || 0)
                        }
                    });

                    await tx.variant.update({
                        where: { id: parseInt(item.variantId) },
                        data: { quantity: { decrement: parseInt(item.quantity) } }
                    });
                }

                const outstandingAmount = computeSaleOutstandingAmount({
                    total: saleData.total,
                    discount: saleData.discount || 0,
                    paid: saleData.paid || 0,
                    saleType: saleData.saleType
                });

                // Ø¥Ù†Ø´Ø§Ø¡ Ø³Ø¬Ù„ Ø¯ÙŠÙ† ÙÙ‚Ø· Ù„Ùˆ ÙÙŠÙ‡ Ù…ØªØ¨Ù‚ÙŠ ÙØ¹Ù„ÙŠ
                if (parsedCustomerId) {
                    if (outstandingAmount > 0) {
                        await tx.customerTransaction.create({
                            data: {
                                customer: {
                                    connect: { id: parsedCustomerId }
                                },
                                date: newSale.invoiceDate || new Date(),
                                type: 'SALE',
                                referenceType: 'SALE',
                                referenceId: newSale.id,
                                debit: outstandingAmount,
                                credit: 0,
                                notes: `ÙØ§ØªÙˆØ±Ø© #${newSale.id} - ${saleData.notes || 'Ø¨ÙŠØ¹'}`
                            }
                        });
                    }

                    await applyCustomerFinancialDelta(tx, {
                        customerId: parsedCustomerId,
                        balanceDelta: outstandingAmount,
                        activityDate: newSale.invoiceDate || new Date()
                    });
                }

                if (parsedCustomerId) {
                    const customer = await tx.customer.findUnique({
                        where: { id: parsedCustomerId },
                        include: {
                            sales: true,
                            payments: true
                        }
                    });

                    if (customer) {
                        // Ø­Ø³Ø§Ø¨ Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª
                        const totalPurchases = customer.sales.reduce((sum, sale) => sum + sale.total, 0);

                        // Ø­Ø³Ø§Ø¨ Ø§Ù„ØªÙ‚ÙŠÙŠÙ… Ø§Ù„Ø°ÙƒÙŠ (0-5 Ù†Ø¬ÙˆÙ…)
                        let rating = 0;

                        // Ù…Ø¹Ø§ÙŠÙŠØ± Ø§Ù„ØªÙ‚ÙŠÙŠÙ…:
                        // 1. Ø­Ø¬Ù… Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª (40%)
                        if (totalPurchases >= 50000) rating += 2;
                        else if (totalPurchases >= 20000) rating += 1.5;
                        else if (totalPurchases >= 10000) rating += 1;
                        else if (totalPurchases >= 5000) rating += 0.5;

                        // 2. Ø¹Ø¯Ø¯ Ø§Ù„Ù…Ø¹Ø§Ù…Ù„Ø§Øª (20%)
                        const salesCount = customer.sales.length;
                        if (salesCount >= 50) rating += 1;
                        else if (salesCount >= 20) rating += 0.7;
                        else if (salesCount >= 10) rating += 0.5;
                        else if (salesCount >= 5) rating += 0.3;

                        // 3. Ø§Ù†ØªØ¸Ø§Ù… Ø§Ù„Ø³Ø¯Ø§Ø¯ (40%) - Ù…Ù† Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…Ù„Ø®Øµ
                        const currentBalance = customer.balance || 0;
                        const debtRatio = currentBalance / Math.max(totalPurchases, 1);

                        if (debtRatio < 0.1 && salesCount >= 5) rating += 2;
                        else if (debtRatio < 0.2 && salesCount >= 3) rating += 1.5;
                        else if (debtRatio < 0.3) rating += 1;
                        else if (debtRatio < 0.5) rating += 0.5;

                        rating = Math.min(5, rating); // Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰ 5 Ù†Ø¬ÙˆÙ…

                        // ØªØµÙ†ÙŠÙ ØªÙ„Ù‚Ø§Ø¦ÙŠ Ù„Ù„Ø¹Ù…ÙŠÙ„
                        let customerType = 'Ø¹Ø§Ø¯ÙŠ';
                        if (totalPurchases >= 50000 && rating >= 4) {
                            customerType = 'VIP';
                        } else if (totalPurchases >= 30000 && salesCount >= 10) {
                            customerType = 'ØªØ§Ø¬Ø± Ø¬Ù…Ù„Ø©';
                        } else if (totalPurchases >= 20000 || rating >= 3.5) {
                            customerType = 'VIP';
                        }

                        // ØªØ­Ø¯ÙŠØ« Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¹Ù…ÙŠÙ„ (rating Ùˆ customerType ÙÙ‚Ø·)
                        await tx.customer.update({
                            where: { id: parsedCustomerId },
                            data: {
                                rating,
                                customerType
                            }
                        });
                    }
                }

                return newSale;
            });

            perf({ rows: 1 });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async getSaleDetails(saleId) {
        try {
            return await prisma.sale.findUnique({
                where: { id: parseInt(saleId) },
                include: {
                    customer: true,
                    items: {
                        include: {
                            variant: {
                                include: {
                                    product: true
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteSale(saleId) {
        const perf = startPerfTimer('db:deleteSale', {
            saleId: parseInt(saleId, 10) || null
        });

        try {
            const result = await prisma.$transaction(async (tx) => {
                // Ø§Ù„Ø­ØµÙˆÙ„ Ø¹Ù„Ù‰ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ÙØ§ØªÙˆØ±Ø©
                const sale = await tx.sale.findUnique({
                    where: { id: parseInt(saleId) },
                    include: {
                        items: true,
                        customer: true
                    }
                });

                if (!sale) {
                    return { error: 'Sale not found' };
                }

                const saleTransactions = await tx.customerTransaction.findMany({
                    where: {
                        referenceType: 'SALE',
                        referenceId: parseInt(saleId)
                    },
                    select: {
                        debit: true,
                        credit: true
                    }
                });
                const previousSaleDelta = saleTransactions.reduce((sum, trx) => (
                    sum + (toNumber(trx.debit) - toNumber(trx.credit))
                ), 0);

                // Ø§Ø³ØªØ±Ø¬Ø§Ø¹ Ø§Ù„ÙƒÙ…ÙŠØ§Øª Ù„Ù„Ù…Ù†ØªØ¬Ø§Øª
                for (const item of sale.items) {
                    await tx.variant.update({
                        where: { id: item.variantId },
                        data: { quantity: { increment: item.quantity } }
                    });
                }

                await tx.customerTransaction.deleteMany({
                    where: {
                        referenceType: 'SALE',
                        referenceId: parseInt(saleId)
                    }
                });

                // Ø­Ø°Ù Ø¨Ù†ÙˆØ¯ Ø§Ù„ÙØ§ØªÙˆØ±Ø©
                await tx.saleItem.deleteMany({
                    where: { saleId: parseInt(saleId) }
                });

                // Ø­Ø°Ù Ø§Ù„ÙØ§ØªÙˆØ±Ø©
                const deletedSale = await tx.sale.delete({
                    where: { id: parseInt(saleId) }
                });

                if (sale.customerId) {
                    if (previousSaleDelta !== 0) {
                        await applyCustomerFinancialDelta(tx, {
                            customerId: sale.customerId,
                            balanceDelta: -previousSaleDelta
                        });
                    }
                    await recalculateCustomerActivityDates(tx, sale.customerId);
                }

                return { success: true, data: deletedSale };
            });

            perf({ rows: result?.success ? 1 : 0 });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async updateSale(saleId, saleData) {
        const perf = startPerfTimer('db:updateSale', {
            saleId: parseInt(saleId, 10) || null,
            hasCustomer: Object.prototype.hasOwnProperty.call(saleData || {}, 'customerId'),
            itemCount: Array.isArray(saleData?.items) ? saleData.items.length : 0
        });

        try {
            const result = await prisma.$transaction(async (tx) => {
                // الحصول على الفاتورة الحالية
                const currentSale = await tx.sale.findUnique({
                    where: { id: parseInt(saleId) },
                    include: {
                        items: true,
                        customer: true
                    }
                });

                if (!currentSale) {
                    return { error: 'Sale not found' };
                }

                const newCustomerId = Object.prototype.hasOwnProperty.call(saleData, 'customerId')
                    ? parsePositiveInt(saleData.customerId)
                    : currentSale.customerId;

                const oldSaleTransactions = await tx.customerTransaction.findMany({
                    where: {
                        referenceType: 'SALE',
                        referenceId: parseInt(saleId)
                    },
                    select: {
                        debit: true,
                        credit: true
                    }
                });
                const oldOutstanding = oldSaleTransactions.reduce((sum, trx) => (
                    sum + (toNumber(trx.debit) - toNumber(trx.credit))
                ), 0);

                // استرجاع الكميات القديمة
                for (const item of currentSale.items) {
                    await tx.variant.update({
                        where: { id: item.variantId },
                        data: { quantity: { increment: item.quantity } }
                    });
                }

                await tx.customerTransaction.deleteMany({
                    where: {
                        referenceType: 'SALE',
                        referenceId: parseInt(saleId)
                    }
                });

                // حذف البنود القديمة
                await tx.saleItem.deleteMany({
                    where: { saleId: parseInt(saleId) }
                });

                // إنشاء البنود الجديدة
                if (saleData.items && saleData.items.length > 0) {
                    for (let i = 0; i < saleData.items.length; i++) {
                        const item = saleData.items[i];

                        await tx.saleItem.create({
                            data: {
                                id: i + 1,
                                saleId: parseInt(saleId),
                                variantId: parseInt(item.variantId),
                                quantity: parseInt(item.quantity),
                                price: parseFloat(item.price),
                                discount: parseFloat(item.discount || 0)
                            }
                        });

                        await tx.variant.update({
                            where: { id: parseInt(item.variantId) },
                            data: { quantity: { decrement: parseInt(item.quantity) } }
                        });
                    }
                }

                // تحديث بيانات الفاتورة
                const updatedSale = await tx.sale.update({
                    where: { id: parseInt(saleId) },
                    data: {
                        customer: Object.prototype.hasOwnProperty.call(saleData, 'customerId')
                            ? (newCustomerId
                                ? { connect: { id: newCustomerId } }
                                : { disconnect: true })
                            : undefined,
                        total: parseFloat(saleData.total),
                        discount: parseFloat(saleData.discount || 0),
                        saleType: saleData.saleType || 'نقدي',
                        notes: saleData.notes || null,
                        invoiceDate: saleData.invoiceDate
                            ? new Date(saleData.invoiceDate)
                            : undefined
                    },
                    include: {
                        customer: true,
                        items: true
                    }
                });

                const newOutstanding = computeSaleOutstandingAmount({
                    total: saleData.total,
                    discount: saleData.discount || 0,
                    paid: saleData.paid || 0,
                    saleType: saleData.saleType
                });

                // إنشاء سجل CustomerTransaction الجديد
                if (newCustomerId && newOutstanding > 0) {
                    await tx.customerTransaction.create({
                        data: {
                            customer: {
                                connect: { id: newCustomerId }
                            },
                            date: updatedSale.invoiceDate || new Date(),
                            type: 'SALE',
                            referenceType: 'SALE',
                            referenceId: updatedSale.id,
                            debit: newOutstanding,
                            credit: 0,
                            notes: `فاتورة معدلة #${updatedSale.id} - ${saleData.notes || 'بيع'}`
                        }
                    });
                }

                if (currentSale.customerId && currentSale.customerId === newCustomerId) {
                    const delta = newOutstanding - oldOutstanding;
                    await applyCustomerFinancialDelta(tx, {
                        customerId: newCustomerId,
                        balanceDelta: delta,
                        activityDate: updatedSale.invoiceDate || new Date()
                    });
                    await recalculateCustomerActivityDates(tx, newCustomerId);
                } else {
                    if (currentSale.customerId) {
                        if (oldOutstanding !== 0) {
                            await applyCustomerFinancialDelta(tx, {
                                customerId: currentSale.customerId,
                                balanceDelta: -oldOutstanding
                            });
                        }
                        await recalculateCustomerActivityDates(tx, currentSale.customerId);
                    }

                    if (newCustomerId) {
                        await applyCustomerFinancialDelta(tx, {
                            customerId: newCustomerId,
                            balanceDelta: newOutstanding,
                            activityDate: updatedSale.invoiceDate || new Date()
                        });
                    }
                }

                return { success: true, data: updatedSale };
            });

            perf({ rows: result?.success ? 1 : 0 });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    // ==================== PURCHASES (فواتير المشتريات) ====================
    async getPurchases() {
        try {
            return await prisma.purchase.findMany({
                include: {
                    supplier: true,
                    items: {
                        include: {
                            variant: {
                                include: { product: true }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async createPurchase(purchaseData) {
        try {
            return await prisma.$transaction(async (tx) => {
                const newPurchase = await tx.purchase.create({
                    data: {
                        supplierId: purchaseData.supplierId ? parseInt(purchaseData.supplierId) : null,
                        total: parseFloat(purchaseData.total),
                        paid: parseFloat(purchaseData.paid || 0),
                        notes: purchaseData.notes || null
                    }
                });

                for (let i = 0; i < purchaseData.items.length; i++) {
                    const item = purchaseData.items[i];

                    await tx.purchaseItem.create({
                        data: {
                            id: i + 1,
                            purchaseId: newPurchase.id,
                            variantId: parseInt(item.variantId),
                            quantity: parseInt(item.quantity),
                            cost: parseFloat(item.cost)
                        }
                    });

                    // Ø²ÙŠØ§Ø¯Ø© Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
                    await tx.variant.update({
                        where: { id: parseInt(item.variantId) },
                        data: {
                            quantity: { increment: parseInt(item.quantity) },
                            cost: parseFloat(item.cost) // ØªØ­Ø¯ÙŠØ« Ø³Ø¹Ø± Ø§Ù„ØªÙƒÙ„ÙØ©
                        }
                    });
                }

                // ØªØ­Ø¯ÙŠØ« Ø±ØµÙŠØ¯ Ø§Ù„Ù…ÙˆØ±Ø¯
                if (purchaseData.supplierId) {
                    const remaining = parseFloat(purchaseData.total) - parseFloat(purchaseData.paid || 0);
                    await tx.supplier.update({
                        where: { id: parseInt(purchaseData.supplierId) },
                        data: { balance: { decrement: remaining } }
                    });
                }

                return newPurchase;
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== RETURNS (Ø§Ù„Ù…Ø±ØªØ¬Ø¹Ø§Øª) ====================
    async getReturns() {
        try {
            return await prisma.return.findMany({
                include: {
                    sale: true,
                    customer: true,
                    items: {
                        include: {
                            variant: {
                                include: { product: true }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async createReturn(returnData) {
        const perf = startPerfTimer('db:createReturn', {
            hasCustomer: Boolean(returnData?.customerId),
            itemCount: Array.isArray(returnData?.items) ? returnData.items.length : 0
        });

        try {
            const result = await prisma.$transaction(async (tx) => {
                const newReturn = await tx.return.create({
                    data: {
                        saleId: returnData.saleId ? parseInt(returnData.saleId) : null,
                        customerId: returnData.customerId ? parseInt(returnData.customerId) : null,
                        total: parseFloat(returnData.total),
                        notes: returnData.notes || null
                    }
                });

                for (let i = 0; i < returnData.items.length; i++) {
                    const item = returnData.items[i];

                    await tx.returnItem.create({
                        data: {
                            id: i + 1,
                            returnId: newReturn.id,
                            variantId: parseInt(item.variantId),
                            quantity: parseInt(item.quantity),
                            price: parseFloat(item.price)
                        }
                    });

                    // إرجاع الكمية للمخزون
                    await tx.variant.update({
                        where: { id: parseInt(item.variantId) },
                        data: { quantity: { increment: parseInt(item.quantity) } }
                    });
                }

                // إنشاء سجل مرتجعات في CustomerTransaction
                if (returnData.customerId) {
                    const parsedCustomerId = parseInt(returnData.customerId);
                    const returnAmount = Math.max(0, toNumber(returnData.total));
                    const returnDate = new Date();

                    await tx.customerTransaction.create({
                        data: {
                            customer: {
                                connect: { id: parsedCustomerId }
                            },
                            date: returnDate,
                            type: 'RETURN',
                            referenceType: 'RETURN',
                            referenceId: newReturn.id,
                            debit: 0,
                            credit: returnAmount,
                            notes: `مرتجع #${newReturn.id} - ${returnData.notes || 'مرتجع'}`
                        }
                    });

                    await applyCustomerFinancialDelta(tx, {
                        customerId: parsedCustomerId,
                        balanceDelta: -returnAmount,
                        activityDate: returnDate
                    });
                }

                return newReturn;
            });

            perf({ rows: 1 });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    // ==================== CUSTOMERS ====================
    async getCustomerBalance(customerId) {
        try {
            const parsedCustomerId = parseInt(customerId);
            const customer = await prisma.customer.findUnique({
                where: { id: parsedCustomerId },
                select: {
                    id: true,
                    balance: true
                }
            });

            if (!customer) return 0;

            return customer.balance || 0;
        } catch (error) {
            return { error: error.message };
        }
    },

    async getCustomerStatement(customerId, fromDate, toDate) {
        try {
            const whereClause = { customer: { id: parseInt(customerId) } };

            if (fromDate || toDate) {
                whereClause.date = {};
                if (fromDate) whereClause.date.gte = new Date(fromDate);
                if (toDate) whereClause.date.lte = new Date(toDate);
            }

            const transactions = await prisma.customerTransaction.findMany({
                where: whereClause,
                orderBy: { date: 'asc' },
                include: {
                    customer: {
                        select: { name: true, phone: true }
                    }
                }
            });

            // Calculate running balance
            let runningBalance = 0;
            const statement = transactions.map(t => {
                runningBalance += t.debit - t.credit;
                return {
                    ...t,
                    runningBalance
                };
            });

            return statement;
        } catch (error) {
            return { error: error.message };
        }
    },

    async getCustomerTransactions(customerId) {
        try {
            return await prisma.customerTransaction.findMany({
                where: { customer: { id: parseInt(customerId) } },
                orderBy: { date: 'desc' },
                take: 50
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async getCustomers({
        page = 1,
        pageSize = 1000,
        searchTerm = '',
        customerType = null,
        city = '',
        sortCol = 'createdAt',
        sortDir = 'desc',
        overdueThreshold = 30
    } = {}) {
        const perf = startPerfTimer('db:getCustomers', {
            page,
            pageSize,
            searchLength: String(searchTerm || '').trim().length,
            customerType: customerType || 'all',
            cityLength: String(city || '').trim().length,
            sortCol,
            sortDir
        });

        try {
            const safePage = Math.max(1, parseInt(page, 10) || 1);
            const safePageSize = Math.min(2000, Math.max(1, parseInt(pageSize, 10) || 1000));
            const safeSortDir = String(sortDir).toLowerCase() === 'asc' ? 'asc' : 'desc';
            const skip = (safePage - 1) * safePageSize;

            const where = {};
            const normalizedSearch = String(searchTerm || '').trim();
            const normalizedCity = String(city || '').trim();

            if (normalizedSearch.length > 0) {
                where.OR = [
                    { name: { startsWith: normalizedSearch, mode: 'insensitive' } },
                    { phone: { startsWith: normalizedSearch } }
                ];
            }

            if (customerType && customerType !== 'all') {
                where.customerType = customerType;
            }

            if (normalizedCity.length > 0) {
                where.city = { startsWith: normalizedCity, mode: 'insensitive' };
            }

            const sortable = new Set(['balance', 'lastPaymentDate', 'createdAt', 'name', 'id']);
            const safeSortCol = sortable.has(sortCol) ? sortCol : 'createdAt';
            const orderBy = safeSortCol === 'lastPaymentDate'
                ? [{ lastPaymentDate: safeSortDir }, { id: 'desc' }]
                : { [safeSortCol]: safeSortDir };

            const [customers, total] = await Promise.all([
                prisma.customer.findMany({
                    skip,
                    take: safePageSize,
                    where,
                    orderBy,
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        phone2: true,
                        address: true,
                        city: true,
                        district: true,
                        notes: true,
                        creditLimit: true,
                        customerType: true,
                        rating: true,
                        balance: true,
                        firstActivityDate: true,
                        lastPaymentDate: true,
                        createdAt: true
                    }
                }),
                prisma.customer.count({ where })
            ]);

            const data = customers.map((customer) => {
                const status = computeCustomerPaymentStatus(
                    customer.firstActivityDate,
                    customer.lastPaymentDate,
                    overdueThreshold,
                );

                return {
                    ...customer,
                    balance: customer.balance || 0,
                    lastPaymentDays: status.lastPaymentDays,
                    isOverdue: status.isOverdue
                };
            });

            perf({ rows: data.length });

            return {
                data,
                total,
                page: safePage,
                totalPages: Math.max(1, Math.ceil(total / safePageSize))
            };
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async getCustomer(id) {
        try {
            const parsedCustomerId = parseInt(id);
            const customer = await prisma.customer.findUnique({
                where: { id: parsedCustomerId }
            });

            if (!customer) return { error: 'العميل غير موجود' };

            const status = computeCustomerPaymentStatus(
                customer.firstActivityDate,
                customer.lastPaymentDate,
                30,
            );

            return {
                ...customer,
                balance: customer.balance ?? 0,
                lastPaymentDays: status.lastPaymentDays,
                isOverdue: status.isOverdue
            };
        } catch (error) {
            return { error: error.message };
        }
    },

    async getCustomerSales(customerId) {
        try {
            return await prisma.sale.findMany({
                where: { customerId: parseInt(customerId) },
                include: {
                    items: {
                        include: {
                            variant: { include: { product: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async getCustomerReturns(customerId) {
        try {
            return await prisma.return.findMany({
                where: { customerId: parseInt(customerId) },
                include: {
                    items: {
                        include: {
                            variant: { include: { product: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addCustomer(customerData) {
        try {
            return await prisma.customer.create({
                data: {
                    name: customerData.name,
                    phone: customerData.phone || null,
                    phone2: customerData.phone2 || null,
                    address: customerData.address || null,
                    city: customerData.city || null,
                    district: customerData.district || null,
                    notes: customerData.notes || null,
                    creditLimit: parseFloat(customerData.creditLimit || 0),
                    balance: 0,
                    firstActivityDate: null,
                    lastPaymentDate: null,
                    financialsUpdatedAt: new Date(),
                    customerType: customerData.customerType || 'عادي'
                }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateCustomer(id, customerData) {
        try {
            return await prisma.customer.update({
                where: { id: parseInt(id) },
                data: {
                    name: customerData.name,
                    phone: customerData.phone || null,
                    phone2: customerData.phone2 || null,
                    address: customerData.address || null,
                    city: customerData.city || null,
                    district: customerData.district || null,
                    notes: customerData.notes || null,
                    creditLimit: customerData.creditLimit !== undefined ? parseFloat(customerData.creditLimit) : undefined,
                    customerType: customerData.customerType || undefined
                }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteCustomer(id) {
        try {
            return await prisma.customer.delete({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addCustomerPayment(paymentData) {
        const perf = startPerfTimer('db:addCustomerPayment', {
            hasPaymentDate: Boolean(paymentData?.paymentDate)
        });

        try {
            const customerId = parsePositiveInt(paymentData.customerId);
            if (!customerId) {
                return { error: 'Invalid customerId' };
            }

            const paymentAmount = Math.max(0, toNumber(paymentData.amount));
            if (paymentAmount <= 0) {
                return { error: 'Invalid payment amount' };
            }

            const paymentDate = parsePaymentDateInput(paymentData.paymentDate);

            const result = await prisma.$transaction(async (tx) => {
                const payment = await tx.customerPayment.create({
                    data: {
                        customer: {
                            connect: { id: customerId }
                        },
                        paymentMethod: {
                            connect: { id: parseInt(paymentData.paymentMethodId) || 1 }
                        },
                        amount: paymentAmount,
                        notes: paymentData.notes || null,
                        paymentDate
                    }
                });

                await tx.customerTransaction.create({
                    data: {
                        customer: {
                            connect: { id: customerId }
                        },
                        date: paymentDate,
                        type: 'PAYMENT',
                        referenceType: 'PAYMENT',
                        referenceId: payment.id,
                        debit: 0,
                        credit: paymentAmount,
                        notes: `دفعة #${payment.id} - ${paymentData.notes || 'دفعة نقدية'}`
                    }
                });

                await applyCustomerFinancialDelta(tx, {
                    customerId,
                    balanceDelta: -paymentAmount,
                    activityDate: paymentDate,
                    paymentDate
                });

                return payment;
            });

            perf({ rows: 1 });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async getCustomerPayments(customerId) {
        try {
            return await prisma.customerPayment.findMany({
                where: { customerId: parseInt(customerId) },
                include: { paymentMethod: true },
                orderBy: { paymentDate: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteCustomerPayment(paymentId) {
        const perf = startPerfTimer('db:deleteCustomerPayment', {
            paymentId: parseInt(paymentId, 10) || null
        });

        try {
            return await prisma.$transaction(async (tx) => {
                const payment = await tx.customerPayment.findUnique({
                    where: { id: parseInt(paymentId) },
                    select: {
                        id: true,
                        customerId: true,
                        amount: true,
                        paymentDate: true
                    }
                });

                if (!payment) {
                    return { error: 'Payment not found' };
                }

                await tx.customerTransaction.deleteMany({
                    where: {
                        customerId: payment.customerId,
                        referenceType: 'PAYMENT',
                        referenceId: parseInt(paymentId)
                    }
                });

                const deletedPayment = await tx.customerPayment.delete({
                    where: { id: parseInt(paymentId) }
                });

                await applyCustomerFinancialDelta(tx, {
                    customerId: payment.customerId,
                    balanceDelta: Math.max(0, toNumber(payment.amount))
                });

                await recalculateCustomerActivityDates(tx, payment.customerId);

                perf({ rows: 1 });
                return { success: true, data: deletedPayment };
            });
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async rebuildCustomerFinancials(customerId) {
        const parsedCustomerId = parsePositiveInt(customerId);
        if (!parsedCustomerId) {
            return { error: 'Invalid customerId' };
        }

        const perf = startPerfTimer('db:rebuildCustomerFinancials', {
            customerId: parsedCustomerId
        });

        try {
            const result = await prisma.$transaction(async (tx) => {
                const customer = await tx.customer.findUnique({
                    where: { id: parsedCustomerId },
                    select: { id: true }
                });

                if (!customer) {
                    return { error: 'Customer not found' };
                }

                const summary = await rebuildCustomerFinancialSummary(tx, parsedCustomerId);
                return { success: true, data: summary };
            });

            perf({ rows: result?.success ? 1 : 0 });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async rebuildAllCustomersFinancials({ batchSize = 200, startAfterId = 0 } = {}) {
        const safeBatchSize = Math.min(1000, Math.max(10, parseInt(batchSize, 10) || 200));
        let cursorId = Math.max(0, parseInt(startAfterId, 10) || 0);

        const perf = startPerfTimer('db:rebuildAllCustomersFinancials', {
            batchSize: safeBatchSize,
            startAfterId: cursorId
        });

        try {
            let processed = 0;
            let updated = 0;
            let batches = 0;

            while (true) {
                const batchCustomers = await prisma.customer.findMany({
                    where: { id: { gt: cursorId } },
                    orderBy: { id: 'asc' },
                    take: safeBatchSize,
                    select: { id: true }
                });

                if (batchCustomers.length === 0) break;

                const batchIds = batchCustomers.map((customer) => customer.id);

                const updatedInBatch = await prisma.$transaction(async (tx) => {
                    const summaryMap = await calculateCustomerFinancialSummaries(tx, batchIds);
                    return persistCustomerFinancialSummaries(tx, summaryMap);
                });

                processed += batchIds.length;
                updated += updatedInBatch;
                batches += 1;
                cursorId = batchIds[batchIds.length - 1];

                console.log(`[REBUILD][CUSTOMERS] batch=${batches} processed=${processed} updated=${updated} cursor=${cursorId}`);
            }

            const result = {
                success: true,
                processed,
                updated,
                batches,
                batchSize: safeBatchSize
            };

            perf({ rows: processed });
            return result;
        } catch (error) {
            perf({ error });
            return { error: error.message };
        }
    },

    async checkCustomerFinancialsHealth() {
        try {
            await prisma.customer.findFirst({
                select: {
                    id: true,
                    balance: true,
                    firstActivityDate: true,
                    lastPaymentDate: true,
                    financialsUpdatedAt: true
                }
            });

            return { ok: true };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    },

    // ==================== PAYMENT METHODS ====================
    async getPaymentMethods() {
        try {
            const methods = await prisma.paymentMethod.findMany({
                where: { isActive: true },
                orderBy: { createdAt: 'asc' }
            });

            console.log('ðŸ“‹ Ø·Ø±Ù‚ Ø§Ù„Ø¯ÙØ¹:', methods);
            return methods;
        } catch (error) {
            console.error('âŒ Ø®Ø·Ø£ ÙÙŠ Ø¬Ù„Ø¨ Ø·Ø±Ù‚ Ø§Ù„Ø¯ÙØ¹:', error);
            return [];
        }
    },

    async getPaymentMethodStats() {
        try {
            const stats = await prisma.paymentMethod.findMany({
                where: { isActive: true },
                include: {
                    payments: {
                        select: { amount: true }
                    }
                }
            });

            return stats.map(method => ({
                ...method,
                totalAmount: method.payments.reduce((sum, p) => sum + p.amount, 0),
                count: method.payments.length
            }));
        } catch (error) {
            console.error('âŒ Ø®Ø·Ø£ ÙÙŠ Ø¬Ù„Ø¨ Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª Ø·Ø±Ù‚ Ø§Ù„Ø¯ÙØ¹:', error);
            return [];
        }
    },

    // ==================== SUPPLIERS ====================
    async getSuppliers() {
        try {
            return await prisma.supplier.findMany({
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addSupplier(supplierData) {
        try {
            return await prisma.supplier.create({
                data: {
                    name: supplierData.name,
                    phone: supplierData.phone || null,
                    address: supplierData.address || null,
                    balance: parseFloat(supplierData.balance || 0)
                }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateSupplier(id, supplierData) {
        try {
            return await prisma.supplier.update({
                where: { id: parseInt(id) },
                data: {
                    name: supplierData.name,
                    phone: supplierData.phone || null,
                    address: supplierData.address || null
                }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteSupplier(id) {
        try {
            return await prisma.supplier.delete({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addSupplierPayment(paymentData) {
        try {
            return await prisma.$transaction(async (tx) => {
                const payment = await tx.supplierPayment.create({
                    data: {
                        supplierId: parseInt(paymentData.supplierId),
                        amount: parseFloat(paymentData.amount),
                        notes: paymentData.notes || null
                    }
                });

                await tx.supplier.update({
                    where: { id: parseInt(paymentData.supplierId) },
                    data: { balance: { increment: parseFloat(paymentData.amount) } }
                });

                return payment;
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async getSupplierPayments(supplierId) {
        try {
            return await prisma.supplierPayment.findMany({
                where: { supplierId: parseInt(supplierId) },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== EXPENSES ====================
    async getExpenses() {
        try {
            return await prisma.expense.findMany({
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async addExpense(expenseData) {
        try {
            return await prisma.expense.create({
                data: {
                    title: expenseData.title,
                    amount: parseFloat(expenseData.amount)
                }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteExpense(id) {
        try {
            return await prisma.expense.delete({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== USERS ====================
    async getUsers() {
        try {
            const users = await prisma.user.findMany({
                orderBy: { createdAt: 'desc' }
            });
            return users.map(({ password, ...user }) => user);
        } catch (error) {
            return { error: error.message };
        }
    },

    async addUser(userData) {
        try {
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            const user = await prisma.user.create({
                data: {
                    name: userData.name,
                    username: userData.username,
                    password: hashedPassword,
                    role: userData.role
                }
            });
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateUser(id, userData) {
        try {
            const data = { ...userData };
            if (userData.password) {
                data.password = await bcrypt.hash(userData.password, 10);
            }
            const user = await prisma.user.update({
                where: { id: parseInt(id) },
                data
            });
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (error) {
            return { error: error.message };
        }
    },

    async deleteUser(id) {
        try {
            return await prisma.user.delete({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async disconnect() {
        await prisma.$disconnect();
    }
};

module.exports = dbService;







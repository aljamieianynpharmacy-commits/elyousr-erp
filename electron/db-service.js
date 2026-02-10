require('dotenv').config(); // Load .env file
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';
const DEBUG_CUSTOMERS_QUERIES = process.env.DEBUG_CUSTOMERS_QUERIES === '1';

const customerQueryLog = (...args) => {
    if (DEBUG_CUSTOMERS_QUERIES) {
        console.log(...args);
    }
};

let ensureCustomerFinancialSchemaPromise = null;
const ensureCustomerFinancialSchema = async () => {
    if (!ensureCustomerFinancialSchemaPromise) {
        ensureCustomerFinancialSchemaPromise = (async () => {
            try {
                await Promise.all([
                    prisma.$executeRawUnsafe('ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "balance" DOUBLE PRECISION NOT NULL DEFAULT 0'),
                    prisma.$executeRawUnsafe('ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "firstActivityDate" TIMESTAMP(3)'),
                    prisma.$executeRawUnsafe('ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lastPaymentDate" TIMESTAMP(3)'),
                    prisma.$executeRawUnsafe('ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "financialsUpdatedAt" TIMESTAMP(3)')
                ]);
                await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_customer_financials_updated_at ON "Customer" ("financialsUpdatedAt")');
            } catch (error) {
                console.warn('Customer financial schema setup failed:', error?.message || error);
            }
        })();
    }
    return ensureCustomerFinancialSchemaPromise;
};

let ensureCustomerQueryIndexesPromise = null;
const ensureCustomerQueryIndexes = async () => {
    await ensureCustomerFinancialSchema();

    if (!ensureCustomerQueryIndexesPromise) {
        ensureCustomerQueryIndexesPromise = (async () => {
            try {
                await Promise.all([
                    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_customer_transaction_customer_id ON "CustomerTransaction" ("customerId")'),
                    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_customer_transaction_customer_date ON "CustomerTransaction" ("customerId", "date")'),
                    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_customer_payment_customer_id ON "CustomerPayment" ("customerId")'),
                    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_customer_payment_customer_date ON "CustomerPayment" ("customerId", "paymentDate")'),
                    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_sale_customer_id ON "Sale" ("customerId")'),
                    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_sale_customer_invoice_date ON "Sale" ("customerId", "invoiceDate")')
                ]);
            } catch (error) {
                console.warn('Customer query index setup failed:', error?.message || error);
            }
        })();
    }
    return ensureCustomerQueryIndexesPromise;
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

const syncCustomerFinancialSummaries = async (txOrClient, customerIds = []) => {
    await ensureCustomerFinancialSchema();

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

    const summaryMap = new Map();
    updates.forEach((summary) => {
        summaryMap.set(summary.customerId, summary);
    });
    return summaryMap;
};

const recalculateCustomerFinancialSummary = async (txOrClient, customerId) => {
    const summaries = await syncCustomerFinancialSummaries(txOrClient, [customerId]);
    return summaries.get(parseInt(customerId, 10)) || null;
};

const dbService = {
    // ==================== AUTH ====================
    async login({ username, password }) {
        try {
            const user = await prisma.user.findUnique({
                where: { username }
            });

            if (!user) return { error: 'المستخدم غير موجود' };

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) return { error: 'كلمة المرور غير صحيحة' };

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

            // حساب الديون من CustomerTransaction
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
                    { name: { contains: searchTerm } }, // حذفنا mode: 'insensitive' لأنه غير مدعوم في SQLite بشكل افتراضي، إلا إذا كنت تستخدم PostgreSQL
                    { sku: { contains: searchTerm } },
                    { description: { contains: searchTerm } }
                ];
                // إذا كان البحث رقما، ابحث في الباركود
                if (!isNaN(searchTerm)) {
                    where.OR.push({ barcode: { contains: searchTerm } });
                }
            }

            // التأكد من أن حقل الترتيب صالح
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
            // تنظيف البيانات
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
            // تنظيف البيانات
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
        try {
            await ensureCustomerFinancialSchema();

            return await prisma.$transaction(async (tx) => {
                const newSale = await tx.sale.create({
                    data: {
                        customer: saleData.customerId ? {
                            connect: { id: parseInt(saleData.customerId) }
                        } : undefined,
                        total: parseFloat(saleData.total),
                        discount: parseFloat(saleData.discount || 0),
                        saleType: saleData.saleType || 'نقدي',
                        notes: saleData.notes || null,
                        invoiceDate: saleData.invoiceDate
                            ? new Date(saleData.invoiceDate)
                            : undefined
                    }
                });

                // إنشاء بنود الفاتورة وتحديث المخزون
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

                // إنشاء سجل في CustomerTransaction للعميل
                if (saleData.customerId) {
                    const transactionAmount = parseFloat(saleData.total) - parseFloat(saleData.discount || 0);

                    await tx.customerTransaction.create({
                        data: {
                            customer: {
                                connect: { id: parseInt(saleData.customerId) }
                            },
                            date: newSale.invoiceDate || new Date(),
                            type: 'SALE',
                            referenceType: 'SALE',
                            referenceId: newSale.id,
                            debit: transactionAmount,
                            credit: 0,
                            notes: `فاتورة #${newSale.id} - ${saleData.notes || 'بيع نقدي'}`
                        }
                    });
                }

                // 🔥 نظام التقييم الذكي التلقائي
                let customerFinancialSummary = null;
                if (saleData.customerId) {
                    customerFinancialSummary = await recalculateCustomerFinancialSummary(
                        tx,
                        parseInt(saleData.customerId),
                    );
                }

                if (saleData.customerId) {
                    const customer = await tx.customer.findUnique({
                        where: { id: parseInt(saleData.customerId) },
                        include: {
                            sales: true,
                            payments: true
                        }
                    });

                    if (customer) {
                        // حساب إجمالي المشتريات
                        const totalPurchases = customer.sales.reduce((sum, sale) => sum + sale.total, 0);

                        // حساب التقييم الذكي (0-5 نجوم)
                        let rating = 0;

                        // معايير التقييم:
                        // 1. حجم المشتريات (40%)
                        if (totalPurchases >= 50000) rating += 2;
                        else if (totalPurchases >= 20000) rating += 1.5;
                        else if (totalPurchases >= 10000) rating += 1;
                        else if (totalPurchases >= 5000) rating += 0.5;

                        // 2. عدد المعاملات (20%)
                        const salesCount = customer.sales.length;
                        if (salesCount >= 50) rating += 1;
                        else if (salesCount >= 20) rating += 0.7;
                        else if (salesCount >= 10) rating += 0.5;
                        else if (salesCount >= 5) rating += 0.3;

                        // 3. انتظام السداد (40%) - محسوب من الـ transactions
                        const currentBalance = customerFinancialSummary?.balance || 0;
                        const debtRatio = currentBalance / Math.max(totalPurchases, 1);

                        if (debtRatio < 0.1 && salesCount >= 5) rating += 2;
                        else if (debtRatio < 0.2 && salesCount >= 3) rating += 1.5;
                        else if (debtRatio < 0.3) rating += 1;
                        else if (debtRatio < 0.5) rating += 0.5;

                        rating = Math.min(5, rating); // الحد الأقصى 5 نجوم

                        // تصنيف تلقائي للعميل
                        let customerType = 'عادي';
                        if (totalPurchases >= 50000 && rating >= 4) {
                            customerType = 'VIP';
                        } else if (totalPurchases >= 30000 && salesCount >= 10) {
                            customerType = 'تاجر جملة';
                        } else if (totalPurchases >= 20000 || rating >= 3.5) {
                            customerType = 'VIP';
                        }

                        // تحديث بيانات العميل (rating و customerType فقط)
                        await tx.customer.update({
                            where: { id: parseInt(saleData.customerId) },
                            data: {
                                rating,
                                customerType
                            }
                        });
                    }
                }

                return newSale;
            });
        } catch (error) {
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
        try {
            await ensureCustomerFinancialSchema();

            return await prisma.$transaction(async (tx) => {
                // الحصول على بيانات الفاتورة
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

                // استرجاع الكميات للمنتجات
                for (const item of sale.items) {
                    await tx.variant.update({
                        where: { id: item.variantId },
                        data: { quantity: { increment: item.quantity } }
                    });
                }

                // حذف سجل CustomerTransaction المقابل
                if (sale.customerId) {
                    await tx.customerTransaction.deleteMany({
                        where: {
                            customerId: sale.customerId,
                            referenceType: 'SALE',
                            referenceId: parseInt(saleId)
                        }
                    });
                }

                // حذف بنود الفاتورة
                await tx.saleItem.deleteMany({
                    where: { saleId: parseInt(saleId) }
                });

                // حذف الفاتورة
                const deletedSale = await tx.sale.delete({
                    where: { id: parseInt(saleId) }
                });

                if (sale.customerId) {
                    await recalculateCustomerFinancialSummary(tx, sale.customerId);
                }

                return { success: true, data: deletedSale };
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateSale(saleId, saleData) {
        try {
            await ensureCustomerFinancialSchema();

            return await prisma.$transaction(async (tx) => {
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

                const affectedCustomerIds = new Set();
                if (currentSale.customerId) {
                    affectedCustomerIds.add(currentSale.customerId);
                }

                // استرجاع الكميات القديمة
                for (const item of currentSale.items) {
                    await tx.variant.update({
                        where: { id: item.variantId },
                        data: { quantity: { increment: item.quantity } }
                    });
                }

                // حذف سجل CustomerTransaction القديم
                if (currentSale.customerId) {
                    await tx.customerTransaction.deleteMany({
                        where: {
                            customerId: currentSale.customerId,
                            referenceType: 'SALE',
                            referenceId: parseInt(saleId)
                        }
                    });
                }

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

                        // خصم الكميات الجديدة
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

                // إنشاء سجل CustomerTransaction الجديد
                if (saleData.customerId) {
                    affectedCustomerIds.add(parseInt(saleData.customerId));
                    const transactionAmount = parseFloat(saleData.total) - parseFloat(saleData.discount || 0);
                    await tx.customerTransaction.create({
                        data: {
                            customer: {
                                connect: { id: parseInt(saleData.customerId) }
                            },
                            date: updatedSale.invoiceDate || new Date(),
                            type: 'SALE',
                            referenceType: 'SALE',
                            referenceId: updatedSale.id,
                            debit: transactionAmount,
                            credit: 0,
                            notes: `فاتورة معدلة #${updatedSale.id} - ${saleData.notes || 'بيع'}`
                        }
                    });
                }

                for (const customerId of affectedCustomerIds) {
                    await recalculateCustomerFinancialSummary(tx, customerId);
                }

                return { success: true, data: updatedSale };
            });
        } catch (error) {
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

                    // زيادة المخزون
                    await tx.variant.update({
                        where: { id: parseInt(item.variantId) },
                        data: {
                            quantity: { increment: parseInt(item.quantity) },
                            cost: parseFloat(item.cost) // تحديث سعر التكلفة
                        }
                    });
                }

                // تحديث رصيد المورد
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

    // ==================== RETURNS (المرتجعات) ====================
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
        try {
            await ensureCustomerFinancialSchema();

            return await prisma.$transaction(async (tx) => {
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
                    await tx.customerTransaction.create({
                        data: {
                            customer: {
                                connect: { id: parseInt(returnData.customerId) }
                            },
                            date: new Date(),
                            type: 'RETURN',
                            referenceType: 'RETURN',
                            referenceId: newReturn.id,
                            debit: 0,
                            credit: parseFloat(returnData.total),
                            notes: `مرتجع #${newReturn.id} - ${returnData.notes || 'مرتجع'}`
                        }
                    });

                    await recalculateCustomerFinancialSummary(tx, parseInt(returnData.customerId));
                }

                return newReturn;
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== CUSTOMERS ====================
    async getCustomerBalance(customerId) {
        try {
            await ensureCustomerFinancialSchema();

            const parsedCustomerId = parseInt(customerId);
            const customer = await prisma.customer.findUnique({
                where: { id: parsedCustomerId },
                select: {
                    id: true,
                    balance: true,
                    financialsUpdatedAt: true
                }
            });

            if (!customer) return 0;

            if (!customer.financialsUpdatedAt) {
                const summary = await recalculateCustomerFinancialSummary(prisma, parsedCustomerId);
                return summary?.balance || 0;
            }

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

    async getCustomers({ page = 1, pageSize = 50, searchTerm = '', customerType = null, sortCol = 'id', sortDir = 'desc', overdueThreshold = 30 } = {}) {
        await ensureCustomerQueryIndexes();

        const startTime = performance.now();
        try {
            const safePage = Math.max(1, parseInt(page, 10) || 1);
            const safePageSize = Math.max(1, parseInt(pageSize, 10) || 50);
            const timestamp = new Date().toLocaleTimeString('ar-EG', {
                hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3
            });
            customerQueryLog(
                `[${timestamp}] getCustomers page=${safePage} pageSize=${safePageSize} search="${searchTerm}" type=${customerType} overdue=${overdueThreshold} sort=${sortCol}:${sortDir}`,
            );

            const skip = (safePage - 1) * safePageSize;
            const where = {};

            const normalizedSearch = String(searchTerm || '').trim();
            if (normalizedSearch.length >= 2) {
                customerQueryLog(`[${timestamp}] apply search filter "${normalizedSearch}"`);
                where.OR = [
                    { name: { startsWith: normalizedSearch, mode: 'insensitive' } },
                    { phone: { startsWith: normalizedSearch } },
                    { city: { startsWith: normalizedSearch, mode: 'insensitive' } }
                ];
            }

            if (customerType && customerType !== 'all') {
                customerQueryLog(`[${timestamp}] apply customer type filter: ${customerType}`);
                where.customerType = customerType;
            }

            // التعامل مع الترتيب
            // ملاحظة: الترتيب حسب "balance" أو الحقول المحسوبة يتطلب منطق خاص
            const validSortCols = ['id', 'name', 'phone', 'city', 'createdAt', 'creditLimit'];
            let orderBy = {};
            if (validSortCols.includes(sortCol)) {
                orderBy = { [sortCol]: sortDir };
                customerQueryLog(`[${timestamp}] orderBy: ${sortCol} ${sortDir}`);
            } else {
                orderBy = { createdAt: 'desc' };
                customerQueryLog(`[${timestamp}] orderBy fallback: createdAt desc`);
            }

            customerQueryLog(`[${timestamp}] querying database`, where, orderBy);

            const dbStartTime = performance.now();

            const [customers, total] = await Promise.all([
                prisma.customer.findMany({
                    skip,
                    take: safePageSize,
                    where,
                    orderBy
                }),
                prisma.customer.count({ where })
            ]);

            const dbEndTime = performance.now();
            const dbDuration = (dbEndTime - dbStartTime).toFixed(2);

            customerQueryLog(`[${timestamp}] db rows=${customers.length} total=${total} took=${dbDuration}ms`);

            if (customers.length === 0) {
                return {
                    data: [],
                    total,
                    page: safePage,
                    totalPages: Math.ceil(total / safePageSize)
                };
            }

            const unsyncedCustomerIds = customers
                .filter((customer) => !customer.financialsUpdatedAt)
                .map((customer) => customer.id);

            let syncedFinancialsMap = new Map();
            if (unsyncedCustomerIds.length > 0) {
                const statsStartTime = performance.now();
                syncedFinancialsMap = await syncCustomerFinancialSummaries(prisma, unsyncedCustomerIds);
                const statsEndTime = performance.now();
                const statsDuration = (statsEndTime - statsStartTime).toFixed(2);
                customerQueryLog(
                    `[${timestamp}] synced missing customer financials (${unsyncedCustomerIds.length}) in ${statsDuration}ms`,
                );
            }

            const customersWithDetails = customers.map((customer) => {
                const syncedFinancials = syncedFinancialsMap.get(customer.id);
                const balance = syncedFinancials?.balance ?? (customer.balance || 0);
                const firstActivityDate = syncedFinancials?.firstActivityDate ?? customer.firstActivityDate ?? null;
                const lastPaymentDate = syncedFinancials?.lastPaymentDate ?? customer.lastPaymentDate ?? null;
                const status = computeCustomerPaymentStatus(
                    firstActivityDate,
                    lastPaymentDate,
                    overdueThreshold,
                );

                return {
                    ...customer,
                    balance,
                    firstActivityDate,
                    lastPaymentDate,
                    financialsUpdatedAt: syncedFinancials?.financialsUpdatedAt ?? customer.financialsUpdatedAt ?? null,
                    lastPaymentDays: status.lastPaymentDays,
                    isOverdue: status.isOverdue
                };
            });

            // إذا كان الترتيب مطلوب حسب الرصيد
            if (sortCol === 'balance') {
                customerQueryLog(`[${timestamp}] sorting by balance`);
                customersWithDetails.sort((a, b) => sortDir === 'asc' ? a.balance - b.balance : b.balance - a.balance);
            }

            const result = {
                data: customersWithDetails,
                total,
                page: safePage,
                totalPages: Math.ceil(total / safePageSize)
            };

            const endTime = performance.now();
            const totalDuration = (endTime - startTime).toFixed(2);

            customerQueryLog(`[${timestamp}] getCustomers done rows=${result.data.length} total=${result.total} totalTime=${totalDuration}ms`);
            return result;
        } catch (error) {
            const endTime = performance.now();
            const duration = (endTime - startTime).toFixed(2);
            const timestamp = new Date().toLocaleTimeString('ar-EG', {
                hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3
            });
            console.error(`[${timestamp}] getCustomers error after ${duration}ms:`, error);
            return { error: error.message };
        }
    },

    async getCustomer(id) {
        try {
            await ensureCustomerFinancialSchema();

            const parsedCustomerId = parseInt(id);
            const customer = await prisma.customer.findUnique({
                where: { id: parsedCustomerId }
            });

            if (!customer) return { error: 'العميل غير موجود' };

            const syncedFinancials = customer.financialsUpdatedAt
                ? null
                : await recalculateCustomerFinancialSummary(prisma, parsedCustomerId);

            const firstActivityDate = syncedFinancials?.firstActivityDate ?? customer.firstActivityDate ?? null;
            const lastPaymentDate = syncedFinancials?.lastPaymentDate ?? customer.lastPaymentDate ?? null;
            const status = computeCustomerPaymentStatus(firstActivityDate, lastPaymentDate, 30);

            return {
                ...customer,
                balance: syncedFinancials?.balance ?? customer.balance ?? 0,
                firstActivityDate,
                lastPaymentDate,
                financialsUpdatedAt: syncedFinancials?.financialsUpdatedAt ?? customer.financialsUpdatedAt ?? null,
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
            await ensureCustomerFinancialSchema();

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
        try {
            await ensureCustomerFinancialSchema();
            // تحويل التاريخ بشكل صحيح ✅
            let paymentDate = null;

            if (paymentData.paymentDate) {
                const dateStr = paymentData.paymentDate;

                if (typeof dateStr === 'string') {
                    // إذا كانت بصيغة YYYY-MM-DD (مثل "2026-01-29")
                    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        // تحويل صحيح للتاريخ مع الحفاظ على المنطقة الزمنية
                        const [year, month, day] = dateStr.split('-');
                        paymentDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
                    } else {
                        // إذا كانت صيغة أخرى (ISO, إلخ)
                        paymentDate = new Date(dateStr);
                    }
                } else if (dateStr instanceof Date) {
                    paymentDate = dateStr;
                } else {
                    paymentDate = new Date(dateStr);
                }

                // التحقق من صحة التاريخ
                if (isNaN(paymentDate.getTime())) {
                    console.warn('⚠️ تاريخ غير صحيح:', dateStr, '- سيتم استخدام اليوم الحالي');
                    paymentDate = new Date();
                }
            } else {
                // إذا لم يتم تحديد تاريخ، استخدم اليوم الحالي
                paymentDate = new Date();
            }

            console.log('💾 إضافة دفعة:');
            console.log('   • التاريخ المدخل:', paymentData.paymentDate);
            console.log('   • التاريخ المعالج:', paymentDate);
            console.log('   • التاريخ بصيغة ISO:', paymentDate.toISOString());
            console.log('   • طريقة الدفع:', paymentData.paymentMethodId);

            return await prisma.$transaction(async (tx) => {
                const payment = await tx.customerPayment.create({
                    data: {
                        customer: {
                            connect: { id: parseInt(paymentData.customerId) }
                        },
                        paymentMethod: {
                            connect: { id: parseInt(paymentData.paymentMethodId) || 1 }
                        },
                        amount: parseFloat(paymentData.amount),
                        notes: paymentData.notes || null,
                        paymentDate: paymentDate, // ✅ صحيح الآن
                    }
                });

                // إنشاء سجل في CustomerTransaction
                await tx.customerTransaction.create({
                    data: {
                        customer: {
                            connect: { id: parseInt(paymentData.customerId) }
                        },
                        date: paymentDate,
                        type: 'PAYMENT',
                        referenceType: 'PAYMENT',
                        referenceId: payment.id,
                        debit: 0,
                        credit: parseFloat(paymentData.amount),
                        notes: `دفعة #${payment.id} - ${paymentData.notes || 'دفعة نقدية'}`
                    }
                });

                await recalculateCustomerFinancialSummary(tx, parseInt(paymentData.customerId));

                console.log('✅ تم حفظ الدفعة بنجاح:');
                console.log('   • ID:', payment.id);
                console.log('   • التاريخ المحفوظ:', payment.paymentDate);
                console.log('   • طريقة الدفع ID:', payment.paymentMethodId);

                return payment;
            });
        } catch (error) {
            console.error('❌ خطأ في إضافة الدفعة:', error);
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
        try {
            await ensureCustomerFinancialSchema();
            return await prisma.$transaction(async (tx) => {
                // الحصول على بيانات الدفعة
                const payment = await tx.customerPayment.findUnique({
                    where: { id: parseInt(paymentId) },
                    include: { customer: true }
                });

                if (!payment) {
                    return { error: 'Payment not found' };
                }

                // حذف سجل CustomerTransaction المقابل
                await tx.customerTransaction.deleteMany({
                    where: {
                        customerId: payment.customerId,
                        referenceType: 'PAYMENT',
                        referenceId: parseInt(paymentId)
                    }
                });

                // حذف الدفعة
                const deletedPayment = await tx.customerPayment.delete({
                    where: { id: parseInt(paymentId) }
                });

                await recalculateCustomerFinancialSummary(tx, payment.customerId);

                return { success: true, data: deletedPayment };
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    // ==================== PAYMENT METHODS ====================
    async getPaymentMethods() {
        try {
            const methods = await prisma.paymentMethod.findMany({
                where: { isActive: true },
                orderBy: { createdAt: 'asc' }
            });

            console.log('📋 طرق الدفع:', methods);
            return methods;
        } catch (error) {
            console.error('❌ خطأ في جلب طرق الدفع:', error);
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
            console.error('❌ خطأ في جلب إحصائيات طرق الدفع:', error);
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
    }
};

module.exports = dbService;


require('dotenv').config(); // Load .env file
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';

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
                        const customerTransactions = await tx.customerTransaction.findMany({
                            where: { customerId: parseInt(saleData.customerId) }
                        });

                        const totalDebit = customerTransactions.reduce((sum, t) => sum + t.debit, 0);
                        const totalCredit = customerTransactions.reduce((sum, t) => sum + t.credit, 0);
                        const currentBalance = totalDebit - totalCredit;
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

                return { success: true, data: deletedSale };
            });
        } catch (error) {
            return { error: error.message };
        }
    },

    async updateSale(saleId, saleData) {
        try {
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
            const transactions = await prisma.customerTransaction.groupBy({
                by: ['customer'],
                where: { customer: { id: parseInt(customerId) } },
                _sum: {
                    debit: true,
                    credit: true
                }
            });

            const result = transactions[0];
            if (!result) return 0;

            const balance = result._sum.debit - result._sum.credit;
            return balance || 0;
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

    async getCustomers({ page = 1, pageSize = 50, searchTerm = '', customerType = null, sortCol = 'id', sortDir = 'desc' } = {}) {
        try {
            const skip = (page - 1) * pageSize;
            const where = {};

            const normalizedSearch = String(searchTerm || '').trim();
            if (normalizedSearch.length >= 2) {
                where.OR = [
                    { name: { startsWith: normalizedSearch, mode: 'insensitive' } },
                    { phone: { startsWith: normalizedSearch } },
                    { city: { startsWith: normalizedSearch, mode: 'insensitive' } }
                ];
            }

            if (customerType && customerType !== 'all') {
                where.customerType = customerType;
            }

            // التعامل مع الترتيب
            // ملاحظة: الترتيب حسب "balance" (الرصيد المحسوب) يتطلب منطق خاص لأن الرصيد ليس عموداً في قاعدة البيانات
            const validSortCols = ['id', 'name', 'phone', 'city', 'createdAt', 'creditLimit'];
            let orderBy = {};
            if (validSortCols.includes(sortCol)) {
                orderBy = { [sortCol]: sortDir };
            } else {
                orderBy = { createdAt: 'desc' };
            }

            const [customers, total] = await Promise.all([
                prisma.customer.findMany({
                    skip,
                    take: pageSize,
                    where,
                    orderBy
                }),
                prisma.customer.count({ where })
            ]);

            // استعلام سريع للحصول على الأرصدة فقط للعملاء الحاليين باستخدام GroupBy
            const customerIds = customers.map(c => c.id);
            const balances = await prisma.customerTransaction.groupBy({
                by: ['customerId'],
                _sum: {
                    debit: true,
                    credit: true
                },
                where: {
                    customerId: { in: customerIds }
                }
            });

            // تحويل مصفوفة الأرصدة إلى Map لسهولة الوصول
            const balanceMap = {};
            balances.forEach(b => {
                balanceMap[b.customerId] = (b._sum.debit || 0) - (b._sum.credit || 0);
            });

            // دمج الرصيد مع بيانات العميل
            const customersWithBalance = customers.map(customer => ({
                ...customer,
                balance: balanceMap[customer.id] || 0
            }));

            // إذا كان الترتيب مطلوب حسب الرصيد، نرتب الصفحة الحالية فقط
            if (sortCol === 'balance') {
                customersWithBalance.sort((a, b) => sortDir === 'asc' ? a.balance - b.balance : b.balance - a.balance);
            }

            return {
                data: customersWithBalance,
                total,
                page,
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            return { error: error.message };
        }
    },

    async getCustomer(id) {
        try {
            const customer = await prisma.customer.findUnique({
                where: { id: parseInt(id) },
                include: {
                    transactions: { select: { debit: true, credit: true } }
                }
            });

            if (!customer) return { error: 'العميل غير موجود' };

            const totalDebit = customer.transactions.reduce((sum, t) => sum + t.debit, 0);
            const totalCredit = customer.transactions.reduce((sum, t) => sum + t.credit, 0);
            const balance = totalDebit - totalCredit;

            const { transactions, ...data } = customer;
            return { ...data, balance };
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

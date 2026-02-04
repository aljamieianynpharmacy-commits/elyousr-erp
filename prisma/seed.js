require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// دالة مساعدة لتوليد تاريخ عشوائي في آخر N يوم
function randomDate(daysAgo = 90) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
    return date;
}

// دالة مساعدة لاختيار عنصر عشوائي من مصفوفة
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
    console.log('🌱 بدء إنشاء البيانات التجريبية الكبيرة...\n');

    // 1. إنشاء المستخدمين
    console.log('👤 إنشاء المستخدمين...');
    const hashedPassword = await bcrypt.hash('123456', 10);

    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            name: 'المدير العام',
            username: 'admin',
            password: hashedPassword,
            role: 'ADMIN'
        }
    });

    await prisma.user.upsert({
        where: { username: 'cashier' },
        update: {},
        create: {
            name: 'محمد الكاشير',
            username: 'cashier',
            password: hashedPassword,
            role: 'CASHIER'
        }
    });

    await prisma.user.upsert({
        where: { username: 'store' },
        update: {},
        create: {
            name: 'أحمد أمين المخزن',
            username: 'store',
            password: hashedPassword,
            role: 'STOREKEEPER'
        }
    });

    // 2. إنشاء طرق الدفع
    console.log('💳 إنشاء طرق الدفع...');
    const paymentMethods = [
        { name: 'نقدي', code: 'CASH' },
        { name: 'فيزا', code: 'VISA' },
        { name: 'ماستركارد', code: 'MASTERCARD' },
        { name: 'تحويل بنكي', code: 'BANK_TRANSFER' },
        { name: 'فودافون كاش', code: 'VODAFONE_CASH' },
        { name: 'إنستاباي', code: 'INSTAPAY' }
    ];

    const createdPaymentMethods = [];
    for (const method of paymentMethods) {
        const pm = await prisma.paymentMethod.upsert({
            where: { code: method.code },
            update: {},
            create: method
        });
        createdPaymentMethods.push(pm);
    }

    // 3. إنشاء فئات المنتجات
    console.log('📦 إنشاء الفئات (10 فئات)...');
    const categories = [
        { name: 'ملابس رجالي', description: 'ملابس رجالية متنوعة', color: '#3b82f6', icon: '👔' },
        { name: 'ملابس نسائي', description: 'ملابس نسائية متنوعة', color: '#ec4899', icon: '👗' },
        { name: 'ملابس أطفال', description: 'ملابس أطفال', color: '#10b981', icon: '👶' },
        { name: 'أحذية', description: 'أحذية متنوعة', color: '#f59e0b', icon: '👟' },
        { name: 'حقائب', description: 'حقائب وشنط', color: '#8b5cf6', icon: '👜' },
        { name: 'إكسسوارات', description: 'إكسسوارات متنوعة', color: '#ef4444', icon: '💍' },
        { name: 'ملابس رياضية', description: 'ملابس رياضية', color: '#06b6d4', icon: '⚽' },
        { name: 'ملابس داخلية', description: 'ملابس داخلية', color: '#84cc16', icon: '👙' },
        { name: 'معاطف وجواكت', description: 'معاطف وجواكت شتوية', color: '#6366f1', icon: '🧥' },
        { name: 'منسوجات منزلية', description: 'مفارش وبطاطين', color: '#f97316', icon: '🛏️' }
    ];

    const createdCategories = [];
    for (const cat of categories) {
        const category = await prisma.category.upsert({
            where: { name: cat.name },
            update: {},
            create: cat
        });
        createdCategories.push(category);
    }

    // 4. إنشاء عملاء (50 عميل)
    console.log('👥 إنشاء العملاء (50 عميل)...');
    const customerNames = [
        'أحمد محمد', 'محمود علي', 'خالد حسن', 'عمر إبراهيم', 'يوسف عبدالله',
        'فاطمة أحمد', 'عائشة محمد', 'مريم خالد', 'نور الدين', 'سارة علي',
        'حسن محمود', 'طارق سعيد', 'ياسر عبدالرحمن', 'كريم فتحي', 'وليد صلاح',
        'منى حسين', 'هدى عادل', 'ليلى كامل', 'داليا إبراهيم', 'رنا محمد',
        'محمد سمير', 'أحمد حسام', 'علي عصام', 'عبدالله رمضان', 'إبراهيم شعبان',
        'ريهام أحمد', 'إيمان محمد', 'نهى علي', 'شيماء حسن', 'دعاء محمود',
        'مصطفى أحمد', 'أمير محمد', 'سامح علي', 'هاني حسن', 'شريف محمود',
        'نادية أحمد', 'سعاد محمد', 'سميرة علي', 'كريمة حسن', 'زينب محمود',
        'حسام الدين', 'صلاح الدين', 'عماد الدين', 'جمال الدين', 'كمال الدين',
        'لبنى أحمد', 'سلمى محمد', 'ندى علي', 'هبة حسن', 'آية محمود'
    ];

    const cities = ['القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'طنطا', 'أسيوط', 'المنيا', 'الفيوم'];
    const types = ['عادي', 'VIP', 'تاجر جملة'];

    const createdCustomers = [];
    for (let i = 0; i < customerNames.length; i++) {
        const customer = await prisma.customer.create({
            data: {
                name: customerNames[i],
                phone: `0${Math.floor(1000000000 + Math.random() * 900000000)}`,
                phone2: Math.random() > 0.5 ? `0${Math.floor(1000000000 + Math.random() * 900000000)}` : null,
                address: Math.random() > 0.3 ? `شارع ${Math.floor(Math.random() * 100)} - ${randomChoice(['وسط البلد', 'شبرا', 'المعادي', 'مدينة نصر', 'الدقي'])}` : null,
                city: randomChoice(cities),
                district: Math.random() > 0.5 ? randomChoice(['حي شرق', 'حي غرب', 'حي أول', 'حي ثاني']) : null,
                notes: Math.random() > 0.7 ? randomChoice(['عميل ممتاز', 'يفضل التوصيل', 'عميل منتظم', 'دفع فوري']) : null,
                creditLimit: i < 10 ? 0 : Math.floor(Math.random() * 20000) + 5000,
                customerType: i < 10 ? 'عادي' : randomChoice(types),
                rating: Math.random() * 5
            }
        });
        createdCustomers.push(customer);
    }

    // 5. إنشاء موردين (15 مورد)
    console.log('🏭 إنشاء الموردين (15 مورد)...');
    const supplierNames = [
        'مورد الأقمشة المتحدة', 'شركة النسيج المصرية', 'مصنع الملابس الحديثة',
        'مورد الأحذية الإيطالية', 'شركة الإكسسوارات التركية', 'مورد الجلود الطبيعية',
        'مصنع القمصان الكلاسيكية', 'شركة الملابس الرياضية', 'مورد الجينز الأمريكي',
        'مصنع الفساتين الفرنسية', 'شركة الحقائب الصينية', 'مورد المعاطف الشتوية',
        'مصنع ملابس الأطفال', 'شركة المنسوجات المنزلية', 'مورد الملابس الداخلية'
    ];

    const createdSuppliers = [];
    for (const name of supplierNames) {
        const supplier = await prisma.supplier.create({
            data: {
                name,
                phone: `0${Math.floor(1000000000 + Math.random() * 900000000)}`,
                address: randomChoice(['العتبة', 'الموسكي', 'الأزهر', 'المطرية', 'شبرا الخيمة', 'مدينة بدر']),
                balance: 0
            }
        });
        createdSuppliers.push(supplier);
    }

    // 6. إنشاء منتجات مع variants (100 منتج × 3-5 variants)
    console.log('🛍️ إنشاء المنتجات والأشكال (100 منتج مع variants)...');

    const productNames = {
        'ملابس رجالي': ['قميص كلاسيك', 'بنطلون جينز', 'جاكيت جلد', 'تي شيرت قطن', 'بدلة رسمية'],
        'ملابس نسائي': ['فستان سهرة', 'بلوزة حرير', 'تنورة طويلة', 'بنطلون واسع', 'عباية مطرزة'],
        'ملابس أطفال': ['بيجامة أطفال', 'فستان بنات', 'بدلة أولاد', 'تي شيرت كارتون', 'جاكيت شتوي'],
        'أحذية': ['حذاء رياضي', 'حذاء كلاسيك', 'صندل صيفي', 'بوت شتوي', 'شبشب طبي'],
        'حقائب': ['حقيبة يد', 'شنطة ظهر', 'محفظة جلد', 'حقيبة سفر', 'حقيبة لابتوب'],
        'إكسسوارات': ['ساعة يد', 'حزام جلد', 'نظارة شمس', 'ربطة عنق', 'كابوريا'],
        'ملابس رياضية': ['بدلة رياضية', 'شورت رياضي', 'تي شيرت رياضي', 'جاكيت رياضي', 'طقم تدريب'],
        'ملابس داخلية': ['فانلة قطن', 'بوكسر', 'جرابات قطن', 'طقم داخلي', 'بيجامة قطن'],
        'معاطف وجواكت': ['معطف جلد', 'جاكيت شتوي', 'بالطو صوف', 'معطف مطر', 'سترة قطن'],
        'منسوجات منزلية': ['طقم ملايات', 'بطانية صوف', 'مفرش سرير', 'وسادة قطن', 'فوطة حمام']
    };

    const sizes = ['S', 'M', 'L', 'XL', 'XXL', '38', '40', '42', '44', '46'];
    const colors = ['أبيض', 'أسود', 'أزرق', 'أحمر', 'أخضر', 'رمادي', 'بني', 'بيج', 'كحلي', 'بنفسجي'];

    const createdProducts = [];
    let productCounter = 0;

    for (const [catName, products] of Object.entries(productNames)) {
        const category = createdCategories.find(c => c.name === catName);

        for (let p = 0; p < 10; p++) { // 10 منتج لكل فئة = 100 منتج
            const productName = randomChoice(products);
            const product = await prisma.product.create({
                data: {
                    name: `${productName} ${p + 1}`,
                    description: `وصف تفصيلي لـ ${productName}`,
                    categoryId: category.id,
                    brand: randomChoice(['Nike', 'Adidas', 'Zara', 'H&M', 'LC Waikiki', 'Defacto', null, null]),
                    barcode: `BAR${String(productCounter).padStart(10, '0')}`,
                    sku: `SKU${String(productCounter).padStart(8, '0')}`,
                    basePrice: Math.floor(Math.random() * 500) + 100
                }
            });

            // إنشاء 3-5 variants لكل منتج
            const variantCount = Math.floor(Math.random() * 3) + 3;
            for (let v = 0; v < variantCount; v++) {
                await prisma.variant.create({
                    data: {
                        productId: product.id,
                        productSize: randomChoice(sizes),
                        color: randomChoice(colors),
                        price: product.basePrice + Math.floor(Math.random() * 100),
                        cost: product.basePrice * 0.6 + Math.floor(Math.random() * 50),
                        quantity: Math.floor(Math.random() * 50) + 10,
                        barcode: `VAR${String(productCounter * 10 + v).padStart(12, '0')}`
                    }
                });
            }

            createdProducts.push(product);
            productCounter++;
        }
    }

    console.log(`   ✓ تم إنشاء ${createdProducts.length} منتج مع variants`);

    // 7. إنشاء فواتير مشتريات (30 فاتورة)
    console.log('📥 إنشاء فواتير المشتريات (30 فاتورة)...');
    for (let i = 0; i < 30; i++) {
        const supplier = randomChoice(createdSuppliers);
        const itemCount = Math.floor(Math.random() * 5) + 1;

        const variants = await prisma.variant.findMany({
            take: itemCount,
            skip: Math.floor(Math.random() * 400)
        });

        let total = 0;
        const items = variants.map((v, idx) => {
            const qty = Math.floor(Math.random() * 20) + 5;
            const cost = v.cost;
            total += qty * cost;
            return {
                id: idx + 1,
                variantId: v.id,
                quantity: qty,
                cost: cost
            };
        });

        const paid = Math.random() > 0.3 ? total : Math.floor(total * (Math.random() * 0.5 + 0.3));

        await prisma.purchase.create({
            data: {
                supplierId: supplier.id,
                total,
                paid,
                notes: `فاتورة مشتريات ${i + 1}`,
                createdAt: randomDate(60),
                items: {
                    create: items
                }
            }
        });

        // تحديث المخزون
        for (const item of items) {
            await prisma.variant.update({
                where: { id: item.variantId },
                data: { quantity: { increment: item.quantity } }
            });
        }
    }

    // 8. إنشاء فواتير بيع (100 فاتورة)
    console.log('🛒 إنشاء فواتير البيع (100 فاتورة)...');
    for (let i = 0; i < 100; i++) {
        const customer = i % 3 === 0 ? null : randomChoice(createdCustomers);
        const itemCount = Math.floor(Math.random() * 5) + 1;

        const variants = await prisma.variant.findMany({
            where: { quantity: { gt: 0 } },
            take: itemCount,
            skip: Math.floor(Math.random() * 300)
        });

        if (variants.length === 0) continue;

        let total = 0;
        const items = variants.map((v, idx) => {
            const qty = Math.min(Math.floor(Math.random() * 3) + 1, v.quantity);
            const price = v.price;
            const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 20) : 0;
            total += qty * (price - discount);
            return {
                id: idx + 1,
                variantId: v.id,
                quantity: qty,
                price: price,
                discount: discount
            };
        });

        const saleType = customer && Math.random() > 0.6 ? 'آجل' : 'نقدي';
        const invoiceDate = randomDate(90);

        const sale = await prisma.sale.create({
            data: {
                customerId: customer?.id,
                total,
                discount: Math.random() > 0.8 ? Math.floor(Math.random() * 50) : 0,
                saleType,
                notes: `فاتورة ${i + 1}`,
                invoiceDate,
                createdAt: invoiceDate,
                items: {
                    create: items
                }
            }
        });

        // تحديث المخزون
        for (const item of items) {
            await prisma.variant.update({
                where: { id: item.variantId },
                data: { quantity: { decrement: item.quantity } }
            });
        }

        // إنشاء CustomerTransaction
        if (customer) {
            await prisma.customerTransaction.create({
                data: {
                    customerId: customer.id,
                    date: invoiceDate,
                    type: 'SALE',
                    referenceType: 'SALE',
                    referenceId: sale.id,
                    debit: total - sale.discount,
                    credit: 0,
                    notes: `فاتورة بيع #${sale.id}`
                }
            });
        }
    }

    // 9. إنشاء دفعات العملاء (80 دفعة)
    console.log('💰 إنشاء دفعات العملاء (80 دفعة)...');
    for (let i = 0; i < 80; i++) {
        const customer = randomChoice(createdCustomers.filter(c => c.creditLimit > 0));
        const paymentMethod = randomChoice(createdPaymentMethods);
        const amount = Math.floor(Math.random() * 5000) + 500;
        const paymentDate = randomDate(60);

        const payment = await prisma.customerPayment.create({
            data: {
                customerId: customer.id,
                paymentMethodId: paymentMethod.id,
                amount,
                notes: `دفعة ${i + 1}`,
                paymentDate
            }
        });

        await prisma.customerTransaction.create({
            data: {
                customerId: customer.id,
                date: paymentDate,
                type: 'PAYMENT',
                referenceType: 'PAYMENT',
                referenceId: payment.id,
                debit: 0,
                credit: amount,
                notes: `دفعة #${payment.id}`
            }
        });
    }

    // 10. إنشاء مرتجعات (15 مرتجع)
    console.log('🔙 إنشاء المرتجعات (15 مرتجع)...');
    const sales = await prisma.sale.findMany({
        take: 15,
        include: { items: true, customer: true }
    });

    for (const sale of sales) {
        if (sale.items.length === 0) continue;

        const returnItems = sale.items.slice(0, Math.min(2, sale.items.length)).map((item, idx) => ({
            id: idx + 1,
            variantId: item.variantId,
            quantity: Math.min(item.quantity, Math.floor(Math.random() * item.quantity) + 1),
            price: item.price
        }));

        const total = returnItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

        const returnRecord = await prisma.return.create({
            data: {
                saleId: sale.id,
                customerId: sale.customerId,
                total,
                notes: 'مرتجع',
                items: {
                    create: returnItems
                }
            }
        });

        // تحديث المخزون
        for (const item of returnItems) {
            await prisma.variant.update({
                where: { id: item.variantId },
                data: { quantity: { increment: item.quantity } }
            });
        }

        // إنشاء CustomerTransaction
        if (sale.customerId) {
            await prisma.customerTransaction.create({
                data: {
                    customerId: sale.customerId,
                    date: new Date(),
                    type: 'RETURN',
                    referenceType: 'RETURN',
                    referenceId: returnRecord.id,
                    debit: 0,
                    credit: total,
                    notes: `مرتجع #${returnRecord.id}`
                }
            });
        }
    }

    // 11. إنشاء مصروفات (50 مصروف)
    console.log('💸 إنشاء المصروفات (50 مصروف)...');
    const expenseTypes = [
        'إيجار المحل', 'كهرباء', 'مياه', 'إنترنت', 'رواتب',
        'صيانة', 'تسويق', 'مواصلات', 'قرطاسية', 'تليفون',
        'تأمينات', 'ضرائب', 'مصاريف إدارية', 'نظافة', 'أمن وحراسة'
    ];

    for (let i = 0; i < 50; i++) {
        await prisma.expense.create({
            data: {
                title: randomChoice(expenseTypes),
                amount: Math.floor(Math.random() * 5000) + 500,
                createdAt: randomDate(90)
            }
        });
    }

    // 12. إنشاء عملاء للتجربة (Overdue Testing)
    console.log('🧪 إنشاء عملاء اختبار لحالة التأخير...');

    // عميل متأخر جدا (فاتورة من 60 يوم ولم يدفع)
    const overdueCustomer = await prisma.customer.create({
        data: {
            name: 'عميل متأخر (تجربة)',
            phone: '01000000001',
            city: 'القاهرة',
            creditLimit: 10000,
            customerType: 'عادي',
            notes: 'يجب أن يظهر كنقطة حمراء'
        }
    });

    const overdueVariant = createdProducts[0].id ?
        await prisma.variant.findFirst({ where: { productId: createdProducts[0].id } }) : null;

    if (overdueVariant) {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 60); // فاتورة من 60 يوم

        const sale = await prisma.sale.create({
            data: {
                customerId: overdueCustomer.id,
                total: 1000,
                status: 'COMPLETED',
                invoiceDate: oldDate,
                createdAt: oldDate,
                items: {
                    create: {
                        variantId: overdueVariant.id,
                        quantity: 1,
                        price: 1000
                    }
                }
            }
        });

        await prisma.customerTransaction.create({
            data: {
                customerId: overdueCustomer.id,
                date: oldDate,
                type: 'SALE',
                referenceType: 'SALE',
                referenceId: sale.id,
                debit: 1000,
                credit: 0,
                notes: 'فاتورة قديمة للتجربة'
            }
        });
    }

    // عميل ملتزم (فاتورة من 10 أيام)
    const goodCustomer = await prisma.customer.create({
        data: {
            name: 'عميل ملتزم (تجربة)',
            phone: '01000000002',
            city: 'الإسكندرية',
            creditLimit: 10000,
            customerType: 'VIP',
            notes: 'لن يظهر كنقطة حمراء'
        }
    });

    if (overdueVariant) {
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 10); // فاتورة من 10 أيام

        const sale = await prisma.sale.create({
            data: {
                customerId: goodCustomer.id,
                total: 500,
                status: 'COMPLETED',
                invoiceDate: recentDate,
                createdAt: recentDate,
                items: {
                    create: {
                        variantId: overdueVariant.id,
                        quantity: 1,
                        price: 500
                    }
                }
            }
        });

        await prisma.customerTransaction.create({
            data: {
                customerId: goodCustomer.id,
                date: recentDate,
                type: 'SALE',
                referenceType: 'SALE',
                referenceId: sale.id,
                debit: 500,
                credit: 0,
                notes: 'فاتورة حديثة للتجربة'
            }
        });
    }

    // عميل متأخر ولكن دفع قريباً (فاتورة قديمة + دفعة حديثة)
    const paidCustomer = await prisma.customer.create({
        data: {
            name: 'عميل دفع مؤخراً (تجربة)',
            phone: '01000000003',
            city: 'الجيزة',
            creditLimit: 10000,
            customerType: 'عادي',
            notes: 'كان متأخر ودفع - لا يجب أن يظهر أحمر'
        }
    });

    if (overdueVariant) {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 60); // فاتورة من 60 يوم

        const recentPaymentDate = new Date(); // دفعة اليوم

        // الفاتورة القديمة
        const sale = await prisma.sale.create({
            data: {
                customerId: paidCustomer.id,
                total: 2000,
                status: 'COMPLETED',
                invoiceDate: oldDate,
                createdAt: oldDate,
                items: {
                    create: {
                        variantId: overdueVariant.id,
                        quantity: 2,
                        price: 1000
                    }
                }
            }
        });

        await prisma.customerTransaction.create({
            data: {
                customerId: paidCustomer.id,
                date: oldDate,
                type: 'SALE',
                referenceType: 'SALE',
                referenceId: sale.id,
                debit: 2000,
                credit: 0,
                notes: 'فاتورة قديمة'
            }
        });

        // الدفعة الحديثة
        const payment = await prisma.customerPayment.create({
            data: {
                customerId: paidCustomer.id,
                paymentMethodId: createdPaymentMethods[0].id,
                amount: 500,
                paymentDate: recentPaymentDate,
                notes: 'دفعة جزئية حديثة'
            }
        });

        await prisma.customerTransaction.create({
            data: {
                customerId: paidCustomer.id,
                date: recentPaymentDate,
                type: 'PAYMENT',
                referenceType: 'PAYMENT',
                referenceId: payment.id,
                debit: 0,
                credit: 500,
                notes: 'دفعة حديثة'
            }
        });
    }

    console.log('\n✅ تم إنشاء جميع البيانات التجريبية بنجاح!\n');
    console.log('📊 ملخص البيانات:');
    console.log(`   • ${3} مستخدمين`);
    console.log(`   • ${createdCategories.length} فئات`);
    console.log(`   • ${createdProducts.length} منتج`);
    console.log(`   • ~${createdProducts.length * 3.5} variant تقريباً`);
    console.log(`   • ${createdCustomers.length} عميل`);
    console.log(`   • ${createdSuppliers.length} مورد`);
    console.log(`   • 30 فاتورة مشتريات`);
    console.log(`   • 100 فاتورة بيع`);
    console.log(`   • 80 دفعة عملاء`);
    console.log(`   • 15 فاتورة مرتجعات`);
    console.log(`   • 50 مصروف`);
    console.log('\n📋 معلومات تسجيل الدخول:');
    console.log('   المستخدم: admin');
    console.log('   كلمة المرور: 123456\n');
}

main()
    .catch((e) => {
        console.error('❌ خطأ في إنشاء البيانات:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

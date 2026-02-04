/**
 * عرض جميع الجداول والبيانات الموجودة فيهم
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showTables() {
  try {
    console.log('\n📊 عرض جميع الجداول والبيانات:\n');
    console.log('═'.repeat(60));

    // 1. User
    const users = await prisma.user.count();
    console.log(`\n👤 User: ${users} صف`);

    // 2. Category
    const categories = await prisma.category.findMany();
    console.log(`\n📦 Category: ${categories.length} صف`);
    categories.forEach(cat => {
      console.log(`   - ${cat.name} (ID: ${cat.id})`);
    });

    // 3. Product
    const products = await prisma.product.findMany({ include: { category: true } });
    console.log(`\n🛍️  Product: ${products.length} صف`);
    products.forEach(prod => {
      console.log(`   - ${prod.name} | السعر: ${prod.basePrice} ج.م (ID: ${prod.id})`);
    });

    // 4. Variant
    const variants = await prisma.variant.findMany();
    console.log(`\n🎨 Variant: ${variants.length} صف`);
    variants.forEach(var1 => {
      console.log(`   - المنتج #${var1.productId} | اللون: ${var1.color} | الحجم: ${var1.size}`);
    });

    // 5. Inventory
    const inventory = await prisma.inventory.findMany();
    console.log(`\n📍 Inventory: ${inventory.length} صف`);

    // 6. Customer
    const customers = await prisma.customer.findMany();
    console.log(`\n👥 Customer: ${customers.length} صف`);
    customers.forEach(cust => {
      console.log(`   - ${cust.name} | الرصيد: ${cust.balance} ج.م | متأخر: ${cust.lastPaymentDays} يوم`);
    });

    // 7. Sale
    const sales = await prisma.sale.findMany();
    console.log(`\n📄 Sale: ${sales.length} صف`);
    if (sales.length > 0) {
      const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
      const totalPaid = sales.reduce((sum, s) => sum + s.paid, 0);
      console.log(`   📊 إجمالي: ${totalSales} ج.م | المدفوع: ${totalPaid} ج.م | المتبقي: ${totalSales - totalPaid} ج.م`);
    }

    // 8. SaleItem
    const saleItems = await prisma.saleItem.findMany();
    console.log(`\n🧾 SaleItem: ${saleItems.length} صف`);

    // 9. Return
    const returns = await prisma.return.findMany();
    console.log(`\n↩️  Return: ${returns.length} صف`);

    // 10. ReturnItem
    const returnItems = await prisma.returnItem.findMany();
    console.log(`\n📦 ReturnItem: ${returnItems.length} صف`);

    // 11. CustomerPayment
    const payments = await prisma.customerPayment.findMany();
    console.log(`\n💰 CustomerPayment: ${payments.length} صف`);
    if (payments.length > 0) {
      const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
      console.log(`   💸 إجمالي الدفعات: ${totalPayments} ج.م`);
    }

    // 12. Supplier
    const suppliers = await prisma.supplier.findMany();
    console.log(`\n🏢 Supplier: ${suppliers.length} صف`);

    // 13. Purchase
    const purchases = await prisma.purchase.findMany();
    console.log(`\n🛒 Purchase: ${purchases.length} صف`);

    // 14. PurchaseItem
    const purchaseItems = await prisma.purchaseItem.findMany();
    console.log(`\n📋 PurchaseItem: ${purchaseItems.length} صف`);

    // 15. SupplierPayment
    const supplierPayments = await prisma.supplierPayment.findMany();
    console.log(`\n💳 SupplierPayment: ${supplierPayments.length} صف`);

    // 16. Expense
    const expenses = await prisma.expense.findMany();
    console.log(`\n💸 Expense: ${expenses.length} صف`);

    console.log('\n' + '═'.repeat(60));
    console.log('✅ انتهى العرض!\n');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

showTables();

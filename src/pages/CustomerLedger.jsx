import React, { useState, useEffect } from 'react';

export default function CustomerLedger({ customerId, onClose }) {
    const [customer, setCustomer] = useState(null);
    const [sales, setSales] = useState([]);
    const [returns, setReturns] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInvoice, setShowInvoice] = useState(null);

    useEffect(() => {
        loadCustomerData();
    }, [customerId]);

    const loadCustomerData = async () => {
        try {
            const [customerInfo, salesData, returnsData, paymentsData] = await Promise.all([
                window.api.getCustomer(customerId),
                window.api.getCustomerSales(customerId),
                window.api.getCustomerReturns(customerId),
                window.api.getCustomerPayments(customerId)
            ]);

            if (customerInfo.error) throw new Error(customerInfo.error);
            if (salesData.error) throw new Error(salesData.error);
            if (returnsData.error) throw new Error(returnsData.error);
            if (paymentsData.error) throw new Error(paymentsData.error);

            setCustomer(customerInfo);
            setSales(salesData);
            setReturns(returnsData);
            setPayments(paymentsData);
        } catch (err) {
            console.error('فشل تحميل البيانات:', err.message);
            setCustomer(null);
            setSales([]);
            setReturns([]);
            setPayments([]);
        } finally {
            setLoading(false);
        }
    };

    const getSaleDate = (sale) => {
        // استخدام invoiceDate إذا كان موجود، وإلا استخدام createdAt
        return sale.invoiceDate ? new Date(sale.invoiceDate) : new Date(sale.createdAt);
    };

    const getAllTransactions = () => {
        const transactions = [];

        sales.forEach(sale => {
            // Sale model لا يحتوي على paid field - كله يُعتبر مدين إذا كان آجل
            const remaining = sale.saleType === 'آجل' ? sale.total : 0;

            transactions.push({
                id: `sale-${sale.id}`,
                date: getSaleDate(sale),
                type: 'بيع',
                typeColor: '#3b82f6',
                description: `فاتورة بيع #${sale.id}`,
                debit: sale.saleType === 'آجل' ? remaining : 0,
                credit: 0,
                total: sale.total,
                paid: sale.saleType === 'نقدي' ? sale.total : 0,
                remaining: remaining,
                notes: sale.notes || '✓ بدون ملاحظات',
                details: sale
            });
        });

        returns.forEach(returnItem => {
            transactions.push({
                id: `return-${returnItem.id}`,
                date: new Date(returnItem.createdAt),
                type: 'مرتجع',
                typeColor: '#f59e0b',
                description: `مرتجع #${returnItem.id}`,
                debit: 0,
                credit: returnItem.total,
                total: returnItem.total,
                paid: returnItem.total,
                remaining: 0,
                notes: returnItem.notes || '✓ بدون ملاحظات',
                details: returnItem
            });
        });

        payments.forEach(payment => {
            transactions.push({
                id: `payment-${payment.id}`,
                date: payment.paymentDate ? new Date(payment.paymentDate) : new Date(payment.createdAt),
                type: 'دفعة',
                typeColor: '#10b981',
                description: `دفعة نقدية`,
                debit: 0,
                credit: payment.amount,
                total: payment.amount,
                paid: payment.amount,
                remaining: 0,
                notes: payment.notes || '✓ بدون ملاحظات',
                details: payment
            });
        });

        return transactions.sort((a, b) => b.date - a.date);
    };

    const printInvoice = (sale) => {
        const printWindow = window.open('', '_blank');
        const invoiceHTML = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة رقم ${sale.id}</title>
        <style>
          body { font-family: Arial; padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
          .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #000; padding: 8px; text-align: right; }
          th { background-color: #f0f0f0; }
          .total { text-align: left; font-size: 18px; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 50px; border-top: 1px solid #000; padding-top: 15px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⚡ ERP SYSTEM</h1>
          <h2>فاتورة بيع</h2>
        </div>
        
        <div class="info">
          <div>
            <strong>رقم الفاتورة:</strong> ${sale.id}<br>
            <strong>التاريخ:</strong> ${new Date(sale.createdAt).toLocaleDateString('ar-EG')}<br>
            <strong>نوع البيع:</strong> ${sale.saleType}
          </div>
          <div>
            <strong>العميل:</strong> ${customer?.name || 'عميل عادي'}<br>
            <strong>الهاتف:</strong> ${customer?.phone || '-'}<br>
            <strong>العنوان:</strong> ${customer?.address || '-'}
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الصنف</th>
              <th>المقاس</th>
              <th>اللون</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الخصم</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.variant.product.name}</td>
                <td>${item.variant.productSize}</td>
                <td>${item.variant.color}</td>
                <td>${item.quantity}</td>
                <td>${item.price.toFixed(2)} ج.م</td>
                <td>${item.discount ? item.discount.toFixed(2) : '0.00'} ج.م</td>
                <td>${((item.price - (item.discount || 0)) * item.quantity).toFixed(2)} ج.م</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="total">
          <div>المجموع: ${sale.total.toFixed(2)} ج.م</div>
          ${sale.discount > 0 ? `<div>الخصم: ${sale.discount.toFixed(2)} ج.م</div>` : ''}
          <div>نوع البيع: ${sale.saleType}</div>
          ${sale.saleType === 'آجل' ? `<div style="color: red;">آجل - سيتم إضافته للحساب</div>` : '<div style="color: green;">نقدي - مدفوع بالكامل</div>'}
        </div>
        
        <div class="footer">
          <p>شكراً لتعاملكم معنا</p>
          <button onclick="window.print()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; cursor: pointer; border-radius: 5px;">طباعة</button>
        </div>
      </body>
      </html>
    `;

        printWindow.document.write(invoiceHTML);
        printWindow.document.close();
    };

    const printPaymentReceipt = (payment) => {
        const printWindow = window.open('', '_blank');
        const receiptHTML = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>إيصال دفع رقم ${payment.id}</title>
        <style>
          body { font-family: Arial; padding: 20px; direction: rtl; max-width: 600px; margin: 0 auto; }
          .header { text-align: center; border: 2px solid #000; padding: 20px; margin-bottom: 20px; }
          .content { border: 1px solid #000; padding: 20px; }
          .row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px; border-bottom: 1px dashed #ccc; }
          .amount { font-size: 24px; font-weight: bold; color: #10b981; text-align: center; margin: 20px 0; padding: 15px; background: #f0fdf4; border-radius: 8px; }
          .footer { text-align: center; margin-top: 30px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⚡ ERP SYSTEM</h1>
          <h2>إيصال دفع / سند قبض</h2>
        </div>
        
        <div class="content">
          <div class="row">
            <strong>رقم الإيصال:</strong>
            <span>${payment.id}</span>
          </div>
          
          <div class="row">
            <strong>التاريخ:</strong>
            <span>${new Date(payment.createdAt).toLocaleDateString('ar-EG')} - ${new Date(payment.createdAt).toLocaleTimeString('ar-EG')}</span>
          </div>
          
          <div class="row">
            <strong>استلمنا من السيد/ة:</strong>
            <span>${customer?.name || '-'}</span>
          </div>
          
          <div class="row">
            <strong>الهاتف:</strong>
            <span>${customer?.phone || '-'}</span>
          </div>
          
          <div class="amount">
            المبلغ المستلم: ${payment.amount.toFixed(2)} ج.م<br>
            <span style="font-size: 14px; color: #6b7280;">(${numberToArabicWords(payment.amount)} جنيهاً مصرياً)</span>
          </div>
          
          ${payment.notes ? `
            <div class="row">
              <strong>ملاحظات:</strong>
              <span>${payment.notes}</span>
            </div>
          ` : ''}
          
          <div class="row">
            <strong>الرصيد المتبقي:</strong>
            <span style="color: ${(customer?.balance || 0) > 0 ? '#ef4444' : '#10b981'}; font-weight: bold;">
              ${(customer?.balance || 0).toFixed(2)} ج.م
            </span>
          </div>
        </div>
        
        <div class="footer">
          <p style="margin-top: 50px;">التوقيع: _________________</p>
          <p style="font-size: 12px; color: #6b7280;">تم الطباعة في: ${new Date().toLocaleString('ar-EG')}</p>
          <button onclick="window.print()" style="padding: 10px 20px; background: #10b981; color: white; border: none; cursor: pointer; border-radius: 5px; margin-top: 20px;">طباعة</button>
        </div>
      </body>
      </html>
    `;

        printWindow.document.write(receiptHTML);
        printWindow.document.close();
    };

    const numberToArabicWords = (num) => {
        // دالة بسيطة للتحويل
        const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
        const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
        const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

        const integerPart = Math.floor(num);
        if (integerPart < 10) return ones[integerPart];
        if (integerPart < 100) {
            const tensDigit = Math.floor(integerPart / 10);
            const onesDigit = integerPart % 10;
            return `${tens[tensDigit]} ${ones[onesDigit]}`.trim();
        }
        return `${integerPart}`;
    };

    const printFullLedger = () => {
        const transactions = getAllTransactions();
        const printWindow = window.open('', '_blank');
        const ledgerHTML = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشف حساب - ${customer?.name}</title>
        <style>
          body { font-family: Arial; padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
          .customer-info { background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: right; }
          th { background-color: #f0f0f0; }
          .summary { background: #f0fdf4; padding: 15px; border-radius: 8px; margin-top: 20px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⚡ ERP SYSTEM</h1>
          <h2>كشف حساب عميل</h2>
        </div>
        
        <div class="customer-info">
          <h3>بيانات العميل:</h3>
          <p><strong>الاسم:</strong> ${customer?.name}</p>
          <p><strong>الهاتف:</strong> ${customer?.phone || '-'}</p>
          <p><strong>العنوان:</strong> ${customer?.address || '-'}</p>
          <p><strong>تاريخ الكشف:</strong> ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>البيان</th>
              <th>له (دائن)</th>
              <th>عليه (مدين)</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(t => `
              <tr>
                <td>${t.date.toLocaleDateString('ar-EG')}</td>
                <td>${t.description}</td>
                <td style="color: #ef4444;">${t.debit > 0 ? t.debit.toFixed(2) + ' ج.م' : '-'}</td>
                <td style="color: #10b981;">${t.credit > 0 ? t.credit.toFixed(2) + ' ج.م' : '-'}</td>
                <td>${t.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="summary">
          <h3>ملخص الحساب:</h3>
          <p><strong>إجمالي المبيعات:</strong> ${transactions.filter(t => t.type === 'بيع').reduce((sum, t) => sum + t.debit, 0).toFixed(2)} ج.م</p>
          <p><strong>إجمالي المرتجعات:</strong> ${transactions.filter(t => t.type === 'مرتجع').reduce((sum, t) => sum + t.credit, 0).toFixed(2)} ج.م</p>
          <p><strong>إجمالي الدفعات:</strong> ${transactions.filter(t => t.type === 'دفعة').reduce((sum, t) => sum + t.credit, 0).toFixed(2)} ج.م</p>
          <p style="font-size: 18px; color: ${(customer?.balance || 0) > 0 ? '#ef4444' : '#10b981'};"><strong>الرصيد الحالي:</strong> ${(customer?.balance || 0).toFixed(2)} ج.م</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; cursor: pointer; border-radius: 5px;">طباعة</button>
        </div>
      </body>
      </html>
    `;

        printWindow.document.write(ledgerHTML);
        printWindow.document.close();
    };

    const transactions = getAllTransactions();
    const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = transactions.reduce((sum, t) => sum + t.credit, 0);

    if (loading) return <div>جاري التحميل...</div>;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                width: '95%',
                maxWidth: '1200px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '2px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2>📋 كشف حساب: {customer?.name}</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={printFullLedger}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer'
                            }}
                        >
                            🖨️ طباعة الكشف
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#6b7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer'
                            }}
                        >
                            ✕ إغلاق
                        </button>
                    </div>
                </div>

                {/* Customer Info */}
                <div style={{
                    padding: '20px',
                    backgroundColor: '#f9fafb',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '15px'
                }}>
                    <div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>الهاتف</div>
                        <div style={{ fontWeight: 'bold' }}>{customer?.phone || '-'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>العنوان</div>
                        <div style={{ fontWeight: 'bold' }}>{customer?.address || '-'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>الرصيد الحالي</div>
                        <div style={{
                            fontWeight: 'bold',
                            fontSize: '18px',
                            color: (customer?.balance || 0) > 0 ? '#ef4444' : (customer?.balance || 0) < 0 ? '#10b981' : '#6b7280'
                        }}>
                            {(customer?.balance || 0).toFixed(2)} ج.م
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>عدد المعاملات</div>
                        <div style={{ fontWeight: 'bold' }}>{transactions.length}</div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>التاريخ</th>
                                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>النوع</th>
                                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>البيان</th>
                                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>الإجمالي</th>
                                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>المدفوع</th>
                                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>المتبقي</th>
                                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>ملاحظات</th>
                                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>
                                        لا توجد معاملات
                                    </td>
                                </tr>
                            ) : (
                                transactions.map(transaction => (
                                    <tr key={transaction.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '12px' }}>
                                            {transaction.date.toLocaleDateString('ar-EG')}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                backgroundColor: transaction.typeColor + '20',
                                                color: transaction.typeColor
                                            }}>
                                                {transaction.type}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px' }}>{transaction.description}</td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                                            {transaction.total.toFixed(2)} ج.م
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', color: '#10b981', fontWeight: 'bold' }}>
                                            {transaction.paid.toFixed(2)} ج.م
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: transaction.remaining > 0 ? '#ef4444' : '#10b981' }}>
                                            {transaction.remaining.toFixed(2)} ج.م
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: '#6b7280' }}>
                                            {transaction.notes}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                {transaction.type === 'بيع' && (
                                                    <>
                                                        <button
                                                            onClick={() => printInvoice(transaction.details)}
                                                            title="طباعة الفاتورة"
                                                            style={{
                                                                padding: '6px 10px',
                                                                backgroundColor: '#3b82f6',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            🖨️
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                // تعديل الفاتورة
                                                                if (window.confirm('هل تريد تعديل هذه الفاتورة؟')) {
                                                                    // يتم التعديل من صفحة المبيعات
                                                                    window.dispatchEvent(new CustomEvent('editSale', { detail: transaction.details }));
                                                                }
                                                            }}
                                                            title="تعديل الفاتورة"
                                                            style={{
                                                                padding: '6px 10px',
                                                                backgroundColor: '#f59e0b',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm(`هل تريد حذف فاتورة رقم ${transaction.details.id}؟`)) {
                                                                    window.api.deleteSale(transaction.details.id).then(result => {
                                                                        if (result.error) {
                                                                            alert('خطأ: ' + result.error);
                                                                        } else {
                                                                            alert('✅ تم حذف الفاتورة بنجاح');
                                                                            loadCustomerData();
                                                                        }
                                                                    }).catch(err => {
                                                                        alert('خطأ في الحذف: ' + err.message);
                                                                    });
                                                                }
                                                            }}
                                                            title="حذف الفاتورة"
                                                            style={{
                                                                padding: '6px 10px',
                                                                backgroundColor: '#ef4444',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </>
                                                )}
                                                {transaction.type === 'دفعة' && (
                                                    <>
                                                        <button
                                                            onClick={() => printPaymentReceipt(transaction.details)}
                                                            title="طباعة إيصال الدفع"
                                                            style={{
                                                                padding: '6px 10px',
                                                                backgroundColor: '#10b981',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            🖨️
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm(`هل تريد حذف الدفعة رقم ${transaction.details.id}؟`)) {
                                                                    window.api.deleteCustomerPayment(transaction.details.id).then(result => {
                                                                        if (result.error) {
                                                                            alert('خطأ: ' + result.error);
                                                                        } else {
                                                                            alert('✅ تم حذف الدفعة بنجاح');
                                                                            loadCustomerData();
                                                                        }
                                                                    }).catch(err => {
                                                                        alert('خطأ في الحذف: ' + err.message);
                                                                    });
                                                                }
                                                            }}
                                                            title="حذف الدفعة"
                                                            style={{
                                                                padding: '6px 10px',
                                                                backgroundColor: '#ef4444',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Summary */}
                <div style={{
                    padding: '20px',
                    borderTop: '2px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '15px'
                }}>
                    <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>إجمالي المبيعات</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>
                            {transactions.filter(t => t.type === 'بيع').reduce((sum, t) => sum + t.total, 0).toFixed(2)} ج.م
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>إجمالي المدفوع</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>
                            {transactions.filter(t => t.type !== 'مرتجع').reduce((sum, t) => sum + t.paid, 0).toFixed(2)} ج.م
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>إجمالي المتبقي</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>
                            {transactions.filter(t => t.type === 'بيع').reduce((sum, t) => sum + t.remaining, 0).toFixed(2)} ج.م
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>الرصيد النهائي</div>
                        <div style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: (customer?.balance || 0) > 0 ? '#ef4444' : (customer?.balance || 0) < 0 ? '#10b981' : '#6b7280'
                        }}>
                            {(customer?.balance || 0).toFixed(2)} ج.م
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Invoice Print Template
 * Returns pure HTML string for printing
 */

export const generateInvoiceHTML = (sale, customer) => {
  return `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>فاتورة رقم ${sale.id}</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      padding: 20px; 
      direction: rtl; 
      margin: 0;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px; 
      border-bottom: 2px solid #000; 
      padding-bottom: 15px; 
    }
    .header h1 { margin: 0 0 10px 0; font-size: 24px; }
    .header h2 { margin: 0; font-size: 18px; color: #333; }
    .info { 
      display: flex; 
      justify-content: space-between; 
      margin-bottom: 20px; 
      gap: 20px;
    }
    .info > div { flex: 1; }
    .info strong { display: inline-block; min-width: 100px; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 20px 0; 
    }
    th, td { 
      border: 1px solid #000; 
      padding: 8px; 
      text-align: right; 
    }
    th { 
      background-color: #f0f0f0; 
      font-weight: bold;
    }
    .total { 
      text-align: left; 
      font-size: 18px; 
      font-weight: bold; 
      margin-top: 20px; 
      padding: 15px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .total > div { margin: 5px 0; }
    .footer { 
      margin-top: 50px; 
      border-top: 1px solid #000; 
      padding-top: 15px; 
      text-align: center;
    }
    .print-button {
      padding: 12px 30px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      margin: 10px;
    }
    .print-button:hover {
      background: #2563eb;
    }
    @media print { 
      body { padding: 10px; }
      .print-button { display: none; }
      .no-print { display: none; }
    }
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
    ${sale.saleType === 'آجل' 
      ? '<div style="color: red;">آجل - سيتم إضافته للحساب</div>' 
      : '<div style="color: green;">نقدي - مدفوع بالكامل</div>'}
  </div>
  
  <div class="footer">
    <p>شكراً لتعاملكم معنا</p>
    <p style="font-size: 12px; color: #6b7280;">تم الطباعة في: ${new Date().toLocaleString('ar-EG')}</p>
    <div class="no-print">
      <button class="print-button" onclick="if(window.electronAPI){window.electronAPI.triggerPrint()}else{window.print()}">🖨️ طباعة الفاتورة</button>
    </div>
  </div>
  
  <script>
    // استخدام IPC إذا كان متاحاً، وإلا window.print
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.triggerPrint) {
          window.electronAPI.triggerPrint();
        } else {
          window.print();
        }
      }
    });
  </script>
</body>
</html>
  `.trim();
};

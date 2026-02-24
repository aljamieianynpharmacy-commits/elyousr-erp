const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getSaleDate = (sale) => sale?.invoiceDate || sale?.createdAt || new Date().toISOString();

export const generateInvoiceA4HTML = ({ sale, customer, company }) => {
  const safeSale = sale || {};
  const safeCustomer = customer || safeSale?.customer || null;
  const items = Array.isArray(safeSale?.items) ? safeSale.items : [];

  const subTotal = items.reduce((sum, item) => (
    sum + (toNumber(item?.price) * toNumber(item?.quantity))
  ), 0);
  const itemsDiscount = items.reduce((sum, item) => (
    sum + (toNumber(item?.discount) * toNumber(item?.quantity))
  ), 0);
  const invoiceDiscount = toNumber(safeSale?.discount);
  const calculatedTotal = Math.max(0, subTotal - itemsDiscount - invoiceDiscount);
  const finalTotal = Math.max(0, toNumber(safeSale?.total, calculatedTotal));
  const paidAmount = Math.max(0, toNumber(safeSale?.paid ?? safeSale?.paidAmount, 0));
  const remaining = Math.max(0, finalTotal - paidAmount);

  const companyName = escapeHtml(company?.name || 'ERP SYSTEM');
  const companyContactNumbers = escapeHtml(company?.contactNumbers || '');
  const companyAddress = escapeHtml(company?.address || '');
  const saleType = escapeHtml(safeSale?.saleType || (remaining > 0 ? 'آجل' : 'نقدي'));
  const saleId = escapeHtml(safeSale?.id || '-');
  const customerName = escapeHtml(safeCustomer?.name || 'عميل نقدي');
  const customerPhone = escapeHtml(safeCustomer?.phone || '-');
  const customerAddress = escapeHtml(safeCustomer?.address || '-');
  const printedAt = new Date().toLocaleString('ar-EG');
  const saleDate = new Date(getSaleDate(safeSale)).toLocaleDateString('ar-EG');

  return `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>فاتورة رقم ${saleId}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      direction: rtl;
      margin: 0;
      color: #111827;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #111827;
      padding-bottom: 15px;
    }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; }
    .header h2 { margin: 0; font-size: 18px; color: #374151; }
    .header .meta-line { margin-top: 4px; color: #374151; }
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
      border: 1px solid #111827;
      padding: 8px;
      text-align: right;
      vertical-align: top;
    }
    th {
      background-color: #f3f4f6;
      font-weight: bold;
    }
    .total {
      text-align: left;
      font-size: 16px;
      font-weight: bold;
      margin-top: 20px;
      padding: 15px;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .total > div { margin: 6px 0; }
    .footer {
      margin-top: 40px;
      border-top: 1px solid #d1d5db;
      padding-top: 15px;
      text-align: center;
      color: #6b7280;
    }
    .print-button {
      padding: 12px 28px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      margin-top: 12px;
    }
    .print-button:hover { background: #1d4ed8; }
    @media print {
      body { padding: 10px; }
      .print-button, .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${companyName}</h1>
    ${companyContactNumbers ? `<div class="meta-line">هاتف: ${companyContactNumbers}</div>` : ''}
    ${companyAddress ? `<div class="meta-line">العنوان: ${companyAddress}</div>` : ''}
    <h2>فاتورة بيع</h2>
  </div>

  <div class="info">
    <div>
      <strong>رقم الفاتورة:</strong> ${saleId}<br>
      <strong>التاريخ:</strong> ${saleDate}<br>
      <strong>نوع البيع:</strong> ${saleType}
    </div>
    <div>
      <strong>العميل:</strong> ${customerName}<br>
      <strong>الهاتف:</strong> ${customerPhone}<br>
      <strong>العنوان:</strong> ${customerAddress}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>الصنف</th>
        <th>المواصفات</th>
        <th>الكمية</th>
        <th>السعر</th>
        <th>الخصم</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item, index) => {
        const name = escapeHtml(item?.variant?.product?.name || item?.productName || 'صنف');
        const size = escapeHtml(item?.variant?.productSize || item?.size || '');
        const color = escapeHtml(item?.variant?.color || item?.color || '');
        const specs = [size, color].filter(Boolean).join(' - ') || '-';
        const quantity = toNumber(item?.quantity);
        const price = toNumber(item?.price);
        const discount = toNumber(item?.discount);
        const lineTotal = Math.max(0, (price - discount) * quantity);
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${name}</td>
            <td>${escapeHtml(specs)}</td>
            <td>${quantity}</td>
            <td>${price.toFixed(2)} ج.م</td>
            <td>${discount.toFixed(2)} ج.م</td>
            <td>${lineTotal.toFixed(2)} ج.م</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="total">
    <div>الإجمالي الفرعي: ${subTotal.toFixed(2)} ج.م</div>
    ${itemsDiscount > 0 ? `<div>خصم الأصناف: ${itemsDiscount.toFixed(2)} ج.م</div>` : ''}
    ${invoiceDiscount > 0 ? `<div>خصم الفاتورة: ${invoiceDiscount.toFixed(2)} ج.م</div>` : ''}
    <div>الصافي: ${finalTotal.toFixed(2)} ج.م</div>
    <div>المدفوع: ${paidAmount.toFixed(2)} ج.م</div>
    <div style="color: ${remaining > 0 ? '#b91c1c' : '#15803d'};">
      ${remaining > 0 ? 'المتبقي' : 'الحالة'}: ${remaining > 0 ? `${remaining.toFixed(2)} ج.م` : 'مدفوع بالكامل'}
    </div>
  </div>

  <div class="footer">
    <div>شكراً لتعاملكم معنا</div>
    <div style="font-size: 12px;">تم الطباعة في: ${printedAt}</div>
    <div class="no-print">
      <button class="print-button" onclick="if(window.electronAPI){window.electronAPI.triggerPrint()}else{window.print()}">طباعة الفاتورة</button>
    </div>
  </div>

  <script>
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


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

const getPurchaseDate = (purchase) => purchase?.invoiceDate || purchase?.createdAt || new Date().toISOString();

export const generatePurchaseInvoiceA4HTML = ({ purchase, company }) => {
  const safePurchase = purchase || {};
  const supplier = safePurchase?.supplier || safePurchase?.customer || null;
  const items = Array.isArray(safePurchase?.items) ? safePurchase.items : [];

  const subTotal = items.reduce((sum, item) => (
    sum + (toNumber(item?.price ?? item?.cost) * toNumber(item?.quantity))
  ), 0);
  const invoiceDiscount = Math.max(0, toNumber(safePurchase?.discount, 0));
  const calculatedTotal = Math.max(0, subTotal - invoiceDiscount);
  const finalTotal = Math.max(0, toNumber(safePurchase?.total, calculatedTotal));
  const paidAmount = Math.max(0, toNumber(safePurchase?.paidAmount ?? safePurchase?.paid, 0));
  const remaining = Math.max(0, finalTotal - paidAmount);

  const companyName = escapeHtml(company?.name || 'ERP SYSTEM');
  const companyContactNumbers = escapeHtml(company?.contactNumbers || '');
  const companyAddress = escapeHtml(company?.address || '');
  const supplierName = escapeHtml(supplier?.name || 'مورد عام');
  const supplierPhone = escapeHtml(supplier?.phone || '');
  const purchaseId = escapeHtml(safePurchase?.id || '-');
  const paymentLabel = escapeHtml(
    safePurchase?.payment
      || safePurchase?.paymentMethod?.name
      || safePurchase?.purchaseType
      || '-'
  );
  const purchaseDate = new Date(getPurchaseDate(safePurchase)).toLocaleString('ar-EG');
  const printedAt = new Date().toLocaleString('ar-EG');

  const rowsHtml = items.map((item, index) => {
    const name = escapeHtml(item?.variant?.product?.name || item?.productName || 'صنف');
    const size = escapeHtml(item?.variant?.productSize || item?.size || '');
    const color = escapeHtml(item?.variant?.color || item?.color || '');
    const specs = [size, color].filter(Boolean).join(' - ');
    const quantity = Math.max(0, toNumber(item?.quantity, 0));
    const unitCost = Math.max(0, toNumber(item?.price ?? item?.cost, 0));
    const lineTotal = unitCost * quantity;

    return `
      <tr>
        <td>${index + 1}</td>
        <td>
          <div>${name}</div>
          ${specs ? `<div class="item-meta">${escapeHtml(specs)}</div>` : ''}
        </td>
        <td>${quantity}</td>
        <td>${unitCost.toFixed(2)}</td>
        <td>${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>فاتورة مشتريات رقم ${purchaseId}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 18px;
      font-family: "Segoe UI", Tahoma, sans-serif;
      color: #111827;
      background: #ffffff;
      direction: rtl;
    }
    .container {
      max-width: 210mm;
      margin: 0 auto;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      padding: 18px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #111827;
      margin-bottom: 12px;
      padding-bottom: 10px;
    }
    .header .name { font-size: 25px; font-weight: 800; }
    .header .line { font-size: 13px; margin-top: 3px; color: #374151; }
    .title {
      text-align: center;
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 10px;
      color: #0f766e;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 12px;
    }
    .meta-box {
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 10px;
      background: #f9fafb;
      font-size: 13px;
      line-height: 1.6;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8px;
      font-size: 13px;
      text-align: right;
      vertical-align: top;
    }
    th {
      background: #f3f4f6;
      font-weight: 700;
    }
    .item-meta {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }
    .totals {
      margin-right: auto;
      max-width: 360px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 10px;
      background: #f9fafb;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 6px 0;
      font-size: 14px;
    }
    .total-row.final {
      border-top: 1px solid #d1d5db;
      padding-top: 8px;
      font-size: 17px;
      font-weight: 800;
      color: #0f766e;
    }
    .footer {
      margin-top: 16px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    .print-button {
      margin-top: 10px;
      border: none;
      border-radius: 6px;
      background: #2563eb;
      color: #fff;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    @media print {
      body { padding: 0; }
      .container { border: none; border-radius: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="name">${companyName}</div>
      ${companyContactNumbers ? `<div class="line">هاتف: ${companyContactNumbers}</div>` : ''}
      ${companyAddress ? `<div class="line">العنوان: ${companyAddress}</div>` : ''}
    </div>

    <div class="title">فاتورة مشتريات</div>

    <div class="meta">
      <div class="meta-box">
        <div><strong>رقم الفاتورة:</strong> #${purchaseId}</div>
        <div><strong>التاريخ:</strong> ${escapeHtml(purchaseDate)}</div>
        <div><strong>طريقة الدفع:</strong> ${paymentLabel}</div>
      </div>
      <div class="meta-box">
        <div><strong>المورد:</strong> ${supplierName}</div>
        <div><strong>الهاتف:</strong> ${supplierPhone || '-'}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:48px;">#</th>
          <th>الصنف</th>
          <th style="width:90px;">الكمية</th>
          <th style="width:110px;">سعر الشراء</th>
          <th style="width:120px;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="5" style="text-align:center">لا توجد أصناف</td></tr>'}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row"><span>الإجمالي الفرعي</span><span>${subTotal.toFixed(2)} ج.م</span></div>
      ${invoiceDiscount > 0 ? `<div class="total-row"><span>الخصم</span><span>- ${invoiceDiscount.toFixed(2)} ج.م</span></div>` : ''}
      <div class="total-row"><span>المدفوع</span><span>${paidAmount.toFixed(2)} ج.م</span></div>
      <div class="total-row final"><span>المتبقي</span><span>${remaining.toFixed(2)} ج.م</span></div>
    </div>

    <div class="footer">
      <div>تم الطباعة: ${escapeHtml(printedAt)}</div>
      <div class="no-print">
        <button class="print-button" onclick="if(window.electronAPI){window.electronAPI.triggerPrint({ silent: true })}else{window.print()}">طباعة الفاتورة</button>
      </div>
    </div>
  </div>

  <script>
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.triggerPrint) {
          window.electronAPI.triggerPrint({ silent: true });
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


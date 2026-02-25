import {
  getCompanyPrintSettings,
  getDefaultInvoicePrintLayout,
  normalizeInvoicePrintLayout
} from '../src/utils/appSettings';

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

const getReturnDate = (returnInvoice) => (
  returnInvoice?.returnDate
  || returnInvoice?.createdAt
  || new Date().toISOString()
);

const buildReturnLines = (returnInvoice) => {
  const items = Array.isArray(returnInvoice?.items) ? returnInvoice.items : [];
  return items.map((item) => {
    const quantity = Math.max(0, toNumber(item?.quantity));
    const price = Math.max(0, toNumber(item?.price));
    return {
      name: escapeHtml(item?.variant?.product?.name || item?.productName || 'صنف'),
      size: escapeHtml(item?.variant?.productSize || item?.size || ''),
      color: escapeHtml(item?.variant?.color || item?.color || ''),
      quantity,
      price,
      total: quantity * price
    };
  });
};

const baseReturnData = (returnInvoice, customer, company) => {
  const safeReturn = returnInvoice || {};
  const safeCustomer = customer || safeReturn?.customer || null;
  const lines = buildReturnLines(safeReturn);
  const computedTotal = lines.reduce((sum, line) => sum + line.total, 0);
  const total = Math.max(0, toNumber(safeReturn?.total, computedTotal));

  return {
    safeReturn,
    safeCustomer,
    companyName: escapeHtml(company?.name || 'ERP SYSTEM'),
    companyContactNumbers: escapeHtml(company?.contactNumbers || ''),
    companyAddress: escapeHtml(company?.address || ''),
    returnId: escapeHtml(safeReturn?.id || '-'),
    saleId: escapeHtml(safeReturn?.saleId || '-'),
    customerName: escapeHtml(safeCustomer?.name || 'عميل نقدي'),
    customerPhone: escapeHtml(safeCustomer?.phone || ''),
    customerAddress: escapeHtml(safeCustomer?.address || ''),
    notes: escapeHtml(safeReturn?.notes || ''),
    dateLine: new Date(getReturnDate(safeReturn)).toLocaleString('ar-EG'),
    printedAt: new Date().toLocaleString('ar-EG'),
    lines,
    total
  };
};

export const generateReturnInvoiceA4HTML = ({ returnInvoice, customer, company }) => {
  const data = baseReturnData(returnInvoice, customer, company);

  return `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>مرتجع رقم ${data.returnId}</title>
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
      margin-bottom: 24px;
      border-bottom: 2px solid #111827;
      padding-bottom: 12px;
    }
    .header h1 { margin: 0 0 8px; font-size: 24px; }
    .header h2 { margin: 0; font-size: 18px; color: #374151; }
    .header .meta-line { margin-top: 4px; color: #374151; }
    .info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 18px;
      font-size: 14px;
    }
    .info strong { display: inline-block; min-width: 110px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #111827;
      padding: 8px;
      text-align: right;
    }
    th { background: #f3f4f6; }
    .totals {
      margin-top: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #f9fafb;
      font-size: 15px;
      font-weight: 700;
    }
    .notes {
      margin-top: 12px;
      border-top: 1px dashed #9ca3af;
      padding-top: 10px;
      color: #374151;
      font-size: 13px;
    }
    .footer {
      margin-top: 24px;
      text-align: center;
      color: #6b7280;
      border-top: 1px solid #d1d5db;
      padding-top: 10px;
    }
    .print-button {
      margin-top: 10px;
      padding: 11px 24px;
      border: none;
      border-radius: 6px;
      background: #2563eb;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    .print-button:hover { background: #1d4ed8; }
    @media print {
      body { padding: 10px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${data.companyName}</h1>
    ${data.companyContactNumbers ? `<div class="meta-line">هاتف: ${data.companyContactNumbers}</div>` : ''}
    ${data.companyAddress ? `<div class="meta-line">العنوان: ${data.companyAddress}</div>` : ''}
    <h2>فاتورة مرتجع</h2>
  </div>

  <div class="info">
    <div>
      <div><strong>رقم المرتجع:</strong> #${data.returnId}</div>
      <div><strong>فاتورة البيع:</strong> #${data.saleId}</div>
      <div><strong>التاريخ:</strong> ${data.dateLine}</div>
    </div>
    <div>
      <div><strong>العميل:</strong> ${data.customerName}</div>
      ${data.customerPhone ? `<div><strong>الهاتف:</strong> ${data.customerPhone}</div>` : ''}
      ${data.customerAddress ? `<div><strong>العنوان:</strong> ${data.customerAddress}</div>` : ''}
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
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${data.lines.map((line, index) => {
        const specs = [line.size, line.color].filter(Boolean).join(' - ') || '-';
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${line.name}</td>
            <td>${escapeHtml(specs)}</td>
            <td>${line.quantity}</td>
            <td>${line.price.toFixed(2)} ج.م</td>
            <td>${line.total.toFixed(2)} ج.م</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="totals">إجمالي المرتجع: ${data.total.toFixed(2)} ج.م</div>

  ${data.notes ? `<div class="notes"><strong>ملاحظات:</strong> ${data.notes}</div>` : ''}

  <div class="footer">
    <div>تم الطباعة: ${escapeHtml(data.printedAt)}</div>
    <div>شكراً لتعاملكم معنا</div>
    <div class="no-print">
      <button class="print-button" onclick="if(window.electronAPI){window.electronAPI.triggerPrint({ silent: true })}else{window.print()}">طباعة</button>
    </div>
  </div>
</body>
</html>
  `.trim();
};

export const generateReturnInvoiceReceipt80HTML = ({ returnInvoice, customer, company }) => {
  const data = baseReturnData(returnInvoice, customer, company);

  return `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>مرتجع رقم ${data.returnId}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      width: 80mm;
      margin: 0 auto;
      padding: 4mm;
      font-family: "Segoe UI", Tahoma, sans-serif;
      font-size: 12px;
      color: #111827;
      direction: rtl;
      background: #fff;
    }
    .center { text-align: center; }
    .line { margin: 2px 0; }
    .divider { border-top: 1px dashed #111827; margin: 7px 0; }
    .divider-solid { border-top: 2px solid #111827; margin: 7px 0; }
    .item { border-bottom: 1px dotted #9ca3af; padding: 5px 0; }
    .item:last-child { border-bottom: none; }
    .item-title { font-weight: 700; }
    .item-meta { color: #6b7280; font-size: 10px; }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .total {
      font-size: 16px;
      font-weight: 800;
      border-top: 2px solid #111827;
      border-bottom: 2px solid #111827;
      padding: 6px 0;
      margin: 8px 0;
    }
    .print-button {
      margin-top: 8px;
      width: 100%;
      border: none;
      border-radius: 6px;
      background: #2563eb;
      color: #fff;
      padding: 10px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    @media print {
      @page { size: 80mm auto; margin: 0; }
      body { width: 80mm; padding: 3mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="center">
    <div style="font-size: 17px; font-weight: 800;">${data.companyName}</div>
    ${data.companyContactNumbers ? `<div class="line">هاتف: ${data.companyContactNumbers}</div>` : ''}
    ${data.companyAddress ? `<div class="line">العنوان: ${data.companyAddress}</div>` : ''}
  </div>

  <div class="divider-solid"></div>

  <div class="row"><span>مرتجع:</span><strong>#${data.returnId}</strong></div>
  <div class="row"><span>فاتورة البيع:</span><span>#${data.saleId}</span></div>
  <div class="row"><span>التاريخ:</span><span>${data.dateLine}</span></div>
  <div class="row"><span>العميل:</span><span>${data.customerName}</span></div>
  ${data.customerPhone ? `<div class="row"><span>الهاتف:</span><span>${data.customerPhone}</span></div>` : ''}

  <div class="divider-solid"></div>

  ${data.lines.map((line, index) => {
    const specs = [line.size, line.color].filter(Boolean).join(' - ');
    return `
      <div class="item">
        <div class="item-title">${index + 1}. ${line.name}</div>
        ${specs ? `<div class="item-meta">${escapeHtml(specs)}</div>` : ''}
        <div class="row"><span>${line.quantity} × ${line.price.toFixed(2)}</span><span>${line.total.toFixed(2)}</span></div>
      </div>
    `;
  }).join('')}

  <div class="total row"><span>الإجمالي:</span><span>${data.total.toFixed(2)} ج.م</span></div>

  ${data.notes ? `<div class="line"><strong>ملاحظات:</strong> ${data.notes}</div>` : ''}

  <div class="divider"></div>
  <div class="center" style="color:#6b7280; font-size: 10px;">
    <div>تم الطباعة: ${escapeHtml(data.printedAt)}</div>
    <div>شكراً لتعاملكم معنا</div>
    <div class="no-print">
      <button class="print-button" onclick="if(window.electronAPI){window.electronAPI.triggerPrint({ silent: true })}else{window.print()}">طباعة</button>
    </div>
  </div>
</body>
</html>
  `.trim();
};

export const RETURN_INVOICE_PRINT_LAYOUTS = Object.freeze({
  RECEIPT_80: 'receipt80',
  A4: 'a4'
});

export const resolveReturnInvoicePrintLayout = (layout) => normalizeInvoicePrintLayout(
  layout || getDefaultInvoicePrintLayout()
);

export const generateReturnInvoiceHTML = (returnInvoice, customer, options = {}) => {
  const company = options.company || getCompanyPrintSettings();
  const layout = resolveReturnInvoicePrintLayout(options.layout);

  if (layout === RETURN_INVOICE_PRINT_LAYOUTS.A4) {
    return generateReturnInvoiceA4HTML({ returnInvoice, customer, company });
  }

  return generateReturnInvoiceReceipt80HTML({ returnInvoice, customer, company });
};

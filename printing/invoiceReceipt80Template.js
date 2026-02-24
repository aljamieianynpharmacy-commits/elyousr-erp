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

export const generateInvoiceReceipt80HTML = ({ sale, customer, company }) => {
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
  const customerPhone = escapeHtml(safeCustomer?.phone || '');
  const saleDate = new Date(getSaleDate(safeSale));
  const dateLine = saleDate.toLocaleString('ar-EG');
  const printedAt = new Date().toLocaleString('ar-EG');

  const itemsHtml = items.map((item, index) => {
    const name = escapeHtml(item?.variant?.product?.name || item?.productName || 'صنف');
    const size = escapeHtml(item?.variant?.productSize || item?.size || '');
    const color = escapeHtml(item?.variant?.color || item?.color || '');
    const specs = [size, color].filter(Boolean).join(' - ');
    const quantity = toNumber(item?.quantity);
    const price = toNumber(item?.price);
    const discount = toNumber(item?.discount);
    const lineTotal = Math.max(0, (price - discount) * quantity);

    return `
      <div class="item">
        <div class="item-name">${index + 1}. ${name}</div>
        ${specs ? `<div class="item-specs">${escapeHtml(specs)}</div>` : ''}
        <div class="item-line">
          <span>${quantity} × ${price.toFixed(2)}</span>
          <span>${lineTotal.toFixed(2)}</span>
        </div>
        ${discount > 0 ? `<div class="item-discount">خصم: ${discount.toFixed(2)} لكل وحدة</div>` : ''}
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>فاتورة رقم ${saleId}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      width: 80mm;
      margin: 0 auto;
      padding: 4mm;
      font-family: "Segoe UI", Tahoma, sans-serif;
      font-size: 12px;
      color: #111827;
      line-height: 1.45;
      direction: rtl;
      background: #ffffff;
    }
    .center { text-align: center; }
    .divider { border-top: 1px dashed #111827; margin: 7px 0; }
    .divider-solid { border-top: 2px solid #111827; margin: 7px 0; }
    .header { text-align: center; }
    .header .name { font-size: 17px; font-weight: 800; margin-bottom: 3px; }
    .header .line { font-size: 11px; margin: 1px 0; }
    .meta-row, .total-row, .item-line {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .meta-row { margin: 3px 0; }
    .customer {
      border: 1px solid #111827;
      border-radius: 4px;
      padding: 6px;
      margin: 7px 0;
    }
    .customer .name { font-weight: 700; margin-bottom: 2px; }
    .items-header {
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      padding-bottom: 4px;
      border-bottom: 1px solid #111827;
      margin-bottom: 4px;
    }
    .item { padding: 5px 0; border-bottom: 1px dotted #9ca3af; }
    .item:last-child { border-bottom: none; }
    .item-name { font-weight: 700; }
    .item-specs { font-size: 10px; color: #4b5563; }
    .item-discount { font-size: 10px; color: #991b1b; margin-top: 2px; }
    .totals .total-row { margin: 3px 0; }
    .totals .final {
      font-size: 15px;
      font-weight: 800;
      border-top: 2px solid #111827;
      border-bottom: 2px solid #111827;
      padding: 5px 0;
      margin: 7px 0;
    }
    .status { font-weight: 700; margin-top: 6px; text-align: center; }
    .status.credit { color: #b91c1c; }
    .status.paid { color: #15803d; }
    .footer { text-align: center; margin-top: 10px; font-size: 10px; color: #6b7280; }
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
    .print-button:hover { background: #1d4ed8; }
    @media print {
      @page { size: 80mm auto; margin: 0; }
      body { width: 80mm; padding: 3mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="name">${companyName}</div>
    ${companyContactNumbers ? `<div class="line">هاتف: ${companyContactNumbers}</div>` : ''}
    ${companyAddress ? `<div class="line">العنوان: ${companyAddress}</div>` : ''}
  </div>

  <div class="divider-solid"></div>

  <div class="meta">
    <div class="meta-row"><span>فاتورة رقم:</span><strong>#${saleId}</strong></div>
    <div class="meta-row"><span>التاريخ:</span><span>${escapeHtml(dateLine)}</span></div>
    <div class="meta-row"><span>نوع البيع:</span><span>${saleType}</span></div>
  </div>

  <div class="customer">
    <div class="name">${customerName}</div>
    ${customerPhone ? `<div>هاتف: ${customerPhone}</div>` : ''}
  </div>

  <div class="items-header">
    <span>الصنف</span>
    <span>المبلغ</span>
  </div>

  <div class="items">${itemsHtml}</div>

  <div class="divider-solid"></div>

  <div class="totals">
    <div class="total-row"><span>الإجمالي الفرعي:</span><span>${subTotal.toFixed(2)}</span></div>
    ${itemsDiscount > 0 ? `<div class="total-row"><span>خصم الأصناف:</span><span>- ${itemsDiscount.toFixed(2)}</span></div>` : ''}
    ${invoiceDiscount > 0 ? `<div class="total-row"><span>خصم الفاتورة:</span><span>- ${invoiceDiscount.toFixed(2)}</span></div>` : ''}
    <div class="total-row final"><span>الصافي:</span><span>${finalTotal.toFixed(2)} ج.م</span></div>
    <div class="total-row"><span>المدفوع:</span><span>${paidAmount.toFixed(2)} ج.م</span></div>
    ${remaining > 0 ? `<div class="total-row"><span>المتبقي:</span><span>${remaining.toFixed(2)} ج.م</span></div>` : ''}
  </div>

  <div class="status ${remaining > 0 ? 'credit' : 'paid'}">
    ${remaining > 0 ? 'آجل - يوجد متبقي' : 'مدفوع بالكامل'}
  </div>

  <div class="footer">
    <div>تم الطباعة: ${escapeHtml(printedAt)}</div>
    <div>شكراً لتعاملكم معنا</div>
    <div class="no-print">
      <button class="print-button" onclick="if(window.electronAPI){window.electronAPI.triggerPrint()}else{window.print()}">طباعة</button>
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


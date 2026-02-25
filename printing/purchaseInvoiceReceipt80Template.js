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

export const generatePurchaseInvoiceReceipt80HTML = ({ purchase, company }) => {
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
  const paymentLabel = escapeHtml(
    safePurchase?.payment
      || safePurchase?.paymentMethod?.name
      || safePurchase?.purchaseType
      || '-'
  );
  const purchaseId = escapeHtml(safePurchase?.id || '-');
  const purchaseDate = new Date(getPurchaseDate(safePurchase)).toLocaleString('ar-EG');
  const printedAt = new Date().toLocaleString('ar-EG');

  const itemsHtml = items.map((item, index) => {
    const name = escapeHtml(item?.variant?.product?.name || item?.productName || 'صنف');
    const size = escapeHtml(item?.variant?.productSize || item?.size || '');
    const color = escapeHtml(item?.variant?.color || item?.color || '');
    const specs = [size, color].filter(Boolean).join(' - ');
    const quantity = Math.max(0, toNumber(item?.quantity, 0));
    const unitCost = Math.max(0, toNumber(item?.price ?? item?.cost, 0));
    const lineTotal = unitCost * quantity;

    return `
      <div class="item">
        <div class="item-name">${index + 1}. ${name}</div>
        ${specs ? `<div class="item-specs">${escapeHtml(specs)}</div>` : ''}
        <div class="item-line">
          <span>${quantity} × ${unitCost.toFixed(2)}</span>
          <span>${lineTotal.toFixed(2)}</span>
        </div>
      </div>
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
    .header { text-align: center; }
    .header .name { font-size: 17px; font-weight: 800; margin-bottom: 3px; }
    .header .line { font-size: 11px; margin: 1px 0; }
    .title {
      margin-top: 6px;
      text-align: center;
      font-size: 16px;
      font-weight: 800;
      color: #0f766e;
    }
    .divider { border-top: 1px dashed #111827; margin: 7px 0; }
    .divider-solid { border-top: 2px solid #111827; margin: 7px 0; }
    .meta-row, .item-line, .total-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .meta-row { margin: 3px 0; }
    .supplier {
      border: 1px solid #111827;
      border-radius: 4px;
      padding: 6px;
      margin: 7px 0;
    }
    .supplier .name { font-weight: 700; margin-bottom: 2px; }
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
    .total-row { margin: 3px 0; }
    .total-row.final {
      font-size: 15px;
      font-weight: 800;
      border-top: 2px solid #111827;
      border-bottom: 2px solid #111827;
      padding: 5px 0;
      margin: 7px 0;
      color: #0f766e;
    }
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
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="name">${companyName}</div>
    ${companyContactNumbers ? `<div class="line">هاتف: ${companyContactNumbers}</div>` : ''}
    ${companyAddress ? `<div class="line">العنوان: ${companyAddress}</div>` : ''}
  </div>

  <div class="title">فاتورة مشتريات</div>
  <div class="divider"></div>

  <div class="meta-row"><span>فاتورة رقم:</span><span>#${purchaseId}</span></div>
  <div class="meta-row"><span>التاريخ:</span><span>${escapeHtml(purchaseDate)}</span></div>
  <div class="meta-row"><span>طريقة الدفع:</span><span>${paymentLabel}</span></div>

  <div class="supplier">
    <div class="name">${supplierName}</div>
    ${supplierPhone ? `<div>هاتف: ${supplierPhone}</div>` : ''}
  </div>

  <div class="items-header">
    <span>الصنف</span>
    <span>المبلغ</span>
  </div>
  <div>${itemsHtml}</div>

  <div class="divider-solid"></div>

  <div class="total-row"><span>الإجمالي الفرعي:</span><span>${subTotal.toFixed(2)}</span></div>
  ${invoiceDiscount > 0 ? `<div class="total-row"><span>الخصم:</span><span>- ${invoiceDiscount.toFixed(2)}</span></div>` : ''}
  <div class="total-row"><span>المدفوع:</span><span>${paidAmount.toFixed(2)}</span></div>
  <div class="total-row final"><span>المتبقي:</span><span>${remaining.toFixed(2)} ج.م</span></div>

  <div class="footer">
    <div>تم الطباعة: ${escapeHtml(printedAt)}</div>
    <div class="no-print">
      <button class="print-button" onclick="if(window.electronAPI){window.electronAPI.triggerPrint({ silent: true })}else{window.print()}">طباعة</button>
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


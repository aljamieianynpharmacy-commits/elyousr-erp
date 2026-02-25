import { CustomerLedgerService } from '../src/services/customerLedgerService';

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

const getPaymentDate = (payment) => payment?.paymentDate || payment?.createdAt || new Date().toISOString();

export const generatePaymentReceipt80HTML = ({ payment, customer, company }) => {
  const safePayment = payment || {};
  const safeCustomer = customer || safePayment?.customer || null;
  const amount = Math.max(0, toNumber(safePayment?.amount, 0));
  const remainingBalance = toNumber(safeCustomer?.balance, 0);
  const paymentDate = new Date(getPaymentDate(safePayment)).toLocaleString('ar-EG');
  const printedAt = new Date().toLocaleString('ar-EG');

  const companyName = escapeHtml(company?.name || 'ERP SYSTEM');
  const companyContactNumbers = escapeHtml(company?.contactNumbers || '');
  const companyAddress = escapeHtml(company?.address || '');
  const receiptId = escapeHtml(safePayment?.id || '-');
  const customerName = escapeHtml(safeCustomer?.name || '-');
  const customerPhone = escapeHtml(safeCustomer?.phone || '-');
  const paymentMethod = escapeHtml(
    safePayment?.paymentMethod?.name
      || safePayment?.paymentMethod
      || safePayment?.method
      || '-'
  );
  const notes = escapeHtml(safePayment?.notes || '');
  const amountInWords = escapeHtml(CustomerLedgerService.numberToArabicWords(amount));

  return `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إيصال دفع رقم ${receiptId}</title>
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
    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 3px 0;
    }
    .amount-box {
      border: 2px solid #16a34a;
      border-radius: 6px;
      margin: 8px 0;
      padding: 8px;
      text-align: center;
      background: #f0fdf4;
    }
    .amount-box .amount { font-size: 20px; font-weight: 800; color: #166534; }
    .amount-box .label { font-size: 11px; color: #166534; }
    .notes {
      border: 1px solid #d1d5db;
      border-radius: 5px;
      padding: 6px;
      margin: 7px 0;
      background: #f9fafb;
      font-size: 11px;
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

  <div class="title">إيصال دفع</div>
  <div class="divider"></div>

  <div class="meta-row"><span>رقم الإيصال:</span><span>${receiptId}</span></div>
  <div class="meta-row"><span>التاريخ:</span><span>${escapeHtml(paymentDate)}</span></div>
  <div class="meta-row"><span>العميل:</span><span>${customerName}</span></div>
  <div class="meta-row"><span>الهاتف:</span><span>${customerPhone}</span></div>
  <div class="meta-row"><span>طريقة الدفع:</span><span>${paymentMethod}</span></div>

  <div class="amount-box">
    <div class="amount">${amount.toFixed(2)} ج.م</div>
    <div class="label">المبلغ المستلم</div>
    <div class="label">(${amountInWords} جنيهًا)</div>
  </div>

  <div class="meta-row">
    <span>الرصيد المتبقي:</span>
    <span style="font-weight:700;color:${remainingBalance > 0 ? '#dc2626' : '#16a34a'};">
      ${remainingBalance.toFixed(2)} ج.م
    </span>
  </div>

  ${notes ? `<div class="notes"><strong>ملاحظات:</strong> ${notes}</div>` : ''}

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


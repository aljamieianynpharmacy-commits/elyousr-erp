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

export const generatePaymentReceiptA4HTML = ({ payment, customer, company }) => {
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
      margin-bottom: 12px;
      color: #0f766e;
    }
    .meta {
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 12px;
      background: #f9fafb;
      font-size: 14px;
      line-height: 1.7;
      margin-bottom: 12px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      gap: 10px;
    }
    .amount-box {
      border: 2px solid #16a34a;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      margin-bottom: 12px;
      background: #f0fdf4;
      color: #166534;
    }
    .amount-box .amount {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 4px;
    }
    .notes {
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 10px;
      background: #f9fafb;
      margin-bottom: 12px;
      font-size: 14px;
    }
    .footer {
      margin-top: 14px;
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

    <div class="title">إيصال دفع / سند قبض</div>

    <div class="meta">
      <div class="row"><strong>رقم الإيصال:</strong><span>${receiptId}</span></div>
      <div class="row"><strong>التاريخ:</strong><span>${escapeHtml(paymentDate)}</span></div>
      <div class="row"><strong>العميل:</strong><span>${customerName}</span></div>
      <div class="row"><strong>الهاتف:</strong><span>${customerPhone}</span></div>
      <div class="row"><strong>طريقة الدفع:</strong><span>${paymentMethod}</span></div>
      <div class="row">
        <strong>الرصيد المتبقي:</strong>
        <span style="font-weight:700;color:${remainingBalance > 0 ? '#dc2626' : '#16a34a'};">
          ${remainingBalance.toFixed(2)} ج.م
        </span>
      </div>
    </div>

    <div class="amount-box">
      <div class="amount">${amount.toFixed(2)} ج.م</div>
      <div>المبلغ المستلم</div>
      <div style="font-size:12px;margin-top:6px;">(${amountInWords} جنيهًا مصريًا)</div>
    </div>

    ${notes ? `<div class="notes"><strong>ملاحظات:</strong> ${notes}</div>` : ''}

    <div class="footer">
      <div>تم الطباعة: ${escapeHtml(printedAt)}</div>
      <div class="no-print">
        <button class="print-button" onclick="if(window.electronAPI){window.electronAPI.triggerPrint({ silent: true })}else{window.print()}">طباعة الإيصال</button>
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


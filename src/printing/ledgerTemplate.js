/**
 * Ledger Print Template
 * Returns pure HTML string for printing full customer ledger
 */

export const generateLedgerHTML = (customer, transactions, summary) => {
  const formatMoney = (value) => `${Number(value || 0).toFixed(2)} ج.م`;
  const getBalanceColor = (value) =>
    value > 0 ? '#ef4444' : value < 0 ? '#10b981' : '#475569';

  return `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>كشف حساب - ${customer?.name || '-'}</title>
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
    .customer-info {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .customer-info h3 { margin: 0 0 10px 0; font-size: 16px; }
    .customer-info p { margin: 5px 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 14px;
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
    .summary {
      background: #f0fdf4;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .summary h3 { margin: 0 0 10px 0; font-size: 16px; }
    .summary p { margin: 5px 0; }
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
    <h2>كشف حساب عميل</h2>
  </div>

  <div class="customer-info">
    <h3>بيانات العميل:</h3>
    <p><strong>الاسم:</strong> ${customer?.name || '-'}</p>
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
        <th>الرصيد</th>
        <th>ملاحظات</th>
      </tr>
    </thead>
    <tbody>
      ${transactions.length === 0 ? `
        <tr>
          <td colspan="6" style="text-align: center; padding: 20px; color: #6b7280;">
            لا توجد معاملات
          </td>
        </tr>
      ` : transactions.map(t => `
        <tr>
          <td>${t.date.toLocaleDateString('ar-EG')}</td>
          <td>${t.description}</td>
          <td style="color: #ef4444;">${t.debit > 0 ? formatMoney(t.debit) : '-'}</td>
          <td style="color: #10b981;">${t.credit > 0 ? formatMoney(t.credit) : '-'}</td>
          <td style="color: ${getBalanceColor(Number(t.runningBalance || 0))}; font-weight: bold;">
            ${formatMoney(t.runningBalance || 0)}
          </td>
          <td>${t.notes || '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="summary">
    <h3>ملخص الحساب:</h3>
    <p><strong>إجمالي المبيعات:</strong> ${formatMoney(summary.totalSales)}</p>
    <p><strong>إجمالي المرتجعات:</strong> ${formatMoney(summary.totalReturns)}</p>
    <p><strong>إجمالي الدفعات:</strong> ${formatMoney(summary.totalPayments)}</p>
    <p style="font-size: 18px; color: ${getBalanceColor(summary.finalBalance)};">
      <strong>الرصيد الحالي:</strong> ${formatMoney(summary.finalBalance)}
    </p>
  </div>

  <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280;">
    <p>تم الطباعة في: ${new Date().toLocaleString('ar-EG')}</p>
    <div class="no-print">
      <button class="print-button" onclick="if(window.electronAPI){window.electronAPI.triggerPrint()}else{window.print()}">🖨️ طباعة كشف الحساب</button>
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

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '-';
  return parsed.toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatMoney = (value) => `${toNumber(value, 0).toFixed(2)} ج.م`;

export const generatePurchaseReturnInvoiceHTML = (purchaseReturn, supplier = null) => {
  const items = Array.isArray(purchaseReturn?.items) ? purchaseReturn.items : [];
  const total = Math.max(0, toNumber(purchaseReturn?.total, 0));
  const resolvedSupplier = supplier || purchaseReturn?.supplier || null;

  const rowsHtml = items.length
    ? items.map((item, index) => {
      const quantity = Math.max(0, toNumber(item?.quantity, 0));
      const price = Math.max(0, toNumber(item?.price, 0));
      const rowTotal = quantity * price;

      return `<tr>
        <td>${escapeHtml(item?.variant?.product?.name || item?.productName || `منتج #${index + 1}`)}</td>
        <td>${escapeHtml(item?.variant?.productSize || item?.size || '-')}</td>
        <td>${escapeHtml(item?.variant?.color || item?.color || '-')}</td>
        <td style="text-align:center">${quantity}</td>
        <td style="text-align:center">${formatMoney(price)}</td>
        <td style="text-align:left">${formatMoney(rowTotal)}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="6" style="text-align:center;color:#64748b">لا توجد أصناف في المرتجع</td></tr>';

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>مرتجع مشتريات #${escapeHtml(purchaseReturn?.id || '-')}</title>
  <style>
    body { font-family: "Cairo", "Tahoma", sans-serif; margin: 24px; color: #0f172a; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:2px solid #e2e8f0; padding-bottom:12px; }
    .title { font-size:24px; font-weight:700; margin:0; color:#1e293b; }
    .meta { display:grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap:6px; margin-bottom:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px; }
    .meta strong { color:#334155; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    th { background:#f8fafc; border-bottom:1px solid #cbd5e1; padding:10px; text-align:right; font-size:13px; }
    td { border-bottom:1px solid #e2e8f0; padding:10px; font-size:13px; }
    .totals { margin-top:14px; display:flex; justify-content:space-between; align-items:center; padding:12px; border-radius:10px; background:#dcfce7; color:#14532d; font-size:18px; font-weight:700; }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">فاتورة مرتجع مشتريات</h1>
    <div><strong>رقم المرتجع:</strong> #${escapeHtml(purchaseReturn?.id || '-')}</div>
  </div>

  <div class="meta">
    <div><strong>التاريخ:</strong> ${escapeHtml(formatDate(purchaseReturn?.createdAt))}</div>
    <div><strong>المورد:</strong> ${escapeHtml(resolvedSupplier?.name || 'مورد عابر')}</div>
    <div><strong>فاتورة المشتريات:</strong> ${purchaseReturn?.purchaseId ? `#${escapeHtml(purchaseReturn.purchaseId)}` : '-'}</div>
    <div><strong>ملاحظات:</strong> ${escapeHtml(purchaseReturn?.notes || '-')}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>الصنف</th>
        <th>المقاس</th>
        <th>اللون</th>
        <th style="text-align:center">الكمية</th>
        <th style="text-align:center">السعر</th>
        <th style="text-align:left">الإجمالي</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="totals">
    <span>إجمالي المرتجع</span>
    <strong>${formatMoney(total)}</strong>
  </div>
</body>
</html>`;
};


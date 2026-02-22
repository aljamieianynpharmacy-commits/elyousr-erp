import React, { memo } from 'react';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatMoney = (value) => `${Number(value || 0).toFixed(2)} ج.م`;
const getSaleDate = (sale) => sale?.invoiceDate || sale?.createdAt;

function SaleDetailsModal({ sale, onClose }) {
  if (!sale) return null;

  const isLoadingDetails = Boolean(sale?.isLoadingDetails);
  const items = Array.isArray(sale?.items) ? sale.items : [];

  return (
    <div className="sales-modal-overlay" onClick={onClose}>
      <div className="sales-modal" onClick={(event) => event.stopPropagation()}>
        <div className="sales-modal-header">
          <h2>تفاصيل الفاتورة #{sale.id}</h2>
          <button className="sales-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="sales-modal-meta">
          <div><strong>التاريخ:</strong> {formatDateTime(getSaleDate(sale))}</div>
          <div><strong>العميل:</strong> {sale.customer?.name || 'عميل نقدي'}</div>
          <div><strong>طريقة الدفع:</strong> {sale.payment || sale.paymentMethod?.name || '-'}</div>
          <div><strong>نوع البيع:</strong> {sale.saleType || '-'}</div>
        </div>

        <div className="sales-modal-table-wrap">
          <table className="sales-modal-table">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>المقاس</th>
                <th>اللون</th>
                <th>الكمية</th>
                <th>السعر</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingDetails ? (
                <tr>
                  <td colSpan={6} className="sales-empty-state">جاري تحميل التفاصيل...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="sales-empty-state">لا توجد أصناف في الفاتورة</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={`${item.saleId || sale.id}-${item.id}-${item.variantId}`}>
                    <td>{item.variant?.product?.name || 'منتج'}</td>
                    <td>{item.variant?.productSize || '-'}</td>
                    <td>{item.variant?.color || '-'}</td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.price)}</td>
                    <td>{formatMoney((item.price || 0) * (item.quantity || 0))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="sales-modal-total">
          <span>إجمالي الفاتورة</span>
          <strong>{formatMoney(sale.total)}</strong>
        </div>
      </div>
    </div>
  );
}

export default memo(SaleDetailsModal);

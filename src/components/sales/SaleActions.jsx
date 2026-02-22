import React, { memo } from 'react';

function SaleActions({
  sale,
  isBusy,
  onView,
  onEdit,
  onPrint,
  onDelete
}) {
  return (
    <div className="sales-actions-cell">
      <button
        className="sales-action-btn"
        onClick={() => onView(sale)}
        disabled={isBusy}
        title="عرض التفاصيل"
        aria-label="عرض التفاصيل"
      >
        👁️
      </button>
      <button
        className="sales-action-btn is-edit"
        onClick={() => onEdit(sale)}
        disabled={isBusy}
        title="تعديل الفاتورة"
        aria-label="تعديل الفاتورة"
      >
        ✏️
      </button>
      <button
        className="sales-action-btn is-print"
        onClick={() => onPrint(sale)}
        disabled={isBusy}
        title="طباعة الفاتورة"
        aria-label="طباعة الفاتورة"
      >
        🖨️
      </button>
      <button
        className="sales-action-btn is-delete"
        onClick={() => onDelete(sale)}
        disabled={isBusy}
        title="حذف الفاتورة"
        aria-label="حذف الفاتورة"
      >
        🗑️
      </button>
    </div>
  );
}

export default memo(SaleActions);

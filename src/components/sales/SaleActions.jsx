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
      >
        عرض
      </button>
      <button
        className="sales-action-btn is-edit"
        onClick={() => onEdit(sale)}
        disabled={isBusy}
        title="تعديل الفاتورة"
      >
        تعديل
      </button>
      <button
        className="sales-action-btn is-print"
        onClick={() => onPrint(sale)}
        disabled={isBusy}
        title="طباعة الفاتورة"
      >
        طباعة
      </button>
      <button
        className="sales-action-btn is-delete"
        onClick={() => onDelete(sale)}
        disabled={isBusy}
        title="حذف الفاتورة"
      >
        حذف
      </button>
    </div>
  );
}

export default memo(SaleActions);

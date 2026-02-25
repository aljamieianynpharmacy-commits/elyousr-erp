import React, { memo, useState } from 'react';

function SaleActions({
  sale,
  onView,
  onPrint,
  onEdit,
  onDelete
}) {
  const [pendingAction, setPendingAction] = useState(null);

  const runAction = async (actionKey, handler) => {
    if (pendingAction) return;

    setPendingAction(actionKey);
    try {
      await handler?.(sale);
    } finally {
      setPendingAction(null);
    }
  };

  const isDisabled = Boolean(pendingAction);

  return (
    <div className="sales-actions-cell">
      <button
        className="sales-action-btn"
        onClick={() => runAction('view', onView)}
        disabled={isDisabled}
        title="عرض التفاصيل"
        aria-label="عرض التفاصيل"
      >
        👁️
      </button>
      <button
        className="sales-action-btn is-print"
        onClick={() => runAction('print', onPrint)}
        disabled={isDisabled}
        title="طباعة الفاتورة"
        aria-label="طباعة الفاتورة"
      >
        🖨️
      </button>
      <button
        className="sales-action-btn is-edit"
        onClick={() => runAction('edit', onEdit)}
        disabled={isDisabled}
        title="تعديل الفاتورة"
        aria-label="تعديل الفاتورة"
      >
        ✏️
      </button>
      <button
        className="sales-action-btn is-delete"
        onClick={() => runAction('delete', onDelete)}
        disabled={isDisabled}
        title="حذف الفاتورة"
        aria-label="حذف الفاتورة"
      >
        🗑️
      </button>
    </div>
  );
}

export default memo(SaleActions);

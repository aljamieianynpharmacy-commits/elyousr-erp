import React, { memo, useState } from 'react';

function ProductRowActions({
  product,
  onEdit,
  onDuplicate,
  onPrint,
  onDelete
}) {
  const [pendingAction, setPendingAction] = useState(null);

  const runAction = async (actionKey, handler, payload) => {
    if (!handler || pendingAction) return;

    setPendingAction(actionKey);
    try {
      await handler(payload);
    } finally {
      setPendingAction(null);
    }
  };

  const isDisabled = Boolean(pendingAction);

  return (
    <div className="row-actions">
      <button
        type="button"
        className="icon-btn-solid edit"
        title="تعديل"
        onClick={() => runAction('edit', onEdit, product)}
        disabled={isDisabled}
      >
        ✏️
      </button>
      <button
        type="button"
        className="icon-btn-solid orange"
        title="نسخ"
        onClick={() => runAction('duplicate', onDuplicate, product)}
        disabled={isDisabled}
      >
        📋
      </button>
      <button
        type="button"
        className="icon-btn-solid blue"
        title="طباعة باركود"
        onClick={() => runAction('print', onPrint, [product])}
        disabled={isDisabled}
      >
        🏷️
      </button>
      <button
        type="button"
        className="icon-btn-solid danger"
        title="حذف"
        onClick={() => runAction('delete', onDelete, product)}
        disabled={isDisabled}
      >
        🗑️
      </button>
    </div>
  );
}

export default memo(ProductRowActions);

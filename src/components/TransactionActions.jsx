import React from 'react';

const isFn = (value) => typeof value === 'function';

const buttonStyle = {
  padding: '6px 10px',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px'
};

const rowStyle = {
  display: 'flex',
  gap: '8px',
  justifyContent: 'center',
  flexWrap: 'wrap'
};

export default function TransactionActions({
  transaction,
  onPrintInvoice,
  onPrintReturn,
  onPrintReceipt,
  onEditSale,
  onEditReturn,
  onEditPayment,
  onDeleteSale,
  onDeleteReturn,
  onDeletePayment
}) {
  const type = transaction?.type;
  const details = transaction?.details;

  if (type === 'بيع') {
    return (
      <div style={rowStyle}>
        {isFn(onEditSale) && (
          <button
            onClick={() => onEditSale(transaction)}
            title="تعديل الفاتورة"
            style={{ ...buttonStyle, backgroundColor: '#f59e0b' }}
          >
            ✏️
          </button>
        )}

        {isFn(onPrintInvoice) && (
          <button
            onClick={() => onPrintInvoice(details)}
            title="طباعة الفاتورة"
            style={{ ...buttonStyle, backgroundColor: '#3b82f6' }}
          >
            🖨️
          </button>
        )}

        {isFn(onDeleteSale) && (
          <button
            onClick={() => onDeleteSale(details)}
            title="حذف الفاتورة"
            style={{ ...buttonStyle, backgroundColor: '#ef4444' }}
          >
            🗑️
          </button>
        )}
      </div>
    );
  }

  if (type === 'مرتجع') {
    return (
      <div style={rowStyle}>
        {isFn(onEditReturn) && (
          <button
            onClick={() => onEditReturn(transaction)}
            title="تعديل المرتجع"
            style={{ ...buttonStyle, backgroundColor: '#f59e0b' }}
          >
            ✏️
          </button>
        )}

        {isFn(onPrintReturn) && (
          <button
            onClick={() => onPrintReturn(details)}
            title="طباعة المرتجع"
            style={{ ...buttonStyle, backgroundColor: '#3b82f6' }}
          >
            🖨️
          </button>
        )}

        {isFn(onDeleteReturn) && (
          <button
            onClick={() => onDeleteReturn(details)}
            title="حذف المرتجع"
            style={{ ...buttonStyle, backgroundColor: '#ef4444' }}
          >
            🗑️
          </button>
        )}
      </div>
    );
  }

  if (type === 'دفعة') {
    return (
      <div style={rowStyle}>
        {isFn(onEditPayment) && (
          <button
            onClick={() => onEditPayment(transaction)}
            title="تعديل الدفعة"
            style={{ ...buttonStyle, backgroundColor: '#f59e0b' }}
          >
            ✏️
          </button>
        )}

        {isFn(onPrintReceipt) && (
          <button
            onClick={() => onPrintReceipt(details)}
            title="طباعة إيصال الدفع"
            style={{ ...buttonStyle, backgroundColor: '#10b981' }}
          >
            🖨️
          </button>
        )}

        {isFn(onDeletePayment) && (
          <button
            onClick={() => onDeletePayment(details)}
            title="حذف الدفعة"
            style={{ ...buttonStyle, backgroundColor: '#ef4444' }}
          >
            🗑️
          </button>
        )}
      </div>
    );
  }

  return <span style={{ color: '#9ca3af', fontSize: '12px' }}>-</span>;
}

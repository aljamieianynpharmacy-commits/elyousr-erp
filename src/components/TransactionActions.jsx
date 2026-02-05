import React from 'react';

export default function TransactionActions({ 
  transaction, 
  onPrintInvoice, 
  onPrintReceipt,
  onEditSale,
  onEditPayment,
  onDeleteSale,
  onDeletePayment
}) {
  const buttonStyle = {
    padding: '6px 10px',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  };

  if (transaction.type === 'بيع') {
    return (
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => onEditSale(transaction.details)}
          title="تعديل الفاتورة"
          style={{ ...buttonStyle, backgroundColor: '#f59e0b' }}
        >
          ✏️
        </button>
        <button
          onClick={() => onPrintInvoice(transaction.details)}
          title="طباعة الفاتورة"
          style={{ ...buttonStyle, backgroundColor: '#3b82f6' }}
        >
          🖨️
        </button>
        <button
          onClick={() => onDeleteSale(transaction.details)}
          title="حذف الفاتورة"
          style={{ ...buttonStyle, backgroundColor: '#ef4444' }}
        >
          🗑️
        </button>
      </div>
    );
  }

  if (transaction.type === 'دفعة') {
    return (
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => onEditPayment(transaction.details)}
          title="تعديل الدفعة"
          style={{ ...buttonStyle, backgroundColor: '#f59e0b' }}
        >
          ✏️
        </button>
        <button
          onClick={() => onPrintReceipt(transaction.details)}
          title="طباعة إيصال الدفع"
          style={{ ...buttonStyle, backgroundColor: '#10b981' }}
        >
          🖨️
        </button>
        <button
          onClick={() => onDeletePayment(transaction.details)}
          title="حذف الدفعة"
          style={{ ...buttonStyle, backgroundColor: '#ef4444' }}
        >
          🗑️
        </button>
      </div>
    );
  }

  // Return transactions have no actions
  return <span style={{ color: '#9ca3af', fontSize: '12px' }}>-</span>;
}

import React from 'react';

export default function CustomerLedgerSummary({ customer, transactions, summary }) {
  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f9fafb',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '15px'
    }}>
      <div>
        <div style={{ fontSize: '13px', color: '#6b7280' }}>الهاتف</div>
        <div style={{ fontWeight: 'bold' }}>{customer?.phone || '-'}</div>
      </div>
      <div>
        <div style={{ fontSize: '13px', color: '#6b7280' }}>العنوان</div>
        <div style={{ fontWeight: 'bold' }}>{customer?.address || '-'}</div>
      </div>
      <div>
        <div style={{ fontSize: '13px', color: '#6b7280' }}>الرصيد الحالي</div>
        <div style={{
          fontWeight: 'bold',
          fontSize: '18px',
          color: (customer?.balance || 0) > 0 
            ? '#ef4444' 
            : (customer?.balance || 0) < 0 
              ? '#10b981' 
              : '#6b7280'
        }}>
          {(customer?.balance || 0).toFixed(2)} ج.م
        </div>
      </div>
      <div>
        <div style={{ fontSize: '13px', color: '#6b7280' }}>عدد المعاملات</div>
        <div style={{ fontWeight: 'bold' }}>{transactions.length}</div>
      </div>
    </div>
  );
}

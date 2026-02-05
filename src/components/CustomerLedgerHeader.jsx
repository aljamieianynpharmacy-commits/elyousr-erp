import React from 'react';

export default function CustomerLedgerHeader({ 
  customer, 
  onPrintLedger, 
  onClose,
  dateRange,
  onDateRangeChange 
}) {
  return (
    <div style={{
      padding: '20px',
      borderBottom: '2px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '15px'
    }}>
      <h2 style={{ margin: 0 }}>📋 كشف حساب: {customer?.name}</h2>
      
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', color: '#6b7280' }}>من:</label>
          <input
            type="date"
            value={dateRange.from ? dateRange.from.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const date = e.target.value ? new Date(e.target.value) : null;
              onDateRangeChange({ ...dateRange, from: date });
            }}
            style={{
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          
          <label style={{ fontSize: '14px', color: '#6b7280' }}>إلى:</label>
          <input
            type="date"
            value={dateRange.to ? dateRange.to.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const date = e.target.value ? new Date(e.target.value) : null;
              onDateRangeChange({ ...dateRange, to: date });
            }}
            style={{
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          
          {(dateRange.from || dateRange.to) && (
            <button
              onClick={() => onDateRangeChange({ from: null, to: null })}
              style={{
                padding: '8px 12px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              إعادة تعيين
            </button>
          )}
        </div>
        
        <button
          onClick={onPrintLedger}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          🖨️ طباعة الكشف
        </button>
        
        <button
          onClick={onClose}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          ✕ إغلاق
        </button>
      </div>
    </div>
  );
}

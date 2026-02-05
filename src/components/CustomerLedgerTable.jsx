import React from 'react';
import TransactionActions from './TransactionActions';

export default function CustomerLedgerTable({ 
  transactions, 
  onPrintInvoice, 
  onPrintReceipt,
  onEditSale,
  onEditPayment,
  onDeleteSale,
  onDeletePayment
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
          <tr>
            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>التاريخ</th>
            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>النوع</th>
            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>البيان</th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>الإجمالي</th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>المدفوع</th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>المتبقي</th>
            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>ملاحظات</th>
            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>
                لا توجد معاملات
              </td>
            </tr>
          ) : (
            transactions.map(transaction => (
              <tr key={transaction.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px' }}>
                  {transaction.date.toLocaleDateString('ar-EG')}
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor: transaction.typeColor + '20',
                    color: transaction.typeColor
                  }}>
                    {transaction.type}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>{transaction.description}</td>
                <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                  {transaction.total.toFixed(2)} ج.م
                </td>
                <td style={{ padding: '12px', textAlign: 'center', color: '#10b981', fontWeight: 'bold' }}>
                  {transaction.paid.toFixed(2)} ج.م
                </td>
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  fontWeight: 'bold', 
                  color: transaction.remaining > 0 ? '#ef4444' : '#10b981' 
                }}>
                  {transaction.remaining.toFixed(2)} ج.م
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: '#6b7280' }}>
                  {transaction.notes}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <TransactionActions
                    transaction={transaction}
                    onPrintInvoice={onPrintInvoice}
                    onPrintReceipt={onPrintReceipt}
                    onDeleteSale={onDeleteSale}
                    onDeletePayment={onDeletePayment}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

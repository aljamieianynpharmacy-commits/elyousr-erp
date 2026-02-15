import React from 'react';
import TransactionActions from './TransactionActions';

const formatCurrency = (value) => `${Number(value || 0).toFixed(2)} ج.م`;

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
    <div className="customer-ledger-table-wrap">
      <table className="customer-ledger-table">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>النوع</th>
            <th>البيان</th>
            <th style={{ textAlign: 'center' }}>الإجمالي</th>
            <th style={{ textAlign: 'center' }}>المدفوع</th>
            <th style={{ textAlign: 'center' }}>المتبقي</th>
            <th style={{ textAlign: 'center' }}>الرصيد</th>
            <th>ملاحظات</th>
            <th style={{ textAlign: 'center' }}>إجراءات</th>
          </tr>
        </thead>

        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan="9" className="ledger-empty-state">
                لا توجد معاملات في الفترة المحددة
              </td>
            </tr>
          ) : (
            transactions.map((transaction) => {
              const remainingClass =
                transaction.remaining > 0
                  ? 'ledger-money-remaining-debit'
                  : 'ledger-money-remaining-credit';

              const runningBalance = Number(transaction.runningBalance || 0);
              const runningBalanceClass =
                runningBalance > 0
                  ? 'ledger-balance-debit'
                  : runningBalance < 0
                    ? 'ledger-balance-credit'
                    : 'ledger-balance-neutral';

              return (
                <tr key={transaction.id}>
                  <td className="ledger-cell-date">
                    {transaction.date.toLocaleDateString('ar-EG')}
                  </td>

                  <td>
                    <span
                      className="ledger-type-chip"
                      style={{
                        backgroundColor: `${transaction.typeColor}1A`,
                        color: transaction.typeColor
                      }}
                    >
                      {transaction.type}
                    </span>
                  </td>

                  <td className="ledger-cell-description">{transaction.description}</td>

                  <td className="ledger-money-cell">{formatCurrency(transaction.total)}</td>

                  <td className="ledger-money-cell ledger-money-paid">
                    {formatCurrency(transaction.paid)}
                  </td>

                  <td className={`ledger-money-cell ${remainingClass}`}>
                    {formatCurrency(transaction.remaining)}
                  </td>

                  <td className={`ledger-money-cell ${runningBalanceClass}`}>
                    {formatCurrency(runningBalance)}
                  </td>

                  <td className="ledger-cell-notes">{transaction.notes || '-'}</td>

                  <td className="ledger-cell-actions" style={{ textAlign: 'center' }}>
                    <TransactionActions
                      transaction={transaction}
                      onPrintInvoice={onPrintInvoice}
                      onPrintReceipt={onPrintReceipt}
                      onEditSale={onEditSale}
                      onEditPayment={onEditPayment}
                      onDeleteSale={onDeleteSale}
                      onDeletePayment={onDeletePayment}
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

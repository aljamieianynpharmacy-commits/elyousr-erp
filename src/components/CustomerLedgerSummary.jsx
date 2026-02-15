import React from 'react';

export default function CustomerLedgerSummary({ customer, transactions, summary }) {
  const currentBalance = customer?.balance || 0;
  const balanceClass =
    currentBalance > 0
      ? 'ledger-balance-debit'
      : currentBalance < 0
        ? 'ledger-balance-credit'
        : 'ledger-balance-neutral';

  return (
    <div className="customer-ledger-summary">
      <div className="customer-ledger-summary-grid">
        <div className="ledger-summary-card">
          <div className="ledger-summary-label">الهاتف</div>
          <div className="ledger-summary-value ledger-summary-value-muted">{customer?.phone || '-'}</div>
        </div>

        <div className="ledger-summary-card">
          <div className="ledger-summary-label">العنوان</div>
          <div className="ledger-summary-value ledger-summary-value-muted">{customer?.address || '-'}</div>
        </div>

        <div className="ledger-summary-card">
          <div className="ledger-summary-label">الرصيد الحالي</div>
          <div className={`ledger-summary-value ${balanceClass}`}>
            {currentBalance.toFixed(2)} ج.م
          </div>
        </div>

        <div className="ledger-summary-card">
          <div className="ledger-summary-label">عدد المعاملات</div>
          <div className="ledger-summary-value">{transactions.length}</div>
        </div>
      </div>
    </div>
  );
}

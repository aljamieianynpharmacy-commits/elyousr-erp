import React from "react";

export default function CustomerLedgerSummary({ customer, transactions }) {
  const customerDetails = customer?.notes || "-";

  return (
    <div className="customer-ledger-summary">
      <div className="customer-ledger-summary-grid">
        <div className="ledger-summary-card">
          <div className="ledger-summary-label">{"\u0627\u0644\u0647\u0627\u062a\u0641"}</div>
          <div className="ledger-summary-value ledger-summary-value-muted">
            {customer?.phone || "-"}
          </div>
        </div>

        <div className="ledger-summary-card">
          <div className="ledger-summary-label">
            {"\u0627\u0644\u0647\u0627\u062a\u0641 2"}
          </div>
          <div className="ledger-summary-value ledger-summary-value-muted">
            {customer?.phone2 || "-"}
          </div>
        </div>

        <div className="ledger-summary-card">
          <div className="ledger-summary-label">{"\u0627\u0644\u0639\u0646\u0648\u0627\u0646"}</div>
          <div className="ledger-summary-value ledger-summary-value-muted ledger-summary-value-text">
            {customer?.address || "-"}
          </div>
        </div>

        <div className="ledger-summary-card">
          <div className="ledger-summary-label">
            {"\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0639\u0645\u064a\u0644"}
          </div>
          <div className="ledger-summary-value ledger-summary-value-muted ledger-summary-value-text">
            {customerDetails}
          </div>
        </div>

        <div className="ledger-summary-card">
          <div className="ledger-summary-label">
            {"\u0627\u0644\u062d\u062f \u0627\u0644\u0627\u0626\u062a\u0645\u0627\u0646\u064a"}
          </div>
          <div className="ledger-summary-value">
            {Number(customer?.creditLimit || 0).toFixed(2)} {"\u062c.\u0645"}
          </div>
        </div>

        <div className="ledger-summary-card">
          <div className="ledger-summary-label">
            {"\u0639\u062f\u062f \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062a"}
          </div>
          <div className="ledger-summary-value">{transactions.length}</div>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import TransactionActions from "./TransactionActions";

const formatCurrency = (value) => `${Number(value || 0).toFixed(2)} \u062c.\u0645`;

export default function CustomerLedgerTable({
  transactions,
  onPrintInvoice,
  onPrintReceipt,
  onEditSale,
  onEditPayment,
  onDeleteSale,
  onDeletePayment,
}) {
  return (
    <div className="customer-ledger-table-wrap">
      <table className="customer-ledger-table">
        <thead>
          <tr>
            <th>{"\u0627\u0644\u062a\u0627\u0631\u064a\u062e"}</th>
            <th>{"\u0627\u0644\u0628\u064a\u0627\u0646"}</th>
            <th style={{ textAlign: "center" }}>
              {"\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639"}
            </th>
            <th style={{ textAlign: "center" }}>
              {"\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a"}
            </th>
            <th style={{ textAlign: "center" }}>
              {"\u0627\u0644\u0645\u062f\u0641\u0648\u0639"}
            </th>
            <th style={{ textAlign: "center" }}>
              {"\u0627\u0644\u0645\u062a\u0628\u0642\u064a"}
            </th>
            <th style={{ textAlign: "center" }}>
              {"\u0627\u0644\u0631\u0635\u064a\u062f"}
            </th>
            <th>{"\u0645\u0644\u0627\u062d\u0638\u0627\u062a"}</th>
            <th style={{ textAlign: "center" }}>
              {"\u0625\u062c\u0631\u0627\u0621\u0627\u062a"}
            </th>
          </tr>
        </thead>

        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan="9" className="ledger-empty-state">
                {"\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0639\u0627\u0645\u0644\u0627\u062a \u0641\u064a \u0627\u0644\u0641\u062a\u0631\u0629 \u0627\u0644\u0645\u062d\u062f\u062f\u0629"}
              </td>
            </tr>
          ) : (
            transactions.map((transaction) => {
              const remainingClass =
                transaction.remaining > 0
                  ? "ledger-money-remaining-debit"
                  : "ledger-money-remaining-credit";
              const notesText = transaction.notes?.trim() || "-";

              const runningBalance = Number(transaction.runningBalance || 0);
              const runningBalanceClass =
                runningBalance > 0
                  ? "ledger-balance-debit"
                  : runningBalance < 0
                    ? "ledger-balance-credit"
                    : "ledger-balance-neutral";

              return (
                <tr key={transaction.id}>
                  <td className="ledger-cell-date">
                    {transaction.date.toLocaleDateString("ar-EG")}
                  </td>

                  <td className="ledger-cell-description">{transaction.description}</td>

                  <td style={{ textAlign: "center" }}>
                    {transaction.paymentMethodName || "-"}
                  </td>

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

                  <td className="ledger-cell-notes">
                    <span className="ledger-cell-notes-text" title={notesText}>
                      {notesText}
                    </span>
                  </td>

                  <td className="ledger-cell-actions" style={{ textAlign: "center" }}>
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

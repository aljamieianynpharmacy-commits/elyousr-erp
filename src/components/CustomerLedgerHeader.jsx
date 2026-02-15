import React from 'react';

const toInputDateValue = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseInputDate = (value, endOfDay = false) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
};

export default function CustomerLedgerHeader({
  customer,
  onPrintLedger,
  onPrintDetailedLedger,
  onClose,
  dateRange,
  onDateRangeChange
}) {
  return (
    <div className="customer-ledger-header">
      <div className="customer-ledger-header-main">
        <div>
          <h2 className="customer-ledger-title">كشف حساب العميل</h2>
          <div className="customer-ledger-subtitle">{customer?.name || '-'}</div>
        </div>

        <div className="customer-ledger-actions">
          <button onClick={onPrintLedger} className="ledger-btn ledger-btn-primary">
            طباعة الكشف
          </button>
          <button onClick={onPrintDetailedLedger} className="ledger-btn ledger-btn-accent">
            تقرير تفصيلي A4
          </button>
          <button onClick={onClose} className="ledger-btn ledger-btn-secondary">
            إغلاق
          </button>
        </div>
      </div>

      <div className="customer-ledger-filter-row">
        <span className="customer-ledger-filter-label">فلترة الفترة</span>

        <div className="customer-ledger-filter-fields">
          <label htmlFor="ledger-date-from">من</label>
          <input
            id="ledger-date-from"
            type="date"
            className="ledger-input"
            value={toInputDateValue(dateRange.from)}
            onChange={(e) => {
              onDateRangeChange({
                ...dateRange,
                from: parseInputDate(e.target.value)
              });
            }}
          />

          <label htmlFor="ledger-date-to">إلى</label>
          <input
            id="ledger-date-to"
            type="date"
            className="ledger-input"
            value={toInputDateValue(dateRange.to)}
            onChange={(e) => {
              onDateRangeChange({
                ...dateRange,
                to: parseInputDate(e.target.value, true)
              });
            }}
          />

          {(dateRange.from || dateRange.to) && (
            <button
              onClick={() => onDateRangeChange({ from: null, to: null })}
              className="ledger-btn ledger-btn-light"
            >
              مسح الفلتر
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

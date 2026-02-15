import React, { useState, useEffect, useMemo } from 'react';
import { safeAlert } from '../utils/safeAlert';
import { safeConfirm } from '../utils/safeConfirm';
import { CustomerLedgerService } from '../services/customerLedgerService';
import { safePrint } from '../printing/safePrint';
import { generateInvoiceHTML } from '../printing/invoiceTemplate';
import { generateReceiptHTML } from '../printing/receiptTemplate';
import { generateLedgerHTML } from '../printing/ledgerTemplate';
import CustomerLedgerHeader from './CustomerLedgerHeader';
import CustomerLedgerSummary from './CustomerLedgerSummary';
import CustomerLedgerTable from './CustomerLedgerTable';
import './CustomerLedger.css';

export default function CustomerLedgerModal({ customerId, onClose, onCustomerUpdated }) {
  const [customer, setCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: null, to: null });

  const loadCustomerData = async () => {
    try {
      const [customerInfo, salesData, returnsData, paymentsData] = await Promise.all([
        window.api.getCustomer(customerId),
        window.api.getCustomerSales(customerId),
        window.api.getCustomerReturns(customerId),
        window.api.getCustomerPayments(customerId)
      ]);

      if (customerInfo.error) throw new Error(customerInfo.error);
      if (salesData.error) throw new Error(salesData.error);
      if (returnsData.error) throw new Error(returnsData.error);
      if (paymentsData.error) throw new Error(paymentsData.error);

      setCustomer(customerInfo);
      setSales(salesData);
      setReturns(returnsData);
      setPayments(paymentsData);
    } catch (err) {
      console.error('فشل تحميل البيانات:', err.message);
      setCustomer(null);
      setSales([]);
      setReturns([]);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomerData();
  }, [customerId]);

  const allTransactions = useMemo(() => {
    const ledgerRows = CustomerLedgerService.buildLedgerTransactions(sales, returns, payments);
    return CustomerLedgerService.attachRunningBalance(ledgerRows, customer?.balance || 0);
  }, [sales, returns, payments, customer?.balance]);

  const transactions = useMemo(() => {
    return CustomerLedgerService.filterByDateRange(
      allTransactions,
      dateRange.from,
      dateRange.to
    );
  }, [allTransactions, dateRange.from, dateRange.to]);

  const summary = useMemo(() => {
    return CustomerLedgerService.calculateSummary(transactions, customer?.balance || 0);
  }, [transactions, customer?.balance]);

  const handlePrintInvoice = async (sale) => {
    const html = generateInvoiceHTML(sale, customer);
    const result = await safePrint(html, { title: `فاتورة رقم ${sale.id}` });

    if (result.error) {
      await safeAlert('خطأ في الطباعة: ' + result.error);
    }
  };

  const handlePrintReceipt = async (payment) => {
    const html = generateReceiptHTML(payment, customer);
    const result = await safePrint(html, { title: `إيصال دفع رقم ${payment.id}` });

    if (result.error) {
      await safeAlert('خطأ في الطباعة: ' + result.error);
    }
  };

  const handlePrintLedger = async () => {
    const html = generateLedgerHTML(customer, transactions, summary);
    const result = await safePrint(html, { title: `كشف حساب ${customer?.name}` });

    if (result.error) {
      await safeAlert('خطأ في الطباعة: ' + result.error);
    }
  };

  const handleDeleteSale = async (sale) => {
    const confirmed = await safeConfirm(
      `هل تريد حذف فاتورة رقم ${sale.id}؟`,
      { title: 'تأكيد الحذف', detail: 'لا يمكن التراجع عن هذا الإجراء' }
    );

    if (!confirmed) return;

    try {
      const result = await window.api.deleteSale(sale.id);
      if (result.error) {
        await safeAlert('خطأ: ' + result.error);
        return;
      }

      const updatedCustomer = await window.api.getCustomer(customerId);
      if (!updatedCustomer.error) {
        setCustomer(updatedCustomer);
        onCustomerUpdated?.(customerId, { balance: updatedCustomer.balance });
      }

      await safeAlert('✅ تم حذف الفاتورة بنجاح');
      loadCustomerData();
    } catch (err) {
      await safeAlert('خطأ في الحذف: ' + err.message);
    }
  };

  const handleDeletePayment = async (payment) => {
    const confirmed = await safeConfirm(
      `هل تريد حذف الدفعة رقم ${payment.id}؟`,
      { title: 'تأكيد الحذف', detail: 'لا يمكن التراجع عن هذا الإجراء' }
    );

    if (!confirmed) return;

    try {
      const result = await window.api.deleteCustomerPayment(payment.id);
      if (result.error) {
        await safeAlert('خطأ: ' + result.error);
        return;
      }

      const updatedCustomer = await window.api.getCustomer(customerId);
      if (!updatedCustomer.error) {
        setCustomer(updatedCustomer);
        onCustomerUpdated?.(customerId, { balance: updatedCustomer.balance });
      }

      await safeAlert('✅ تم حذف الدفعة بنجاح');
      loadCustomerData();
    } catch (err) {
      await safeAlert('خطأ في الحذف: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="customer-ledger-overlay">
        <div className="customer-ledger-loading">جاري التحميل...</div>
      </div>
    );
  }

  const finalBalanceClass =
    summary.finalBalance > 0
      ? 'ledger-balance-debit'
      : summary.finalBalance < 0
        ? 'ledger-balance-credit'
        : 'ledger-balance-neutral';

  return (
    <div className="customer-ledger-overlay">
      <div className="customer-ledger-modal">
        <CustomerLedgerHeader
          customer={customer}
          onPrintLedger={handlePrintLedger}
          onClose={onClose}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        <CustomerLedgerSummary
          customer={customer}
          transactions={transactions}
          summary={summary}
        />

        <CustomerLedgerTable
          transactions={transactions}
          onPrintInvoice={handlePrintInvoice}
          onPrintReceipt={handlePrintReceipt}
          onDeleteSale={handleDeleteSale}
          onDeletePayment={handleDeletePayment}
        />

        <div className="customer-ledger-footer">
          <div className="ledger-total-card">
            <div className="ledger-total-label">إجمالي المبيعات</div>
            <div className="ledger-total-value ledger-total-sales">
              {summary.totalSales.toFixed(2)} ج.م
            </div>
          </div>

          <div className="ledger-total-card">
            <div className="ledger-total-label">إجمالي المدفوع</div>
            <div className="ledger-total-value ledger-total-paid">
              {summary.totalPaid.toFixed(2)} ج.م
            </div>
          </div>

          <div className="ledger-total-card">
            <div className="ledger-total-label">إجمالي المتبقي</div>
            <div className="ledger-total-value ledger-total-remaining">
              {summary.totalRemaining.toFixed(2)} ج.م
            </div>
          </div>

          <div className="ledger-total-card">
            <div className="ledger-total-label">الرصيد الحالي</div>
            <div className={`ledger-total-value ${finalBalanceClass}`}>
              {summary.finalBalance.toFixed(2)} ج.م
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

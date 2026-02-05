import React, { useState, useEffect } from 'react';
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

export default function CustomerLedgerModal({ customerId, onClose, onCustomerUpdated }) {
  const [customer, setCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: null, to: null });

  useEffect(() => {
    loadCustomerData();
  }, [customerId]);

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
    const transactions = getFilteredTransactions();
    const summary = CustomerLedgerService.calculateSummary(transactions, customer?.balance || 0);
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
        onCustomerUpdated && onCustomerUpdated(customerId, { balance: updatedCustomer.balance });
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
        onCustomerUpdated && onCustomerUpdated(customerId, { balance: updatedCustomer.balance });
      }

      await safeAlert('✅ تم حذف الدفعة بنجاح');
      loadCustomerData();
    } catch (err) {
      await safeAlert('خطأ في الحذف: ' + err.message);
    }
  };

  const getFilteredTransactions = () => {
    const allTransactions = CustomerLedgerService.buildLedgerTransactions(sales, returns, payments);
    
    if (!dateRange.from && !dateRange.to) {
      return allTransactions;
    }

    return CustomerLedgerService.filterByDateRange(
      allTransactions,
      dateRange.from,
      dateRange.to
    );
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{ color: 'white', fontSize: '18px' }}>جاري التحميل...</div>
      </div>
    );
  }

  const transactions = getFilteredTransactions();
  const summary = CustomerLedgerService.calculateSummary(transactions, customer?.balance || 0);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '95%',
        maxWidth: '1200px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
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

        <div style={{
          padding: '20px',
          borderTop: '2px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '15px'
        }}>
          <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>إجمالي المبيعات</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>
              {summary.totalSales.toFixed(2)} ج.م
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>إجمالي المدفوع</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>
              {summary.totalPaid.toFixed(2)} ج.م
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>إجمالي المتبقي</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>
              {summary.totalRemaining.toFixed(2)} ج.م
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>الرصيد النهائي</div>
            <div style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: summary.finalBalance > 0 ? '#ef4444' : summary.finalBalance < 0 ? '#10b981' : '#6b7280'
            }}>
              {summary.finalBalance.toFixed(2)} ج.م
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

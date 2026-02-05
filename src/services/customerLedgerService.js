/**
 * Customer Ledger Service
 * Handles all accounting logic and ledger calculations
 */

export class CustomerLedgerService {
  /**
   * Get sale date with fallback
   */
  static getSaleDate(sale) {
    return sale.invoiceDate ? new Date(sale.invoiceDate) : new Date(sale.createdAt);
  }

  /**
   * Build unified ledger transactions from sales, returns, and payments
   */
  static buildLedgerTransactions(sales, returns, payments) {
    const transactions = [];

    // Process sales
    sales.forEach(sale => {
      const remaining = sale.saleType === 'آجل' ? sale.total : 0;
      
      transactions.push({
        id: `sale-${sale.id}`,
        date: this.getSaleDate(sale),
        type: 'بيع',
        typeColor: '#3b82f6',
        description: `فاتورة بيع #${sale.id}`,
        debit: sale.saleType === 'آجل' ? remaining : 0,
        credit: 0,
        total: sale.total,
        paid: sale.saleType === 'نقدي' ? sale.total : 0,
        remaining: remaining,
        notes: sale.notes || '✓ بدون ملاحظات',
        details: sale
      });
    });

    // Process returns
    returns.forEach(returnItem => {
      transactions.push({
        id: `return-${returnItem.id}`,
        date: new Date(returnItem.createdAt),
        type: 'مرتجع',
        typeColor: '#f59e0b',
        description: `مرتجع #${returnItem.id}`,
        debit: 0,
        credit: returnItem.total,
        total: returnItem.total,
        paid: returnItem.total,
        remaining: 0,
        notes: returnItem.notes || '✓ بدون ملاحظات',
        details: returnItem
      });
    });

    // Process payments
    payments.forEach(payment => {
      const paymentDate = payment.paymentDate 
        ? new Date(payment.paymentDate) 
        : new Date(payment.createdAt);
      
      transactions.push({
        id: `payment-${payment.id}`,
        date: paymentDate,
        type: 'دفعة',
        typeColor: '#10b981',
        description: `دفعة نقدية`,
        debit: 0,
        credit: payment.amount,
        total: payment.amount,
        paid: payment.amount,
        remaining: 0,
        notes: payment.notes || '✓ بدون ملاحظات',
        details: payment
      });
    });

    return transactions.sort((a, b) => b.date - a.date);
  }

  /**
   * Calculate ledger summary
   */
  static calculateSummary(transactions, customerBalance) {
    const totalSales = transactions
      .filter(t => t.type === 'بيع')
      .reduce((sum, t) => sum + t.total, 0);

    const totalPaid = transactions
      .filter(t => t.type !== 'مرتجع')
      .reduce((sum, t) => sum + t.paid, 0);

    const totalRemaining = transactions
      .filter(t => t.type === 'بيع')
      .reduce((sum, t) => sum + t.remaining, 0);

    const totalReturns = transactions
      .filter(t => t.type === 'مرتجع')
      .reduce((sum, t) => sum + t.credit, 0);

    const totalPayments = transactions
      .filter(t => t.type === 'دفعة')
      .reduce((sum, t) => sum + t.credit, 0);

    const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = transactions.reduce((sum, t) => sum + t.credit, 0);

    return {
      totalSales,
      totalPaid,
      totalRemaining,
      totalReturns,
      totalPayments,
      totalDebit,
      totalCredit,
      finalBalance: customerBalance
    };
  }

  /**
   * Filter transactions by date range
   */
  static filterByDateRange(transactions, fromDate, toDate) {
    if (!fromDate && !toDate) return transactions;

    return transactions.filter(t => {
      const transDate = t.date;
      if (fromDate && transDate < fromDate) return false;
      if (toDate && transDate > toDate) return false;
      return true;
    });
  }

  /**
   * Convert number to Arabic words (simplified)
   */
  static numberToArabicWords(num) {
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

    const integerPart = Math.floor(num);
    if (integerPart < 10) return ones[integerPart];
    if (integerPart < 100) {
      const tensDigit = Math.floor(integerPart / 10);
      const onesDigit = integerPart % 10;
      return `${tens[tensDigit]} ${ones[onesDigit]}`.trim();
    }
    return `${integerPart}`;
  }
}

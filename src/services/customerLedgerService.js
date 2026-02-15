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
      const total = Number(sale.total || 0);
      const remainingFromSale = Number(sale.remainingAmount ?? sale.remaining);
      const paidFromSale = Number(sale.paidAmount ?? sale.paid);
      const remaining = Number.isFinite(remainingFromSale)
        ? Math.max(0, remainingFromSale)
        : (sale.saleType === 'آجل' ? total : 0);
      const paid = Number.isFinite(paidFromSale)
        ? Math.max(0, paidFromSale)
        : Math.max(0, total - remaining);

      transactions.push({
        id: `sale-${sale.id}`,
        date: this.getSaleDate(sale),
        type: 'بيع',
        typeColor: '#3b82f6',
        description: `فاتورة بيع #${sale.id}`,
        debit: remaining,
        credit: 0,
        total,
        paid,
        remaining,
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
   * Net balance effect of a single transaction
   * Positive -> increases receivable, Negative -> decreases receivable
   */
  static getTransactionEffect(transaction) {
    const debit = Number(transaction?.debit || 0);
    const credit = Number(transaction?.credit || 0);
    return debit - credit;
  }

  /**
   * Attach running balance to each transaction row
   */
  static attachRunningBalance(transactions, finalBalance) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    const ascending = [...transactions].sort((a, b) => {
      const timeDiff = a.date - b.date;
      if (timeDiff !== 0) return timeDiff;
      return String(a.id).localeCompare(String(b.id));
    });

    const totalEffect = ascending.reduce(
      (sum, transaction) => sum + this.getTransactionEffect(transaction),
      0
    );

    let runningBalance = Number(finalBalance || 0) - totalEffect;
    const balanceById = new Map();

    ascending.forEach(transaction => {
      runningBalance += this.getTransactionEffect(transaction);
      balanceById.set(transaction.id, runningBalance);
    });

    return transactions.map(transaction => ({
      ...transaction,
      runningBalance: balanceById.get(transaction.id) ?? Number(finalBalance || 0)
    }));
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

    const fromBoundary = fromDate ? new Date(fromDate) : null;
    const toBoundary = toDate ? new Date(toDate) : null;

    if (fromBoundary) {
      fromBoundary.setHours(0, 0, 0, 0);
    }

    if (toBoundary) {
      toBoundary.setHours(23, 59, 59, 999);
    }

    return transactions.filter(t => {
      const transDate = t.date;
      if (fromBoundary && transDate < fromBoundary) return false;
      if (toBoundary && transDate > toBoundary) return false;
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

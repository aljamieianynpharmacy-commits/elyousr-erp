/**
 * Customer Ledger Service
 * Handles all accounting logic and ledger calculations
 */

export class CustomerLedgerService {
  static SMART_MONTHS_DEFAULT = 6;

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

  static clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  static getMonthStart(dateValue) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }

  static getMonthEnd(monthStart) {
    return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  static getMonthKey(dateValue) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
  }

  static isValidDate(value) {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }

  static normalizePaymentAmountFromSale(sale) {
    const total = Number(sale?.total || 0);
    const remainingFromSale = Number(sale?.remainingAmount ?? sale?.remaining);
    const paidFromSale = Number(sale?.paidAmount ?? sale?.paid);

    const remaining = Number.isFinite(remainingFromSale)
      ? Math.max(0, remainingFromSale)
      : 0;

    if (Number.isFinite(paidFromSale)) {
      return Math.max(0, paidFromSale);
    }

    return Math.max(0, total - remaining);
  }

  /**
   * Build a smart payment behavior report for last N months.
   * Includes invoice-paid amounts + standalone payments.
   */
  static buildSmartPaymentInsight(
    customer,
    sales = [],
    payments = [],
    returns = [],
    options = {}
  ) {
    const monthsCount = Math.max(
      1,
      parseInt(options?.months, 10) || this.SMART_MONTHS_DEFAULT
    );

    const now = options?.now ? new Date(options.now) : new Date();
    const safeNow = this.isValidDate(now) ? now : new Date();
    const currentMonthStart = this.getMonthStart(safeNow);
    const windowStart = new Date(
      currentMonthStart.getFullYear(),
      currentMonthStart.getMonth() - (monthsCount - 1),
      1,
      0,
      0,
      0,
      0
    );

    const firstActivityDate = customer?.firstActivityDate
      ? new Date(customer.firstActivityDate)
      : null;
    const firstActivityMonth = this.isValidDate(firstActivityDate)
      ? this.getMonthStart(firstActivityDate)
      : null;

    const effectiveStart =
      firstActivityMonth && firstActivityMonth > windowStart ? firstActivityMonth : windowStart;

    const buckets = [];
    const bucketByKey = new Map();

    for (let offset = monthsCount - 1; offset >= 0; offset -= 1) {
      const monthStart = new Date(
        currentMonthStart.getFullYear(),
        currentMonthStart.getMonth() - offset,
        1,
        0,
        0,
        0,
        0
      );

      if (monthStart < effectiveStart) continue;

      const key = this.getMonthKey(monthStart);
      const bucket = {
        key,
        label: monthStart.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
        monthStart,
        monthEnd: this.getMonthEnd(monthStart),
        dueAmount: 0,
        paidAmount: 0,
        reliefAmount: 0,
        paymentEvents: 0,
        hasInvoicePayment: false,
        hasStandalonePayment: false,
        delayDays: 0,
        hadObligation: false,
        statusLabel: 'لا نشاط'
      };

      buckets.push(bucket);
      bucketByKey.set(key, bucket);
    }

    const paymentEventDates = [];

    (sales || []).forEach((sale) => {
      const saleDate = this.getSaleDate(sale);
      if (!this.isValidDate(saleDate)) return;
      const monthKey = this.getMonthKey(saleDate);
      const bucket = bucketByKey.get(monthKey);
      if (!bucket) return;

      const total = Math.max(0, Number(sale?.total || 0));
      const paid = this.normalizePaymentAmountFromSale(sale);

      bucket.dueAmount += total;
      if (paid > 0) {
        bucket.paidAmount += paid;
        bucket.paymentEvents += 1;
        bucket.hasInvoicePayment = true;
        paymentEventDates.push(new Date(saleDate));
      }
    });

    (payments || []).forEach((payment) => {
      const amount = Math.max(0, Number(payment?.amount || 0));
      if (amount <= 0) return;

      const paymentDate = payment?.paymentDate
        ? new Date(payment.paymentDate)
        : new Date(payment?.createdAt);
      if (!this.isValidDate(paymentDate)) return;

      const monthKey = this.getMonthKey(paymentDate);
      const bucket = bucketByKey.get(monthKey);
      if (!bucket) return;

      bucket.paidAmount += amount;
      bucket.paymentEvents += 1;
      bucket.hasStandalonePayment = true;
      paymentEventDates.push(new Date(paymentDate));
    });

    (returns || []).forEach((returnItem) => {
      const returnDate = new Date(returnItem?.createdAt);
      if (!this.isValidDate(returnDate)) return;

      const monthKey = this.getMonthKey(returnDate);
      const bucket = bucketByKey.get(monthKey);
      if (!bucket) return;

      const returnTotal = Math.max(0, Number(returnItem?.total || 0));
      bucket.reliefAmount += returnTotal;
    });

    paymentEventDates.sort((a, b) => a - b);

    const totalDue = buckets.reduce((sum, bucket) => sum + bucket.dueAmount, 0);
    const totalPaid = buckets.reduce((sum, bucket) => sum + bucket.paidAmount, 0);
    const totalRelief = buckets.reduce((sum, bucket) => sum + bucket.reliefAmount, 0);
    const windowNet = totalDue - totalPaid - totalRelief;
    const currentBalance = Math.max(0, Number(customer?.balance || 0));
    const inferredStartOutstanding = Math.max(0, currentBalance - windowNet);

    const dayMs = 24 * 60 * 60 * 1000;
    let runningOutstanding = inferredStartOutstanding;
    let expectedMonths = 0;
    let monthsWithPayment = 0;
    let missedMonths = 0;
    let longestMissStreak = 0;
    let activeMissStreak = 0;
    let delayDaysTotal = 0;
    let delayMonthsCount = 0;

    buckets.forEach((bucket) => {
      const hadObligation = runningOutstanding > 0.009 || bucket.dueAmount > 0.009;
      const hasPayment = bucket.paymentEvents > 0;
      bucket.hadObligation = hadObligation;

      if (hadObligation) {
        expectedMonths += 1;
        if (hasPayment) {
          monthsWithPayment += 1;
          activeMissStreak = 0;
          bucket.delayDays = 0;
        } else {
          missedMonths += 1;
          activeMissStreak += 1;
          longestMissStreak = Math.max(longestMissStreak, activeMissStreak);

          const nextPaymentDate = paymentEventDates.find((eventDate) => eventDate > bucket.monthEnd);
          const delayReference = nextPaymentDate || safeNow;
          const rawDelay = Math.ceil((delayReference - bucket.monthEnd) / dayMs);
          bucket.delayDays = Math.max(0, rawDelay);
          delayDaysTotal += bucket.delayDays;
          delayMonthsCount += 1;
        }
      } else {
        bucket.delayDays = 0;
        activeMissStreak = 0;
      }

      if (!hadObligation) {
        bucket.statusLabel = 'لا يوجد استحقاق';
      } else if (hasPayment) {
        bucket.statusLabel = 'مدفوع';
      } else if (bucket.delayDays <= 30) {
        bucket.statusLabel = 'متأخر';
      } else {
        bucket.statusLabel = 'متأخر بشدة';
      }

      runningOutstanding = Math.max(
        0,
        runningOutstanding + bucket.dueAmount - bucket.paidAmount - bucket.reliefAmount
      );
      bucket.outstandingEnd = runningOutstanding;
    });

    const averageDelayDays =
      delayMonthsCount > 0 ? delayDaysTotal / delayMonthsCount : 0;
    const regularityRate = expectedMonths > 0 ? monthsWithPayment / expectedMonths : 1;
    const coverageRatio =
      totalDue > 0 ? this.clamp(totalPaid / totalDue, 0, 2) : (totalPaid > 0 ? 1 : 1);

    let score = 100;
    score -= (1 - regularityRate) * 55;
    score -= Math.min(4, longestMissStreak) * 8;
    score -= (Math.min(averageDelayDays, 90) / 90) * 20;
    if (coverageRatio < 1) {
      score -= (1 - coverageRatio) * 25;
    }
    score = Math.round(this.clamp(score, 0, 100));

    let classification = 'ملتزم';
    let tone = 'good';
    if (score < 30) {
      classification = 'عالي المخاطر';
      tone = 'danger';
    } else if (score < 50) {
      classification = 'متأخر';
      tone = 'bad';
    } else if (score < 70) {
      classification = 'متذبذب';
      tone = 'warn';
    } else if (score < 85) {
      classification = 'جيد';
      tone = 'good';
    }

    let pattern = 'منتظم شهريا';
    if (expectedMonths === 0) {
      pattern = 'لا توجد مديونية خلال الفترة';
    } else if (monthsWithPayment === 0) {
      pattern = 'لا يوجد سداد خلال آخر 6 شهور';
    } else if (missedMonths === 0) {
      pattern = 'دفع مرة واحدة على الأقل كل شهر';
    } else if (longestMissStreak >= 2) {
      pattern = `يدفع ثم يتأخر ${longestMissStreak} شهر`;
    } else {
      pattern = 'سداد غير منتظم';
    }

    const reasons = [];
    reasons.push(`التزام شهري: ${monthsWithPayment}/${expectedMonths || 0}`);
    reasons.push(`نسبة تغطية السداد: ${(coverageRatio * 100).toFixed(0)}%`);
    if (missedMonths > 0) {
      reasons.push(`أشهر بدون سداد: ${missedMonths}`);
    }
    if (averageDelayDays > 0) {
      reasons.push(`متوسط التأخير: ${averageDelayDays.toFixed(0)} يوم`);
    }

    return {
      periodMonths: monthsCount,
      from: effectiveStart,
      to: safeNow,
      score,
      classification,
      tone,
      pattern,
      reasons,
      metrics: {
        expectedMonths,
        monthsWithPayment,
        missedMonths,
        longestMissStreak,
        averageDelayDays,
        totalDue,
        totalPaid,
        totalRelief,
        regularityRate,
        coverageRatio,
        inferredStartOutstanding
      },
      timeline: buckets.map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        dueAmount: bucket.dueAmount,
        paidAmount: bucket.paidAmount,
        paymentEvents: bucket.paymentEvents,
        delayDays: bucket.delayDays,
        hadObligation: bucket.hadObligation,
        statusLabel: bucket.statusLabel,
        outstandingEnd: bucket.outstandingEnd
      }))
    };
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

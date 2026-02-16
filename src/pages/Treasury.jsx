import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { safeAlert } from '../utils/safeAlert';
import { safePrint } from '../printing/safePrint';
import { safeConfirm } from '../utils/safeConfirm';
import './Treasury.css';

const ENTRY_TYPE_OPTIONS = [
  'OPENING_BALANCE',
  'SALE_INCOME',
  'CUSTOMER_PAYMENT',
  'MANUAL_IN',
  'EXPENSE_PAYMENT',
  'PURCHASE_PAYMENT',
  'SUPPLIER_PAYMENT',
  'RETURN_REFUND',
  'MANUAL_OUT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT'
];

const TAB_OPTIONS = [
  { id: 'treasuries', label: '🏦 الخزن' },
  { id: 'transactions', label: '🔄 الحركات' },
  { id: 'daily', label: '📈 الإيراد اليومي' },
  { id: 'expenses', label: '💸 المصروفات' }
];

const EXPENSE_CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#0d9488'
];

const ENTRY_TYPE_LABELS = {
  OPENING_BALANCE: 'رصيد افتتاحي',
  SALE_INCOME: 'إيراد بيع',
  CUSTOMER_PAYMENT: 'تحصيل عميل',
  MANUAL_IN: 'إضافة يدوية',
  EXPENSE_PAYMENT: 'صرف مصروف',
  PURCHASE_PAYMENT: 'سداد مشتريات',
  SUPPLIER_PAYMENT: 'سداد مورد',
  RETURN_REFUND: 'رد قيمة مرتجع',
  MANUAL_OUT: 'صرف يدوي',
  TRANSFER_IN: 'تحويل وارد',
  TRANSFER_OUT: 'تحويل صادر',
  ADJUSTMENT_IN: 'تسوية زيادة',
  ADJUSTMENT_OUT: 'تسوية عجز'
};

const REFERENCE_TYPE_LABELS = {
  SALE: 'فاتورة بيع',
  PAYMENT: 'دفعة عميل',
  RETURN: 'مرتجع',
  PURCHASE: 'فاتورة شراء',
  SUPPLIER_PAYMENT: 'دفعة مورد',
  EXPENSE: 'مصروف',
  TREASURY_TRANSFER: 'تحويل خزنة',
  TREASURY_TRANSACTION: 'حركة خزنة',
  MANUAL: 'مرجع يدوي'
};

const DIRECTION_LABELS = { IN: 'وارد', OUT: 'منصرف', TRANSFER: 'تحويل' };

const moneyFormatter = new Intl.NumberFormat('ar-EG', {
  style: 'currency',
  currency: 'EGP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const formatMoney = (value) => moneyFormatter.format(Number(value || 0));
const todayDate = () => new Date().toISOString().split('T')[0];
const toInt = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const toAmount = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatDateTime = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('ar-EG', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
};

const resolveMethodName = (entryOrRow) => {
  const code = String(entryOrRow?.code || entryOrRow?.paymentMethod?.code || '').toUpperCase();
  if (code === 'CASH') return 'نقدي';
  if (code === 'VODAFONE_CASH') return 'فودافون كاش';
  if (code === 'INSTAPAY') return 'إنستا باي';
  return entryOrRow?.name || entryOrRow?.paymentMethod?.name || '-';
};

const resolveEntryTypeLabel = (entryType) => ENTRY_TYPE_LABELS[entryType] || entryType || '-';
const resolveDirectionLabel = (direction) => DIRECTION_LABELS[direction] || direction || '-';
const resolveReferenceLabel = (referenceType) => REFERENCE_TYPE_LABELS[referenceType] || referenceType || '-';
const formatReference = (row) => {
  const label = resolveReferenceLabel(row?.referenceType);
  return row?.referenceId ? `${label} #${row.referenceId}` : label;
};

const emptyTreasuryForm = () => ({
  name: '',
  code: '',
  openingBalance: '0',
  description: '',
  isDefault: false
});

const parseStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildZReportHtml = ({ report, treasuryName, fromDate, toDate }) => {
  const summary = report?.summary || {};
  const sales = report?.sales || {};
  const revenue = report?.revenue?.summary || {};
  const methods = Array.isArray(report?.revenue?.byPaymentMethod) ? report.revenue.byPaymentMethod : [];
  const rows = Array.isArray(report?.entries)
    ? report.entries.filter((entry) => ['SALE_INCOME', 'RETURN_REFUND', 'CUSTOMER_PAYMENT'].includes(entry.entryType))
    : [];

  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><style>
  @page { size: A4; margin: 10mm; }
  body { font-family: "Cairo", "Tahoma", sans-serif; color: #0f172a; margin: 0; direction: rtl; }
  .page { padding: 12px; }
  h1 { margin: 0; font-size: 22px; }
  .meta { margin: 8px 0 14px; font-size: 12px; color: #475569; }
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
  .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; background: #f8fbff; }
  .label { font-size: 11px; color: #64748b; }
  .value { font-size: 13px; font-weight: 700; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: right; }
  th { background: #f1f5f9; }
  .in { color: #047857; font-weight: 700; }
  .out { color: #b91c1c; font-weight: 700; }
  .no-print button { border: none; border-radius: 8px; padding: 8px 14px; background: #0f766e; color: #fff; cursor: pointer; }
  @media print { .no-print { display: none; } }
  </style></head><body><div class="page">
  <h1>تقرير Z للخزنة</h1>
  <div class="meta">الفترة: ${escapeHtml(fromDate)} - ${escapeHtml(toDate)} | الخزنة: ${escapeHtml(treasuryName)} | وقت الطباعة: ${escapeHtml(formatDateTime(new Date()))}</div>
  <div class="grid">
    <div class="card"><div class="label">إجمالي المبيعات</div><div class="value">${escapeHtml(formatMoney(sales.totalSales || 0))}</div></div>
    <div class="card"><div class="label">إجمالي المرتجعات</div><div class="value">${escapeHtml(formatMoney(sales.totalReturns || 0))}</div></div>
    <div class="card"><div class="label">صافي المبيعات</div><div class="value">${escapeHtml(formatMoney(sales.netSales || 0))}</div></div>
    <div class="card"><div class="label">صافي التدفق النقدي</div><div class="value">${escapeHtml(formatMoney(summary.netCashIn || 0))}</div></div>
    <div class="card"><div class="label">إجمالي الإيراد</div><div class="value">${escapeHtml(formatMoney(revenue.totalRevenue || 0))}</div></div>
    <div class="card"><div class="label">تحصيلات العملاء</div><div class="value">${escapeHtml(formatMoney(revenue.customerPayments || 0))}</div></div>
  </div>
  <h3>حسب وسيلة الدفع</h3>
  <table><thead><tr><th>الوسيلة</th><th>الإيراد</th><th>المبيعات</th><th>تحصيل العملاء</th></tr></thead><tbody>
  ${methods.length === 0 ? '<tr><td colspan="4">لا توجد بيانات</td></tr>' : methods.map((row) => `<tr><td>${escapeHtml(resolveMethodName(row))}</td><td class="in">${escapeHtml(formatMoney(row.revenueAmount || row.amount || 0))}</td><td>${escapeHtml(formatMoney(row.saleIncomeAmount || 0))}</td><td>${escapeHtml(formatMoney(row.customerPaymentAmount || 0))}</td></tr>`).join('')}
  </tbody></table>
  <h3>تفاصيل الحركات</h3>
  <table><thead><tr><th>المعرف</th><th>التاريخ</th><th>النوع</th><th>الاتجاه</th><th>الوسيلة</th><th>المبلغ</th><th>المرجع</th><th>ملاحظة</th></tr></thead><tbody>
  ${rows.length === 0 ? '<tr><td colspan="8">لا توجد حركات</td></tr>' : rows.map((row) => `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(formatDateTime(row.entryDate || row.createdAt))}</td><td>${escapeHtml(resolveEntryTypeLabel(row.entryType))}</td><td>${escapeHtml(resolveDirectionLabel(row.direction))}</td><td>${escapeHtml(resolveMethodName(row))}</td><td class="${row.direction === 'OUT' ? 'out' : 'in'}">${escapeHtml(formatMoney(row.amount || 0))}</td><td>${escapeHtml(formatReference(row))}</td><td>${escapeHtml(row.note || row.notes || '-')}</td></tr>`).join('')}
  </tbody></table>
  <div class="no-print" style="margin-top:10px;"><button onclick="window.print()">طباعة</button></div>
  </div></body></html>`;
};

export default function Treasury() {
  const currentUser = useMemo(() => parseStoredUser(), []);

  const [activeTab, setActiveTab] = useState('daily');
  const [bootstrapping, setBootstrapping] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [treasuries, setTreasuries] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [entries, setEntries] = useState([]);
  const [entriesSummary, setEntriesSummary] = useState({ totalIn: 0, totalOut: 0, net: 0 });
  const [dailyReport, setDailyReport] = useState(null);

  const [filters, setFilters] = useState({ treasuryId: '', fromDate: todayDate(), toDate: todayDate(), direction: 'ALL', entryType: 'ALL', search: '' });
  const [reportFilters, setReportFilters] = useState({ treasuryId: '', fromDate: todayDate(), toDate: todayDate() });

  const [treasuryForm, setTreasuryForm] = useState(emptyTreasuryForm);
  const [treasuryModalState, setTreasuryModalState] = useState({
    isOpen: false,
    mode: 'create',
    treasuryId: null
  });
  const [transactionForm, setTransactionForm] = useState({
    transactionType: 'IN', treasuryId: '', sourceTreasuryId: '', targetTreasuryId: '', amount: '',
    paymentMethodId: '', entryType: '', notes: '', entryDate: todayDate()
  });

  // ── Expense state ──
  const [expenses, setExpenses] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenseFilters, setExpenseFilters] = useState({ fromDate: todayDate(), toDate: todayDate(), categoryId: '' });
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', categoryId: '', notes: '', expenseDate: todayDate(), treasuryId: '', paymentMethodId: '' });
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', color: EXPENSE_CATEGORY_COLORS[0] });
  const [editingCategory, setEditingCategory] = useState(null);

  const selectedReportTreasuryId = useMemo(
    () => toInt(reportFilters.treasuryId) || toInt(filters.treasuryId) || treasuries[0]?.id || null,
    [filters.treasuryId, reportFilters.treasuryId, treasuries]
  );

  const selectedTreasuryName = useMemo(() => {
    if (!selectedReportTreasuryId) return 'كل الخزن';
    const matched = treasuries.find((item) => item.id === selectedReportTreasuryId);
    return matched?.name || `الخزنة #${selectedReportTreasuryId}`;
  }, [selectedReportTreasuryId, treasuries]);

  const selectedDailyTreasuryName = useMemo(() => {
    const dailyTreasuryId = toInt(reportFilters.treasuryId);
    if (!dailyTreasuryId) return 'كل الخزن';
    const matched = treasuries.find((item) => item.id === dailyTreasuryId);
    return matched?.name || `الخزنة #${dailyTreasuryId}`;
  }, [reportFilters.treasuryId, treasuries]);

  const movementSummary = dailyReport?.summary || {};
  const salesSummary = dailyReport?.sales || {};
  const revenueSummary = dailyReport?.revenue?.summary || {};
  const revenueByMethod = Array.isArray(dailyReport?.revenue?.byPaymentMethod) ? dailyReport.revenue.byPaymentMethod : [];
  const revenueBySource = Array.isArray(dailyReport?.revenue?.bySource) ? dailyReport.revenue.bySource : [];
  const revenueBySourceVisible = useMemo(
    () => revenueBySource.filter((row) => !['DEPOSIT_IN', 'DEPOSIT_REFUND'].includes(String(row?.entryType || '').toUpperCase())),
    [revenueBySource]
  );
  const revenueByTreasury = Array.isArray(dailyReport?.revenue?.byTreasury) ? dailyReport.revenue.byTreasury : [];
  const revenueEntries = Array.isArray(dailyReport?.revenue?.entries) ? dailyReport.revenue.entries : [];

  const channelTotals = revenueSummary.channelTotals || {};
  const totalTreasuryBalance = useMemo(() => treasuries.reduce((sum, row) => sum + Number(row.currentBalance || 0), 0), [treasuries]);

  const loadTreasuryBaseData = useCallback(async () => {
    const [treasuryResponse, paymentMethodsResponse] = await Promise.all([
      window.api.getTreasuries(),
      window.api.getPaymentMethods()
    ]);

    if (treasuryResponse?.error) throw new Error(treasuryResponse.error);
    if (paymentMethodsResponse?.error) throw new Error(paymentMethodsResponse.error);

    const treasuryRows = Array.isArray(treasuryResponse) ? treasuryResponse : (Array.isArray(treasuryResponse?.data) ? treasuryResponse.data : []);
    const methodRows = Array.isArray(paymentMethodsResponse) ? paymentMethodsResponse : [];

    setTreasuries(treasuryRows);
    setPaymentMethods(methodRows);

    const firstTreasuryId = treasuryRows[0]?.id ? String(treasuryRows[0].id) : '';
    setFilters((prev) => {
      if (!firstTreasuryId) return prev;
      const exists = treasuryRows.some((row) => String(row.id) === String(prev.treasuryId));
      return exists ? prev : { ...prev, treasuryId: firstTreasuryId };
    });
    setReportFilters((prev) => {
      if (!firstTreasuryId) return prev;
      const exists = treasuryRows.some((row) => String(row.id) === String(prev.treasuryId));
      return exists ? prev : { ...prev, treasuryId: firstTreasuryId };
    });
  }, []);

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const result = await window.api.getTreasuryEntries({
        treasuryId: toInt(filters.treasuryId),
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        direction: filters.direction,
        entryType: filters.entryType,
        search: filters.search
      });
      if (result?.error) throw new Error(result.error);
      setEntries(Array.isArray(result?.data) ? result.data : []);
      setEntriesSummary(result?.summary || { totalIn: 0, totalOut: 0, net: 0 });
    } catch (error) {
      await safeAlert(`تعذّر تحميل حركات الخزنة: ${error.message}`);
    } finally {
      setEntriesLoading(false);
    }
  }, [filters]);

  const loadDailyReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const result = await window.api.getDailyRevenueReport({
        treasuryId: toInt(reportFilters.treasuryId),
        fromDate: reportFilters.fromDate,
        toDate: reportFilters.toDate
      });
      if (result?.error) throw new Error(result.error);
      setDailyReport(result || null);
    } catch (error) {
      await safeAlert(`تعذّر تحميل تقرير الإيراد اليومي: ${error.message}`);
    } finally {
      setReportLoading(false);
    }
  }, [reportFilters]);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      setBootstrapping(true);
      try {
        await loadTreasuryBaseData();
      } catch (error) {
        await safeAlert(`تعذّر تهيئة شاشة الخزنة: ${error.message}`);
      } finally {
        if (mounted) setBootstrapping(false);
      }
    };
    void bootstrap();
    return () => { mounted = false; };
  }, [loadTreasuryBaseData]);

  useEffect(() => {
    if (bootstrapping) return;
    void loadEntries();
  }, [bootstrapping, loadEntries]);

  useEffect(() => {
    if (bootstrapping) return;
    void loadDailyReport();
  }, [bootstrapping, loadDailyReport]);

  const refreshAll = useCallback(async () => {
    setBootstrapping(true);
    try {
      await loadTreasuryBaseData();
      await Promise.all([loadEntries(), loadDailyReport()]);
    } catch (error) {
      await safeAlert(`تعذّر تحديث البيانات: ${error.message}`);
    } finally {
      setBootstrapping(false);
    }
  }, [loadDailyReport, loadEntries, loadTreasuryBaseData]);

  const openCreateTreasuryModal = () => {
    setTreasuryForm(emptyTreasuryForm());
    setTreasuryModalState({
      isOpen: true,
      mode: 'create',
      treasuryId: null
    });
  };

  const openEditTreasuryModal = (treasury) => {
    if (!treasury) return;
    setTreasuryForm({
      name: treasury.name || '',
      code: treasury.code || '',
      openingBalance: String(Number(treasury.openingBalance || 0)),
      description: treasury.description || '',
      isDefault: Boolean(treasury.isDefault)
    });
    setTreasuryModalState({
      isOpen: true,
      mode: 'edit',
      treasuryId: treasury.id
    });
  };

  const closeTreasuryModal = () => {
    setTreasuryModalState({
      isOpen: false,
      mode: 'create',
      treasuryId: null
    });
    setTreasuryForm(emptyTreasuryForm());
  };

  const handleSaveTreasury = async (event) => {
    event.preventDefault();
    const name = treasuryForm.name.trim();
    if (!name) {
      await safeAlert('اسم الخزنة مطلوب');
      return;
    }

    const payload = {
      name,
      code: treasuryForm.code.trim(),
      openingBalance: Math.max(0, toAmount(treasuryForm.openingBalance)),
      description: treasuryForm.description.trim() || null,
      isDefault: Boolean(treasuryForm.isDefault),
      openingDate: todayDate()
    };

    setSubmitting(true);
    try {
      if (treasuryModalState.mode === 'edit' && treasuryModalState.treasuryId) {
        const result = await window.api.updateTreasury(treasuryModalState.treasuryId, {
          ...payload,
          updatedByUserId: toInt(currentUser?.id)
        });
        if (result?.error) throw new Error(result.error);
      } else {
        const result = await window.api.createTreasury({
          ...payload,
          createdByUserId: toInt(currentUser?.id)
        });
        if (result?.error) throw new Error(result.error);
      }

      closeTreasuryModal();
      await refreshAll();
    } catch (error) {
      await safeAlert(`تعذّر حفظ بيانات الخزنة: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDefaultTreasury = async (treasury) => {
    if (!treasury?.id || treasury?.isDefault) return;

    setSubmitting(true);
    try {
      const result = await window.api.setDefaultTreasury(treasury.id, {
        updatedByUserId: toInt(currentUser?.id),
        source: 'TreasuryPage'
      });
      if (result?.error) throw new Error(result.error);
      await refreshAll();
    } catch (error) {
      await safeAlert(`تعذّر تعيين الخزنة الافتراضية: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTreasury = async (treasury) => {
    if (!treasury?.id) return;

    const confirmed = await safeConfirm(
      `هل تريد حذف الخزنة \"${treasury.name}\"؟`,
      {
        title: 'تأكيد حذف خزنة',
        detail: treasury.hasLinkedOperations
          ? 'الخزنة مرتبطة بعمليات، سيتم حذفها بشكل آمن كأرشيف بدون فقد بيانات.'
          : 'سيتم حذف الخزنة نهائيًا.',
        buttons: ['حذف', 'إلغاء']
      }
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const result = await window.api.deleteTreasury(treasury.id, {
        deletedByUserId: toInt(currentUser?.id)
      });
      if (result?.error) throw new Error(result.error);
      await refreshAll();
    } catch (error) {
      await safeAlert(`تعذّر حذف الخزنة: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTransaction = async (event) => {
    event.preventDefault();
    const amount = Math.max(0, toAmount(transactionForm.amount));
    if (amount <= 0) {
      await safeAlert('قيمة المبلغ غير صحيحة');
      return;
    }

    const payload = {
      transactionType: transactionForm.transactionType,
      amount,
      notes: transactionForm.notes,
      entryDate: transactionForm.entryDate,
      createdByUserId: toInt(currentUser?.id)
    };

    if (transactionForm.transactionType === 'TRANSFER') {
      payload.sourceTreasuryId = toInt(transactionForm.sourceTreasuryId);
      payload.targetTreasuryId = toInt(transactionForm.targetTreasuryId);
      if (!payload.sourceTreasuryId || !payload.targetTreasuryId || payload.sourceTreasuryId === payload.targetTreasuryId) {
        await safeAlert('خزنة المصدر والوجهة غير صحيحتين');
        return;
      }
    } else {
      payload.treasuryId = toInt(transactionForm.treasuryId);
      payload.paymentMethodId = toInt(transactionForm.paymentMethodId);
      payload.entryType = transactionForm.entryType || undefined;
      if (!payload.treasuryId) {
        await safeAlert('يجب اختيار خزنة');
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await window.api.createTreasuryTransaction(payload);
      if (result?.error) throw new Error(result.error);
      setTransactionForm((prev) => ({ ...prev, amount: '', notes: '', paymentMethodId: '', entryType: '' }));
      await refreshAll();
    } catch (error) {
      await safeAlert(`تعذّر تسجيل الحركة: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintZReport = async () => {
    if (!dailyReport) {
      await safeAlert('لا يوجد تقرير متاح للطباعة');
      return;
    }

    const html = buildZReportHtml({ report: dailyReport, treasuryName: selectedTreasuryName, fromDate: reportFilters.fromDate, toDate: reportFilters.toDate });
    const result = await safePrint(html, { title: `تقرير Z ${reportFilters.fromDate} - ${reportFilters.toDate}` });
    if (result?.error) await safeAlert(result.error);
  };

  // ── Expense handlers ──
  const loadExpenses = useCallback(async () => {
    setExpensesLoading(true);
    try {
      const [expRes, catRes] = await Promise.all([
        window.api.getExpenses({ fromDate: expenseFilters.fromDate, toDate: expenseFilters.toDate, categoryId: toInt(expenseFilters.categoryId) || undefined }),
        window.api.getExpenseCategories()
      ]);
      if (!expRes?.error) setExpenses(Array.isArray(expRes) ? expRes : []);
      if (!catRes?.error) setExpenseCategories(Array.isArray(catRes) ? catRes : []);
    } catch (e) { /* silent */ }
    setExpensesLoading(false);
  }, [expenseFilters]);

  useEffect(() => { if (!bootstrapping) void loadExpenses(); }, [bootstrapping, loadExpenses]);

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount || 0), 0), [expenses]);

  const openExpenseModal = (expense = null) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseForm({ title: expense.title, amount: String(expense.amount), categoryId: expense.categoryId ? String(expense.categoryId) : '', notes: expense.notes || '', expenseDate: expense.expenseDate ? new Date(expense.expenseDate).toISOString().split('T')[0] : todayDate(), treasuryId: '', paymentMethodId: '' });
    } else {
      setEditingExpense(null);
      setExpenseForm({ title: '', amount: '', categoryId: '', notes: '', expenseDate: todayDate(), treasuryId: '', paymentMethodId: '' });
    }
    setExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const title = expenseForm.title.trim();
    const amount = toAmount(expenseForm.amount);
    if (!title) { await safeAlert('عنوان المصروف مطلوب'); return; }
    if (amount <= 0) { await safeAlert('المبلغ غير صحيح'); return; }
    setSubmitting(true);
    try {
      const payload = { title, amount, categoryId: toInt(expenseForm.categoryId) || null, notes: expenseForm.notes, expenseDate: expenseForm.expenseDate, treasuryId: toInt(expenseForm.treasuryId) || undefined, paymentMethodId: toInt(expenseForm.paymentMethodId) || undefined };
      let res;
      if (editingExpense) {
        res = await window.api.updateExpense(editingExpense.id, payload);
      } else {
        res = await window.api.addExpense(payload);
      }
      if (res?.error) throw new Error(res.error);
      setExpenseModalOpen(false);
      setEditingExpense(null);
      await Promise.all([loadExpenses(), refreshAll()]);
    } catch (err) { await safeAlert(`تعذّر حفظ المصروف: ${err.message}`); }
    setSubmitting(false);
  };

  const handleDeleteExpense = async (expense) => {
    const confirmed = await safeConfirm(`هل تريد حذف المصروف "${expense.title}"؟`, { title: 'تأكيد حذف مصروف', buttons: ['حذف', 'إلغاء'] });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      const res = await window.api.deleteExpense(expense.id);
      if (res?.error) throw new Error(res.error);
      await Promise.all([loadExpenses(), refreshAll()]);
    } catch (err) { await safeAlert(`تعذّر حذف المصروف: ${err.message}`); }
    setSubmitting(false);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    const name = categoryForm.name.trim();
    if (!name) { await safeAlert('اسم التصنيف مطلوب'); return; }
    setSubmitting(true);
    try {
      let res;
      if (editingCategory) {
        res = await window.api.updateExpenseCategory(editingCategory.id, { name, color: categoryForm.color });
      } else {
        res = await window.api.addExpenseCategory({ name, color: categoryForm.color });
      }
      if (res?.error) throw new Error(res.error);
      setCategoryFormOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', color: EXPENSE_CATEGORY_COLORS[0] });
      await loadExpenses();
    } catch (err) { await safeAlert(`تعذّر حفظ التصنيف: ${err.message}`); }
    setSubmitting(false);
  };

  const handleDeleteCategory = async (cat) => {
    const confirmed = await safeConfirm(`هل تريد حذف تصنيف "${cat.name}"؟`, { title: 'تأكيد حذف تصنيف', buttons: ['حذف', 'إلغاء'] });
    if (!confirmed) return;
    try {
      const res = await window.api.deleteExpenseCategory(cat.id);
      if (res?.error) throw new Error(res.error);
      await loadExpenses();
    } catch (err) { await safeAlert(`تعذّر حذف التصنيف: ${err.message}`); }
  };

  if (bootstrapping) {
    return <div className="treasury-loading">جاري تحميل بيانات الخزنة...</div>;
  }

  return (
    <div className="treasury-page">

      {/* ── Tab Navigation ── */}
      <section className="treasury-panel">
        <div className="treasury-tabs">
          {TAB_OPTIONS.map((tab) => (
            <button key={tab.id} type="button" className={`treasury-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
          ))}
        </div>
      </section>

      {activeTab === 'treasuries' && (
        <section className="treasury-panel">
          <div className="panel-head">
            <h2>🏦 الخزن</h2>
            <div className="panel-head-actions">
              <button className="treasury-btn secondary" type="button" onClick={openCreateTreasuryModal}>+ إضافة خزنة</button>
            </div>
          </div>
          <div className="treasury-balance-grid">
            {treasuries.map((treasury) => (
              <div className={`treasury-balance-card ${selectedReportTreasuryId === treasury.id ? 'selected' : ''}`} key={treasury.id}>
                <div className="card-top-row">
                  <strong>{treasury.name}</strong>
                  <div className="card-badges">
                    {treasury.isDefault && <span className="status-default">افتراضية</span>}
                    <span className={treasury.isActive ? 'status-active' : 'status-inactive'}>{treasury.isActive ? 'نشطة' : 'موقوفة'}</span>
                  </div>
                </div>
                <div className="card-amount">{formatMoney(treasury.currentBalance)}</div>
                <div className="card-meta"><span>الكود: {treasury.code || '-'}</span><span>القيود: {treasury?._count?.entries || 0}</span></div>
                <div className="treasury-card-hint">
                  {treasury.hasLinkedOperations
                    ? 'مرتبطة بعمليات: الحذف يتم بشكل آمن (أرشفة) بدون فقد بيانات'
                    : 'غير مرتبطة بعمليات: يمكن الحذف النهائي'}
                </div>
                <div className="treasury-card-actions">
                  <button
                    className="treasury-btn small ghost"
                    type="button"
                    disabled={submitting || treasury.isDefault}
                    onClick={() => void handleSetDefaultTreasury(treasury)}
                  >
                    {treasury.isDefault ? 'الخزنة الافتراضية' : 'تعيين كافتراضية'}
                  </button>
                  <button
                    className="treasury-btn small secondary"
                    type="button"
                    disabled={submitting || treasury.canEdit === false}
                    onClick={() => openEditTreasuryModal(treasury)}
                  >
                    تعديل
                  </button>
                  <button
                    className="treasury-btn small danger"
                    type="button"
                    disabled={submitting || treasury.canDelete === false}
                    onClick={() => void handleDeleteTreasury(treasury)}
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'transactions' && (
        <section className="treasury-panel">
          <div className="panel-head"><h2>🔄 تسجيل حركة خزنة</h2><span>وارد / منصرف / تحويل</span></div>
          <form className="treasury-form" onSubmit={handleCreateTransaction}>
            <div className="treasury-form-grid">
              <label className="field"><span>نوع الحركة</span><select className="treasury-input" value={transactionForm.transactionType} onChange={(event) => setTransactionForm((prev) => ({ ...prev, transactionType: event.target.value }))}><option value="IN">وارد</option><option value="OUT">منصرف</option><option value="TRANSFER">تحويل</option></select></label>
              <label className="field"><span>الخزنة</span><select className="treasury-input" value={transactionForm.treasuryId} onChange={(event) => setTransactionForm((prev) => ({ ...prev, treasuryId: event.target.value }))}><option value="">اختر خزنة</option>{treasuries.map((row) => (<option key={row.id} value={row.id}>{row.name}</option>))}</select></label>
              {transactionForm.transactionType === 'TRANSFER' ? (
                <>
                  <label className="field"><span>خزنة المصدر</span><select className="treasury-input" value={transactionForm.sourceTreasuryId} onChange={(event) => setTransactionForm((prev) => ({ ...prev, sourceTreasuryId: event.target.value }))}><option value="">اختر خزنة</option>{treasuries.map((row) => (<option key={`src-${row.id}`} value={row.id}>{row.name}</option>))}</select></label>
                  <label className="field"><span>خزنة الوجهة</span><select className="treasury-input" value={transactionForm.targetTreasuryId} onChange={(event) => setTransactionForm((prev) => ({ ...prev, targetTreasuryId: event.target.value }))}><option value="">اختر خزنة</option>{treasuries.map((row) => (<option key={`dst-${row.id}`} value={row.id}>{row.name}</option>))}</select></label>
                </>
              ) : (
                <>
                  <label className="field"><span>تصنيف القيد</span><select className="treasury-input" value={transactionForm.entryType} onChange={(event) => setTransactionForm((prev) => ({ ...prev, entryType: event.target.value }))}><option value="">اختياري</option>{ENTRY_TYPE_OPTIONS.map((row) => (<option key={row} value={row}>{resolveEntryTypeLabel(row)}</option>))}</select></label>
                  <label className="field"><span>وسيلة الدفع</span><select className="treasury-input" value={transactionForm.paymentMethodId} onChange={(event) => setTransactionForm((prev) => ({ ...prev, paymentMethodId: event.target.value }))}><option value="">اختياري</option>{paymentMethods.map((row) => (<option key={row.id} value={row.id}>{resolveMethodName(row)}</option>))}</select></label>
                </>
              )}
              <label className="field"><span>المبلغ</span><input className="treasury-input" type="number" min="0" step="0.01" value={transactionForm.amount} onChange={(event) => setTransactionForm((prev) => ({ ...prev, amount: event.target.value }))} required /></label>
              <label className="field"><span>التاريخ</span><input className="treasury-input" type="date" value={transactionForm.entryDate} onChange={(event) => setTransactionForm((prev) => ({ ...prev, entryDate: event.target.value }))} /></label>
              <label className="field field-full"><span>ملاحظات</span><input className="treasury-input" value={transactionForm.notes} onChange={(event) => setTransactionForm((prev) => ({ ...prev, notes: event.target.value }))} /></label>
            </div>
            <button className="treasury-btn primary" type="submit" disabled={submitting}>تسجيل الحركة</button>
          </form>

          <div className="summary-inline" style={{ marginTop: '12px' }}><span className="in-text">إجمالي الوارد: {formatMoney(entriesSummary.totalIn)}</span><span className="out-text">إجمالي المنصرف: {formatMoney(entriesSummary.totalOut)}</span><span>الصافي: {formatMoney(entriesSummary.net)}</span></div>
          <div className="table-wrap" style={{ marginTop: '8px' }}>
            <table className="treasury-table compact">
              <thead><tr><th>المعرف</th><th>التاريخ</th><th>الخزنة</th><th>النوع</th><th>الاتجاه</th><th>المبلغ</th><th>الوسيلة</th><th>المرجع</th><th>الرصيد بعد القيد</th></tr></thead>
              <tbody>{entriesLoading ? (<tr><td colSpan="9" className="empty-cell">جاري التحميل...</td></tr>) : entries.length === 0 ? (<tr><td colSpan="9" className="empty-cell">لا توجد حركات</td></tr>) : entries.map((entry) => (<tr key={entry.id}><td>{entry.id}</td><td>{formatDateTime(entry.entryDate || entry.createdAt)}</td><td>{entry?.treasury?.name || '-'}</td><td>{resolveEntryTypeLabel(entry.entryType)}</td><td className={entry.direction === 'OUT' ? 'out-text' : 'in-text'}>{resolveDirectionLabel(entry.direction)}</td><td className={entry.direction === 'OUT' ? 'out-text' : 'in-text'}>{formatMoney(entry.amount)}</td><td>{resolveMethodName(entry)}</td><td>{formatReference(entry)}</td><td>{formatMoney(entry.balanceAfter)}</td></tr>))}</tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'daily' && (
        <section className="treasury-panel">
          <div className="panel-head"><h2>📈 لوحة الإيراد اليومي</h2></div>
          <div className="daily-filter-shell">
            <div className="daily-filter-grid">
              <label className="daily-filter-field">
                <span>الخزنة</span>
                <select className="treasury-input" value={reportFilters.treasuryId} onChange={(event) => setReportFilters((prev) => ({ ...prev, treasuryId: event.target.value }))}>
                  <option value="">كل الخزن</option>
                  {treasuries.map((row) => (<option key={row.id} value={row.id}>{row.name}</option>))}
                </select>
              </label>
              <label className="daily-filter-field">
                <span>من تاريخ</span>
                <input className="treasury-input" type="date" value={reportFilters.fromDate} onChange={(event) => setReportFilters((prev) => ({ ...prev, fromDate: event.target.value }))} />
              </label>
              <label className="daily-filter-field">
                <span>إلى تاريخ</span>
                <input className="treasury-input" type="date" value={reportFilters.toDate} onChange={(event) => setReportFilters((prev) => ({ ...prev, toDate: event.target.value }))} />
              </label>
            </div>
            <div className="daily-filter-context">
              <span className="context-chip">الفترة: {reportFilters.fromDate} - {reportFilters.toDate}</span>
              <span className="context-chip">الخزنة المختارة: {selectedDailyTreasuryName}</span>
            </div>
          </div>

          {reportLoading ? (<div className="section-loading">جاري تحميل التقرير...</div>) : (
            <>
              <div className="kpi-grid">
                <div className="kpi-card tone-sales"><span>إجمالي المبيعات</span><strong>{formatMoney(salesSummary.totalSales || 0)}</strong></div>
                <div className="kpi-card tone-returns"><span>إجمالي المرتجعات</span><strong>{formatMoney(salesSummary.totalReturns || 0)}</strong></div>
                <div className="kpi-card tone-net"><span>صافي المبيعات</span><strong>{formatMoney(salesSummary.netSales || 0)}</strong></div>
                <div className="kpi-card tone-revenue"><span>إجمالي الإيراد</span><strong>{formatMoney(revenueSummary.totalRevenue || 0)}</strong></div>
                <div className="kpi-card tone-payments"><span>تحصيلات العملاء</span><strong>{formatMoney(revenueSummary.customerPayments || 0)}</strong></div>
                <div className="kpi-card tone-cashflow"><span>صافي التدفق النقدي</span><strong>{formatMoney(movementSummary.netCashIn || 0)}</strong></div>
              </div>

              <div className="revenue-channel-grid">
                <div className="revenue-channel-card"><div className="revenue-channel-title">نقدي</div><div className="revenue-channel-value">{formatMoney(channelTotals.cash || 0)}</div></div>
                <div className="revenue-channel-card"><div className="revenue-channel-title">فودافون كاش</div><div className="revenue-channel-value">{formatMoney(channelTotals.vodafoneCash || 0)}</div></div>
                <div className="revenue-channel-card"><div className="revenue-channel-title">إنستا باي</div><div className="revenue-channel-value">{formatMoney(channelTotals.instaPay || 0)}</div></div>
                <div className="revenue-channel-card"><div className="revenue-channel-title">أخرى</div><div className="revenue-channel-value">{formatMoney(channelTotals.other || 0)}</div></div>
              </div>

              <div className="table-wrap">
                <table className="treasury-table">
                  <thead><tr><th>المعرف</th><th>التاريخ</th><th>الخزنة</th><th>النوع</th><th>الاتجاه</th><th>الوسيلة</th><th>المبلغ</th><th>المرجع</th></tr></thead>
                  <tbody>{revenueEntries.length === 0 ? (<tr><td colSpan="8" className="empty-cell">لا توجد قيود إيراد</td></tr>) : revenueEntries.map((entry) => (<tr key={`rev-${entry.id}`}><td>{entry.id}</td><td>{formatDateTime(entry.entryDate || entry.createdAt)}</td><td>{entry?.treasury?.name || '-'}</td><td>{resolveEntryTypeLabel(entry.entryType)}</td><td>{resolveDirectionLabel(entry.direction)}</td><td>{resolveMethodName(entry)}</td><td className={entry.direction === 'OUT' ? 'out-text' : 'in-text'}>{formatMoney(entry.amount)}</td><td>{formatReference(entry)}</td></tr>))}</tbody>
                </table>
              </div>

              <div className="report-grid" style={{ marginTop: '10px' }}>
                <div className="report-card"><h3>التجميع حسب المصدر</h3><table className="treasury-table compact"><thead><tr><th>المصدر</th><th>الاتجاه</th><th>المبلغ</th><th>العدد</th></tr></thead><tbody>{revenueBySourceVisible.length === 0 ? (<tr><td colSpan="4" className="empty-cell">لا توجد بيانات</td></tr>) : revenueBySourceVisible.map((row) => (<tr key={`${row.entryType}-${row.direction}`}><td>{resolveEntryTypeLabel(row.entryType)}</td><td>{resolveDirectionLabel(row.direction)}</td><td className={row.direction === 'OUT' ? 'out-text' : 'in-text'}>{formatMoney(row.amount || row.net || 0)}</td><td>{row.count || row.referenceCount || 0}</td></tr>))}</tbody></table></div>
                <div className="report-card"><h3>التجميع حسب وسيلة الدفع</h3><table className="treasury-table compact"><thead><tr><th>الوسيلة</th><th>الإيراد</th><th>النسبة</th></tr></thead><tbody>{revenueByMethod.length === 0 ? (<tr><td colSpan="3" className="empty-cell">لا توجد بيانات</td></tr>) : revenueByMethod.map((row) => (<tr key={`${row.code}-${row.paymentMethodId || 0}`}><td>{resolveMethodName(row)}</td><td className="in-text">{formatMoney(row.revenueAmount || row.amount || 0)}</td><td>{Number(row.percentOfRevenue || 0).toFixed(2)}%</td></tr>))}</tbody></table></div>
                <div className="report-card"><h3>التجميع حسب الخزنة</h3><table className="treasury-table compact"><thead><tr><th>الخزنة</th><th>صافي الإيراد</th><th>العدد</th></tr></thead><tbody>{revenueByTreasury.length === 0 ? (<tr><td colSpan="3" className="empty-cell">لا توجد بيانات</td></tr>) : revenueByTreasury.map((row) => (<tr key={`${row.treasuryId || row.treasuryName}`}><td>{row.treasuryName || '-'}</td><td className={Number(row.net || 0) >= 0 ? 'in-text' : 'out-text'}>{formatMoney(row.net || row.amount || 0)}</td><td>{row.count || 0}</td></tr>))}</tbody></table></div>
              </div>
            </>
          )}
        </section>
      )}

      {activeTab === 'expenses' && (
        <section className="treasury-panel">
          <div className="panel-head">
            <h2>المصروفات</h2>
            <div className="panel-head-actions">
              <button className="treasury-btn secondary" type="button" onClick={() => openExpenseModal()}>+ إضافة مصروف</button>
              <button className="treasury-btn ghost neutral" type="button" onClick={() => setCategoryFormOpen(!categoryFormOpen)}>{categoryFormOpen ? 'إخفاء التصنيفات' : '⚙ التصنيفات'}</button>
            </div>
          </div>

          {/* Category manager */}
          {categoryFormOpen && (
            <div className="expense-category-manager">
              <div className="expense-category-chips">
                {expenseCategories.map((cat) => (
                  <div key={cat.id} className="expense-category-chip" style={{ borderColor: cat.color || '#64748b' }}>
                    <span className="chip-dot" style={{ background: cat.color || '#64748b' }} />
                    <span>{cat.name}</span>
                    <span className="chip-count">{cat._count?.expenses || 0}</span>
                    <button type="button" className="chip-edit" onClick={() => { setEditingCategory(cat); setCategoryForm({ name: cat.name, color: cat.color || EXPENSE_CATEGORY_COLORS[0] }); }}>✏</button>
                    <button type="button" className="chip-delete" onClick={() => void handleDeleteCategory(cat)}>✕</button>
                  </div>
                ))}
              </div>
              <form className="expense-category-form" onSubmit={handleSaveCategory}>
                <input className="treasury-input" placeholder="اسم التصنيف" value={categoryForm.name} onChange={(e) => setCategoryForm(p => ({ ...p, name: e.target.value }))} required />
                <div className="color-picker-row">
                  {EXPENSE_CATEGORY_COLORS.map((c) => (
                    <button key={c} type="button" className={`color-dot ${categoryForm.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setCategoryForm(p => ({ ...p, color: c }))} />
                  ))}
                </div>
                <div className="expense-category-form-actions">
                  <button className="treasury-btn small primary" type="submit" disabled={submitting}>{editingCategory ? 'تحديث' : 'إضافة'}</button>
                  {editingCategory && <button className="treasury-btn small ghost" type="button" onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', color: EXPENSE_CATEGORY_COLORS[0] }); }}>إلغاء</button>}
                </div>
              </form>
            </div>
          )}

          {/* Filters */}
          <div className="daily-filter-shell">
            <div className="daily-filter-grid">
              <label className="daily-filter-field"><span>من تاريخ</span><input className="treasury-input" type="date" value={expenseFilters.fromDate} onChange={(e) => setExpenseFilters(p => ({ ...p, fromDate: e.target.value }))} /></label>
              <label className="daily-filter-field"><span>إلى تاريخ</span><input className="treasury-input" type="date" value={expenseFilters.toDate} onChange={(e) => setExpenseFilters(p => ({ ...p, toDate: e.target.value }))} /></label>
              <label className="daily-filter-field"><span>التصنيف</span>
                <select className="treasury-input" value={expenseFilters.categoryId} onChange={(e) => setExpenseFilters(p => ({ ...p, categoryId: e.target.value }))}>
                  <option value="">الكل</option>
                  {expenseCategories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                </select>
              </label>
            </div>
          </div>

          {/* Summary */}
          <div className="kpi-grid" style={{ marginBottom: 12 }}>
            <div className="kpi-card tone-returns"><span>إجمالي المصروفات</span><strong>{formatMoney(totalExpenses)}</strong></div>
            <div className="kpi-card tone-cashflow"><span>عدد المصروفات</span><strong>{expenses.length}</strong></div>
          </div>

          {/* Table */}
          <div className="table-wrap">
            <table className="treasury-table">
              <thead><tr><th>#</th><th>العنوان</th><th>المبلغ</th><th>التصنيف</th><th>التاريخ</th><th>ملاحظات</th><th>إجراءات</th></tr></thead>
              <tbody>
                {expensesLoading ? (<tr><td colSpan="7" className="empty-cell">جاري التحميل...</td></tr>)
                  : expenses.length === 0 ? (<tr><td colSpan="7" className="empty-cell">لا توجد مصروفات</td></tr>)
                    : expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td>{exp.id}</td>
                        <td><strong>{exp.title}</strong></td>
                        <td className="out-text">{formatMoney(exp.amount)}</td>
                        <td>{exp.category ? <span className="expense-category-badge" style={{ background: exp.category.color || '#64748b' }}>{exp.category.name}</span> : <span style={{ color: '#64748b' }}>—</span>}</td>
                        <td>{formatDateTime(exp.expenseDate || exp.createdAt)}</td>
                        <td>{exp.notes || '—'}</td>
                        <td>
                          <div className="treasury-card-actions">
                            <button className="treasury-btn small secondary" type="button" onClick={() => openExpenseModal(exp)}>تعديل</button>
                            <button className="treasury-btn small danger" type="button" disabled={submitting} onClick={() => void handleDeleteExpense(exp)}>حذف</button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Expense Modal */}
      {expenseModalOpen && (
        <div className="treasury-modal-overlay" onClick={() => setExpenseModalOpen(false)}>
          <div className="treasury-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="treasury-modal-head">
              <h3>{editingExpense ? 'تعديل مصروف' : 'إضافة مصروف جديد'}</h3>
              <button type="button" className="treasury-close-btn" onClick={() => setExpenseModalOpen(false)}>إغلاق</button>
            </div>
            <form className="treasury-form" onSubmit={handleSaveExpense}>
              <div className="treasury-form-grid">
                <label className="field"><span>عنوان المصروف</span><input className="treasury-input" value={expenseForm.title} onChange={(e) => setExpenseForm(p => ({ ...p, title: e.target.value }))} required /></label>
                <label className="field"><span>المبلغ</span><input className="treasury-input" type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm(p => ({ ...p, amount: e.target.value }))} required /></label>
                <label className="field"><span>التصنيف</span>
                  <select className="treasury-input" value={expenseForm.categoryId} onChange={(e) => setExpenseForm(p => ({ ...p, categoryId: e.target.value }))}>
                    <option value="">بدون تصنيف</option>
                    {expenseCategories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                  </select>
                </label>
                <label className="field"><span>التاريخ</span><input className="treasury-input" type="date" value={expenseForm.expenseDate} onChange={(e) => setExpenseForm(p => ({ ...p, expenseDate: e.target.value }))} /></label>
                {!editingExpense && (<>
                  <label className="field"><span>الخزنة</span>
                    <select className="treasury-input" value={expenseForm.treasuryId} onChange={(e) => setExpenseForm(p => ({ ...p, treasuryId: e.target.value }))}>
                      <option value="">الافتراضية</option>
                      {treasuries.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                    </select>
                  </label>
                  <label className="field"><span>وسيلة الدفع</span>
                    <select className="treasury-input" value={expenseForm.paymentMethodId} onChange={(e) => setExpenseForm(p => ({ ...p, paymentMethodId: e.target.value }))}>
                      <option value="">الافتراضية</option>
                      {paymentMethods.map((m) => (<option key={m.id} value={m.id}>{resolveMethodName(m)}</option>))}
                    </select>
                  </label>
                </>)}
                <label className="field field-full"><span>ملاحظات</span><input className="treasury-input" value={expenseForm.notes} onChange={(e) => setExpenseForm(p => ({ ...p, notes: e.target.value }))} /></label>
              </div>
              <div className="treasury-card-actions">
                <button className="treasury-btn primary" type="submit" disabled={submitting}>حفظ</button>
                <button className="treasury-btn ghost" type="button" onClick={() => setExpenseModalOpen(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {treasuryModalState.isOpen && (
        <div className="treasury-modal-overlay" onClick={closeTreasuryModal}>
          <div className="treasury-modal-box" onClick={(event) => event.stopPropagation()}>
            <div className="treasury-modal-head">
              <h3>{treasuryModalState.mode === 'edit' ? 'تعديل خزنة' : 'إضافة خزنة جديدة'}</h3>
              <button type="button" className="treasury-close-btn" onClick={closeTreasuryModal}>إغلاق</button>
            </div>
            <form className="treasury-form" onSubmit={handleSaveTreasury}>
              <div className="treasury-form-grid">
                <label className="field">
                  <span>اسم الخزنة</span>
                  <input className="treasury-input" value={treasuryForm.name} onChange={(event) => setTreasuryForm((prev) => ({ ...prev, name: event.target.value }))} required />
                </label>
                <label className="field">
                  <span>الكود</span>
                  <input className="treasury-input" value={treasuryForm.code} onChange={(event) => setTreasuryForm((prev) => ({ ...prev, code: event.target.value }))} />
                </label>
                <label className="field">
                  <span>الرصيد الافتتاحي</span>
                  <input className="treasury-input" type="number" min="0" step="0.01" value={treasuryForm.openingBalance} onChange={(event) => setTreasuryForm((prev) => ({ ...prev, openingBalance: event.target.value }))} />
                </label>
                <label className="field">
                  <span>الوصف</span>
                  <input className="treasury-input" value={treasuryForm.description} onChange={(event) => setTreasuryForm((prev) => ({ ...prev, description: event.target.value }))} />
                </label>
                <label className="field field-full inline-check">
                  <input type="checkbox" checked={Boolean(treasuryForm.isDefault)} onChange={(event) => setTreasuryForm((prev) => ({ ...prev, isDefault: event.target.checked }))} />
                  جعلها الخزنة الافتراضية
                </label>
              </div>
              <div className="treasury-card-actions">
                <button className="treasury-btn primary" type="submit" disabled={submitting}>حفظ</button>
                <button className="treasury-btn ghost" type="button" onClick={closeTreasuryModal}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


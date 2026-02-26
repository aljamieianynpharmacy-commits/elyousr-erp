import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue, memo } from 'react';
import { safeAlert } from '../utils/safeAlert';
import { safeConfirm } from '../utils/safeConfirm';
import { FixedSizeList as List, areEqual } from 'react-window';
import { Plus, Search, Settings } from 'lucide-react';
import CustomerLedger from './CustomerLedger';
import NewCustomerModal from '../components/NewCustomerModal';
import PaymentModal from '../components/PaymentModal';
import { filterPosPaymentMethods } from '../utils/paymentMethodFilters';
import CustomersTable from '../components/customers/CustomersTable';
import CustomersQuickStats from '../components/customers/CustomersQuickStats';
import './Customers.css';

let globalCustomersCache = null;


// Utility functions - moved outside component for better performance
const ROW_HEIGHT = 56;
const MAX_LIST_HEIGHT = 520;

const COLUMN_SPECS = {
  id: { minWidth: 70 },
  name: { minWidth: 180 },
  type: { minWidth: 120 },
  phone: { minWidth: 140 },
  phone2: { minWidth: 140 },
  address: { minWidth: 220 },
  city: { minWidth: 140 },
  district: { minWidth: 140 },
  notes: { minWidth: 200 },
  creditLimit: { minWidth: 140 },
  balance: { minWidth: 120 },
  action_actions: { width: 174 }
};

const getVisibleColumnOrder = (visibleColumns) => {
  const order = [];
  if (visibleColumns.id) order.push('id');
  if (visibleColumns.name) order.push('name');
  if (visibleColumns.type) order.push('type');
  if (visibleColumns.phone) order.push('phone');
  if (visibleColumns.phone2) order.push('phone2');
  if (visibleColumns.address) order.push('address');
  if (visibleColumns.city) order.push('city');
  if (visibleColumns.district) order.push('district');
  if (visibleColumns.notes) order.push('notes');
  if (visibleColumns.creditLimit) order.push('creditLimit');
  if (visibleColumns.balance) order.push('balance');
  if (visibleColumns.actions) {
    order.push('action_actions');
  }
  return order;
};

const getCustomerTypeClass = (type) => {
  if (type === 'VIP') return 'customers-type-vip';
  if (type === 'تاجر جملة') return 'customers-type-wholesale';
  return 'customers-type-regular';
};

const getBalanceClass = (balance) => {
  if (balance > 0) return 'customers-balance-positive';
  if (balance < 0) return 'customers-balance-negative';
  return 'customers-balance-zero';
};

const SEARCH_HIGHLIGHT_STYLE = { backgroundColor: '#fbbf24', fontWeight: 'bold' };

const highlightMatch = (value, searchTerm) => {
  const text = String(value ?? '');
  const normalizedTerm = String(searchTerm ?? '').trim();

  if (!text || !normalizedTerm) return text;

  const lowerText = text.toLowerCase();
  const lowerTerm = normalizedTerm.toLowerCase();
  const termLength = normalizedTerm.length;

  // Fast path: no match -> return plain text (avoid allocations/JSX work)
  if (!lowerText.includes(lowerTerm)) return text;

  const parts = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerTerm, cursor);

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      parts.push(text.slice(cursor, matchIndex));
    }

    const end = matchIndex + termLength;
    parts.push(
      <span key={`h-${matchIndex}-${end}`} style={SEARCH_HIGHLIGHT_STYLE}>
        {text.slice(matchIndex, end)}
      </span>
    );

    cursor = end;
    matchIndex = lowerText.indexOf(lowerTerm, cursor);
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
};

const useDebouncedValue = (value, delayMs) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};

const formatCurrency = (value) => {
  try {
    const num = typeof value === 'string' ? parseFloat(value || 0) : (value || 0);
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 2
    }).format(num);
  } catch (e) {
    return value;
  }
};

const normalizeCustomerNameKey = (value) => String(value ?? '').trim().toLowerCase();
const normalizeCustomerPhoneKey = (value) => String(value ?? '')
  .replace(/[^\d+]/g, '')
  .trim();







export default function Customers() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLedger, setShowLedger] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const listRef = useRef(null);

  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    name: true,
    type: true,
    phone: true,
    phone2: false,
    address: false,
    city: true,
    district: false,
    notes: false,
    creditLimit: false,
    balance: true,
    actions: true,
  });
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    phone2: '',
    address: '',
    city: '',
    district: '',
    notes: '',
    creditLimit: 0,
    customerType: 'عادي'
  });
  const [paymentData, setPaymentData] = useState({ amount: '', notes: '', paymentDate: new Date().toISOString().split('T')[0] });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  // تحديث النقطة الحمراء للعملاء من الإعدادات العامة (السايد بار)
  const overdueThreshold = parseInt(localStorage.getItem('overdueThreshold') || '30');

  // Client-side pagination & sorting state
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;
  const [sortCol, setSortCol] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [columnSearch, setColumnSearch] = useState({});
  const [showSearchRow, setShowSearchRow] = useState(false);
  const [allCustomers, setAllCustomers] = useState([]);

  // تحسين سلاسة الإدخال: نؤخر حساب نتائج البحث الثقيلة عن الكتابة الفورية
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 120);
  const deferredSearchTerm = useDeferredValue(debouncedSearchTerm);
  const filteredSearchTerm = useMemo(() => deferredSearchTerm.trim().toLowerCase(), [deferredSearchTerm]);
  const debouncedColumnSearch = useDebouncedValue(columnSearch, 80);

  // Reset الصفحة عند تغيير البحث أو الفلتر
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredSearchTerm, filterType, debouncedColumnSearch, sortCol, sortDir]);

  const loadPaymentMethods = useCallback(async () => {
    try {
      const methods = await window.api.getPaymentMethods();
      if (Array.isArray(methods)) {
        setPaymentMethods(filterPosPaymentMethods(methods));
      }
    } catch (error) {
      console.error('Failed to load payment methods:', error);
    }
  }, []);

  // تحميل كل العملاء مرة واحدة - البحث والفلترة تتم محلياً
  const loadAllCustomers = useCallback(async () => {
    try {
      if (globalCustomersCache) {
        setAllCustomers(globalCustomersCache);
        setInitialLoading(false);
      } else {
        setInitialLoading(true);
      }

      const result = await window.api.getCustomers({
        page: 1,
        pageSize: 10000,
        searchTerm: '',
        customerType: 'all',
        city: '',
        sortCol: 'createdAt',
        sortDir: 'desc'
      });

      if (result?.error) {
        console.error('❌ [BACKEND] خطأ في تحميل العملاء: ' + result.error);
        if (!globalCustomersCache) setAllCustomers([]);
        return;
      }

      const data = Array.isArray(result?.data) ? result.data : [];

      // تحسين: تجهيز نص البحث مسبقاً (Pre-computed Search String)
      // عشان ما نعملش toLowerCase() 4 مرات لكل عميل مع كل حرف بحث
      const enhancedData = data.map(c => ({
        ...c,
        normalizedSearchString: `${c.name || ''}`.toLowerCase()
      }));

      globalCustomersCache = enhancedData;
      setAllCustomers(enhancedData);
    } catch (err) {
      console.error('💥 [FRONTEND] استثناء في تحميل العملاء:', err);
      if (!globalCustomersCache) setAllCustomers([]);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const refreshCustomers = useCallback(async () => {
    await loadAllCustomers();
  }, [loadAllCustomers]);

  useEffect(() => {
    loadAllCustomers();
  }, [loadAllCustomers]);

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  // ============ الترتيب مرة واحدة - لا يتأثر بالبحث ============
  const sortedCustomers = useMemo(() => {
    return [...allCustomers].sort((a, b) => {
      let aVal, bVal;
      if (sortCol === 'balance') {
        aVal = a.balance || 0;
        bVal = b.balance || 0;
      } else if (sortCol === 'lastPaymentDate') {
        aVal = a.lastPaymentDate ? new Date(a.lastPaymentDate).getTime() : 0;
        bVal = b.lastPaymentDate ? new Date(b.lastPaymentDate).getTime() : 0;
      } else if (sortCol === 'name') {
        aVal = (a.name || '').toLowerCase();
        bVal = (b.name || '').toLowerCase();
        return sortDir === 'asc' ? aVal.localeCompare(bVal, 'ar') : bVal.localeCompare(aVal, 'ar');
      } else {
        aVal = a.id || 0;
        bVal = b.id || 0;
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [allCustomers, sortCol, sortDir]);

  // ============ فلترة خفيفة O(n) فقط - بدون sort ============
  const filteredCustomers = useMemo(() => {
    // 1. البحث العام (الاسم فقط)
    // عند البحث: نستخدم allCustomers مباشرة (بدون ترتيب) ونعرض أول 50 فقط (زي نقطة البيع)
    if (filteredSearchTerm) {
      const result = [];
      const MAX_RESULTS = 50;

      // استخدام حلقة تكرار مع Break للتوقف فوراً عند الوصول للعدد المطلوب
      // هذا يجعل البحث عن الحروف الأولى (الشائعة) فوري تماماً بدلاً من فحص كل القائمة
      for (let i = 0; i < allCustomers.length; i++) {
        const c = allCustomers[i];
        if (c.normalizedSearchString && c.normalizedSearchString.includes(filteredSearchTerm)) {
          result.push(c);
          if (result.length >= MAX_RESULTS) break;
        }
      }
      return result;
    }

    // في عدم وجود بحث: نستخدم القائمة المرتبة كاملة مع الفلاتر العادية
    let result = sortedCustomers;

    // 2. فلترة حسب النوع
    if (filterType && filterType !== 'all') {
      result = result.filter(c => c.customerType === filterType);
    }

    // 3. فلترة الأعمدة (صف البحث)
    const activeColFilters = Object.entries(debouncedColumnSearch)
      .filter(([, value]) => value && String(value).trim() !== '')
      .map(([key, value]) => [key, String(value).toLowerCase().trim()]);

    if (activeColFilters.length > 0) {
      result = result.filter(customer =>
        activeColFilters.every(([key, value]) => {
          let itemValue = '';
          if (key === 'type') itemValue = customer.customerType || '';
          else if (key === 'balance') itemValue = String(customer.balance || 0);
          else if (key === 'creditLimit') itemValue = String(customer.creditLimit || 0);
          else itemValue = customer[key] || '';
          return String(itemValue).toLowerCase().includes(value);
        })
      );
    }

    return result;
  }, [allCustomers, sortedCustomers, filteredSearchTerm, filterType, debouncedColumnSearch]);

  const totalItems = filteredCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  // الصفحة الحالية من النتائج
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCustomers.slice(start, start + PAGE_SIZE);
  }, [filteredCustomers, currentPage]);

  const resetCustomerForm = () => {
    setFormData({
      name: '',
      phone: '',
      phone2: '',
      address: '',
      city: '',
      district: '',
      notes: '',
      creditLimit: 0,
      customerType: 'عادي'
    });
  };

  const saveCustomer = async () => {
    try {
      if (editingCustomer) {
        const result = await window.api.updateCustomer(editingCustomer.id, formData);

        if (result.error) {
          console.error('Error updating customer:', result.error);
          safeAlert(result.error);
          return;
        }
      } else {
        const result = await window.api.addCustomer(formData);

        if (result.error) {
          console.error('Error adding customer:', result.error);
          safeAlert(result.error);
          return;
        }
      }

      setShowModal(false);
      resetCustomerForm();
      setEditingCustomer(null);
      await refreshCustomers();
    } catch (err) {
      console.error('Exception saving customer:', err);
      safeAlert('خطأ في حفظ البيانات: ' + err.message);
    }
  };

  const closeCustomerModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    resetCustomerForm();
  };

  const openNewCustomerModal = () => {
    setEditingCustomer(null);
    resetCustomerForm();
    setShowModal(true);
  };

  const openSettings = () => {
    setTempThreshold(overdueThreshold);
    setShowSettings(true);
  };

  const submitPayment = async (paymentFormData) => {
    const paymentAmount = parseFloat(paymentFormData.amount);

    if (isNaN(paymentAmount) || paymentAmount === 0) {
      safeAlert('الرجاء إدخال مبلغ صالح (غير صفر)');
      return;
    }

    const previewNewBalance = (selectedCustomer.balance - paymentAmount).toFixed(2);
    const paymentDate = new Date(paymentFormData.paymentDate);
    const confirmText = `سوف تُسجّل دفعة بقيمة ${formatCurrency(paymentAmount)} بتاريخ ${paymentDate.toLocaleDateString('ar-EG')}\nالرصيد بعد التسجيل: ${previewNewBalance}\n\nهل تريد المتابعة؟`;
    const confirmed = await safeConfirm(confirmText, {
      title: 'تأكيد تسجيل الدفعة',
      buttons: ['تأكيد', 'إلغاء']
    });
    if (!confirmed) return;

    setPaymentSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomer.id,
        amount: paymentAmount,
        notes: paymentFormData.notes || '',
        paymentDate: paymentFormData.paymentDate,
        paymentMethodId: parseInt(paymentFormData.paymentMethodId, 10)
          || parseInt(paymentMethods[0]?.id, 10)
          || 1
      };

      const result = await window.api.addCustomerPayment(payload);

      if (!result.error) {
        await refreshCustomers();
        setPaymentData({ amount: '', notes: '', paymentDate: new Date().toISOString().split('T')[0] });
      } else {
        console.error('Error submitting payment:', result.error);
      }

      return result;
    } catch (err) {
      console.error('Exception submitting payment:', err);
      safeAlert('خطأ في التسجيل: ' + err.message);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const customerStats = useMemo(() => {
    let vipCount = 0;
    let debtedCount = 0;
    let compliantCount = 0;
    let totalDebt = 0;
    let overdueCount = 0;

    for (const c of filteredCustomers) {
      if (c.customerType === 'VIP') vipCount += 1;
      if (c.balance > 0) {
        debtedCount += 1;
        totalDebt += c.balance;
      } else {
        compliantCount += 1;
      }

      // حساب حالة التأخر محلياً لضمان سرعة الاستجابة عند تغيير الإعدادات
      // نستخدم قيمة lastPaymentDays المستلمة من الباك اند
      const isOverdue = (c.lastPaymentDays !== undefined ? c.lastPaymentDays : 0) > overdueThreshold;
      if (isOverdue) {
        overdueCount += 1;
      }
    }

    return { vipCount, debtedCount, compliantCount, totalDebt, overdueCount };
  }, [filteredCustomers, overdueThreshold]);



  // Callbacks للأزرار - تمنع إعادة إنشاء الدوال في كل render
  const handleShowLedger = useCallback((customerId) => {
    setShowLedger(customerId);
  }, []);

  const handlePaymentCallback = useCallback((customer) => {
    setSelectedCustomer(customer);
    setPaymentData({ amount: '', notes: '', paymentDate: new Date().toISOString().split('T')[0] });
    setShowPaymentModal(true);
  }, []);

  const handleEditCallback = useCallback((customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      phone2: customer.phone2 || '',
      address: customer.address || '',
      city: customer.city || '',
      district: customer.district || '',
      notes: customer.notes || '',
      creditLimit: customer.creditLimit || 0,
      customerType: customer.customerType || 'عادي'
    });
    setShowModal(true);
  }, []);

  const handleDeleteCallback = useCallback(async (id) => {
    const customer = allCustomers.find((row) => row.id === id);
    const customerName = customer?.name || `#${id}`;
    const confirmed = await safeConfirm(
      `سيتم حذف العميل "${customerName}". هل تريد المتابعة؟`,
      { title: 'حذف عميل' }
    );
    if (!confirmed) return;

    try {
      const result = await window.api.deleteCustomer(id);

      if (result?.error) {
        await safeAlert(result.error, null, { type: 'error', title: 'تعذر الحذف' });
        return;
      }

      await refreshCustomers();
      await safeAlert('تم حذف العميل بنجاح', null, { type: 'success', title: 'العملاء' });
    } catch (err) {
      await safeAlert(err?.message || 'تعذر حذف العميل', null, { type: 'error', title: 'تعذر الحذف' });
    }
  }, [allCustomers, refreshCustomers]);

  // البحث والفلترة
  const handleColumnSearchChange = useCallback((field, value) => {
    setColumnSearch(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const toggleColumn = useCallback((column) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  }, []);

  // معالج الأسهم والـ Enter للتنقل في البحث
  const handleSearchKeyDown = useCallback((e) => {
    if (filteredCustomers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex(prev => {
        if (prev < filteredCustomers.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex(prev => {
        if (prev > 0) {
          return prev - 1;
        }
        return 0;
      });
    } else if (e.key === 'Enter' && selectedSearchIndex >= 0) {
      e.preventDefault();
      handlePaymentCallback(filteredCustomers[selectedSearchIndex]);
    }
  }, [filteredCustomers, selectedSearchIndex, handlePaymentCallback]);

  // Reset الاختيار عند تغيير البحث
  useEffect(() => {
    setSelectedSearchIndex(-1);
  }, [filteredSearchTerm, filterType]);

  useEffect(() => {
    if (selectedSearchIndex >= 0 && listRef.current) {
      listRef.current.scrollToItem(selectedSearchIndex, 'smart');
    }
  }, [selectedSearchIndex]);



  if (initialLoading) return <div>جاري التحميل...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>👥 إدارة العملاء</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              openNewCustomerModal();
            }}
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '10px 16px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={18} />
            إضافة عميل جديد
          </button>
        </div>
      </div>

      {/* البحث والفلترة والأعمدة */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr auto auto',
        gap: '15px',
        marginBottom: '20px',
        alignItems: 'center'
      }}>
        {/* البحث */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Search size={18} color="#6b7280" style={{ marginLeft: '-32px', zIndex: 1, pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="إبحث عن عميل (الاسم، الهاتف، المدينة)... "
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            style={{
              flex: 1,
              padding: '10px 30px 10px 35px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px'
            }}
          />
        </div>

        {/* الفلترة حسب النوع */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'عادي', 'VIP', 'تاجر جملة'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: filterType === type ? '#3b82f6' : '#e5e7eb',
                color: filterType === type ? 'white' : '#6b7280',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px',
                transition: 'all 0.2s'
              }}
            >
              {type === 'all' ? '📊 الكل' : type}
            </button>
          ))}
        </div>

        {/* الترتيب */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={sortCol}
            onChange={(e) => setSortCol(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '12px',
              backgroundColor: 'white'
            }}
          >
            <option value="createdAt">الأحدث</option>
            <option value="balance">الرصيد</option>
            <option value="lastPaymentDate">آخر دفعة</option>
          </select>
          <button
            onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              minWidth: '62px'
            }}
          >
            {sortDir === 'asc' ? 'تصاعدي' : 'تنازلي'}
          </button>
        </div>

        {/* تبديل الأعمدة */}
        <div style={{ position: 'relative' }}>
          <details
            style={{
              backgroundColor: '#f3f4f6',
              borderRadius: '8px',
              padding: '8px',
              border: '1px solid #d1d5db'
            }}
          >
            <summary style={{
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Settings size={16} />
              الأعمدة ({Object.values(visibleColumns).filter(Boolean).length})
            </summary>
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0, // المحاذاة لليسار بدلاً من اليمين لمنع الخروج عن الشاشة
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '8px',
              marginTop: '8px',
              zIndex: 100,
              minWidth: '240px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              <label className="customers-column-toggle customers-column-toggle-primary">
                <input
                  type="checkbox"
                  checked={showSearchRow}
                  onChange={(e) => setShowSearchRow(e.target.checked)}
                />
                <span>🔍 إظهار صف البحث</span>
              </label>
              {Object.entries({
                id: '#',
                name: 'الاسم',
                type: 'النوع',
                phone: 'الهاتف',
                phone2: 'الهاتف 2',
                address: 'العنوان',
                city: 'المدينة',
                district: 'المنطقة',
                notes: 'الملاحظات',
                creditLimit: 'الحد الائتماني',
                balance: 'الرصيد',
              }).map(([key, label]) => (
                <label key={key} className="customers-column-toggle">
                  <input
                    type="checkbox"
                    checked={visibleColumns[key] || false}
                    onChange={() => toggleColumn(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <CustomersQuickStats
        totalCount={totalItems}
        vipCount={customerStats.vipCount}
        overdueCount={customerStats.overdueCount}
        overdueThreshold={overdueThreshold}
        filteredCount={totalItems}
      />

      <div className="card customers-table-card">
        <CustomersTable
          customers={paginatedCustomers}
          visibleColumns={visibleColumns}
          showSearchRow={showSearchRow}
          columnSearch={columnSearch}
          onColumnSearchChange={handleColumnSearchChange}
          selectedIndex={selectedSearchIndex}
          overdueThreshold={overdueThreshold}
          highlightTerm={filteredSearchTerm}
          onShowLedger={handleShowLedger}
          onPayment={handlePaymentCallback}
          onEdit={handleEditCallback}
          onDelete={handleDeleteCallback}
          listRef={listRef}
        />
      </div>

      {/* Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', gap: '20px', borderTop: '1px solid #e5e7eb', marginTop: '20px' }}>
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage === 1 ? 0.5 : 1
          }}
        >
          السابق
        </button>
        <span style={{ fontWeight: 'bold' }}>صفحة {currentPage} من {totalPages} (إجمالي {totalItems})</span>
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage === totalPages ? 0.5 : 1
          }}
        >
          التالي
        </button>
      </div>

      <NewCustomerModal
        isOpen={showModal}
        customer={formData}
        onChange={setFormData}
        onSave={saveCustomer}
        existingCustomers={allCustomers}
        editingCustomerId={editingCustomer?.id}
        isEditMode={!!editingCustomer}
        onClose={closeCustomerModal}
        title={editingCustomer ? 'تعديل بيانات عميل' : 'إضافة عميل جديد'}
        zIndex={1200}
      />

      <PaymentModal
        isOpen={showPaymentModal}
        selectedCustomer={selectedCustomer}
        paymentData={paymentData}
        onSubmit={submitPayment}
        onClose={() => setShowPaymentModal(false)}
        isSubmitting={paymentSubmitting}
        paymentMethods={paymentMethods}
      />

      {/* Customer Ledger */}
      {
        showLedger && (
          <CustomerLedger
            customerId={showLedger}
            onClose={() => {
              setShowLedger(null);
            }}
            onDataChanged={() => {
              refreshCustomers();
            }}
          />
        )
      }
    </div >
  );
}



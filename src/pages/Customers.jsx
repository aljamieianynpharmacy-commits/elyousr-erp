import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { FileText, DollarSign, Edit2, Trash2, Plus, Search, Settings, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import CustomerLedger from './CustomerLedger';
import NewCustomerModal from '../components/NewCustomerModal';
import PaymentModal from '../components/PaymentModal';

// دالة مساعدة لإضافة timestamp
const logWithTime = (message, data = null) => {
  const timestamp = new Date().toLocaleTimeString('ar-EG', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
  const logMessage = `[${timestamp}] ${message}`;
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
};

const logErrorWithTime = (message, data = null) => {
  const timestamp = new Date().toLocaleTimeString('ar-EG', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
  const logMessage = `[${timestamp}] ${message}`;
  if (data) {
    console.error(logMessage, data);
  } else {
    console.error(logMessage);
  }
};

// ============= OPTIMIZED CUSTOMER ROW COMPONENT =============
const CustomerRow = memo(({ 
  customer, 
  index, 
  isSelected,
  visibleColumns,
  overdueThreshold,
  onShowLedger,
  onPayment,
  onEdit,
  onDelete,
  getCustomerTypeColor,
  formatCurrency
}) {
  // حساب معلومات آخر دفعة
  const paymentInfo = useMemo(() => {
    const lastPaymentDays = customer.lastPaymentDays || 0;
    const lastPaymentDate = new Date();
    lastPaymentDate.setDate(lastPaymentDate.getDate() - lastPaymentDays);

    // استخدام قيمة الباك اند إذا وجدت، وإلا الحساب المحلي
    const isOverdue = customer.isOverdue !== undefined ? customer.isOverdue : lastPaymentDays > overdueThreshold;
    const lastOperationType = customer.lastOperationType || 'فاتورة';

    // Log for debugging
    if (index < 3) {
      console.log(`[CustomerRow] ${customer.name}: Days=${lastPaymentDays}, Threshold=${overdueThreshold}, Overdue=${isOverdue}`);
    }

    return {
      lastPaymentDate: lastPaymentDate.toLocaleDateString('ar-EG'),
      daysAgo: lastPaymentDays,
      operationType: lastOperationType,
      isOverdue: isOverdue
    };
  }, [customer.lastPaymentDays, customer.isOverdue, customer.lastOperationType, overdueThreshold, index, customer.name]);

  const { isOverdue } = paymentInfo;
  const rowBgColor = isSelected ? '#dbeafe' : index % 2 === 0 ? 'white' : '#f9fafb';

  return (
    <tr
      className="customer-row"
      style={{
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: rowBgColor
      }}
    >
      {visibleColumns.id && (
        <td style={{ padding: '12px 15px', fontSize: '14px', color: '#6b7280' }}>
          {customer.id}
        </td>
      )}
      
      {visibleColumns.name && (
        <td style={{ padding: '12px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isOverdue && (
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#dc2626',
                  flexShrink: 0
                }}
                title={`متأخر ${customer.lastPaymentDays} يوم`}
              />
            )}
            <span style={{ fontWeight: '600', color: '#1f2937' }}>
              {customer.name}
            </span>
          </div>
        </td>
      )}

      {visibleColumns.type && (
        <td style={{ padding: '12px 15px' }}>
          <span style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600',
            backgroundColor: getCustomerTypeColor(customer.customerType) + '15',
            color: getCustomerTypeColor(customer.customerType)
          }}>
            {customer.customerType}
          </span>
        </td>
      )}

      {visibleColumns.phone && (
        <td style={{ padding: '12px 15px', color: '#6b7280', fontSize: '14px' }}>
          {customer.phone || '-'}
        </td>
      )}

      {visibleColumns.balance && (
        <td style={{ padding: '12px 15px' }}>
          <span style={{
            fontWeight: 'bold',
            color: customer.balance > 0 ? '#ef4444' : customer.balance < 0 ? '#10b981' : '#6b7280',
            fontSize: '15px'
          }}>
            {formatCurrency(customer.balance)}
          </span>
        </td>
      )}

      {visibleColumns.actions && (
        <td style={{ padding: '8px 12px' }}>
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
            <button
              onClick={() => onShowLedger(customer.id)}
              title="كشف الحساب"
              className="action-btn"
              style={{
                padding: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <FileText size={18} color="#3b82f6" />
            </button>

            <button
              onClick={() => onPayment(customer)}
              title="تسجيل دفعة"
              className="action-btn"
              style={{
                padding: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdf4'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <DollarSign size={18} color="#10b981" />
            </button>

            <button
              onClick={() => onEdit(customer)}
              title="تعديل"
              className="action-btn"
              style={{
                padding: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#fffbeb'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Edit2 size={18} color="#f59e0b" />
            </button>

            <button
              onClick={() => onDelete(customer.id)}
              title="حذف"
              className="action-btn"
              style={{
                padding: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Trash2 size={18} color="#ef4444" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom comparison للتحكم في إعادة الرندر
  return (
    prevProps.customer.id === nextProps.customer.id &&
    prevProps.customer.balance === nextProps.customer.balance &&
    prevProps.customer.lastPaymentDays === nextProps.customer.lastPaymentDays &&
    prevProps.overdueThreshold === nextProps.overdueThreshold &&
    JSON.stringify(prevProps.visibleColumns) === JSON.stringify(nextProps.visibleColumns)
  );
});

CustomerRow.displayName = 'CustomerRow';

// ============= MAIN COMPONENT =============
export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showLedger, setShowLedger] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerFormData, setCustomerFormData] = useState({
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
  const [overdueThreshold, setOverdueThreshold] = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [paymentData, setPaymentData] = useState({ amount: '', notes: '', paymentDate: new Date().toISOString().split('T')[0] });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    name: true,
    type: true,
    phone: true,
    phone2: false,
    address: false,
    city: false,
    district: false,
    notes: false,
    creditLimit: false,
    balance: true,
    actions: true
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const latestRequestIdRef = useRef(0);
  const [columnSearch, setColumnSearch] = useState({});
  const [showSearchRow, setShowSearchRow] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      const startTime = performance.now();
      const trimmed = searchTerm.trim();

      if (trimmed !== debouncedSearch) {
        logWithTime('⏰ [FRONTEND] Debounced Search بدأ - القيمة الأصلية: ' + searchTerm + ' | القيمة المعالجة: ' + trimmed);

        setDebouncedSearch(trimmed);
        setCurrentPage(1);

        const endTime = performance.now();
        logWithTime('🏁 [FRONTEND] Debounced Search انتهى - الإجمالي: ' + (endTime - startTime).toFixed(2) + 'ms');
      }
    }, 50); // 50ms للبحث المحلي - سريع!

    return () => clearTimeout(handler);
  }, [searchTerm, debouncedSearch]);

  useEffect(() => {
    logWithTime('🔄 [FRONTEND] تغيير فلتر النوع إلى: ' + filterType);
    setCurrentPage(1);
  }, [filterType]);

  // State لتخزين كل العملاء (للبحث المحلي)
  const [allCustomers, setAllCustomers] = useState([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);

  useEffect(() => {
    // تحميل كل العملاء مرة واحدة فقط
    if (!customersLoaded) {
      loadAllCustomers();
    }
  }, []);

  const loadAllCustomers = async () => {
    const startTime = performance.now();
    try {
      setLoading(true);

      const result = await window.api.getCustomers({
        page: 1,
        pageSize: 1000, // تحميل كل العملاء دفعة واحدة
        searchTerm: '',
        customerType: 'all',
        overdueThreshold: overdueThreshold // تمرير حد التأخير للإعدادات
      });

      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);

      logWithTime('📦 [BACKEND] استجابة الداتابيز', result);
      logWithTime('📊 [BACKEND] عدد العملاء المستلمة: ' + (result.data?.length || 0));
      logWithTime('⏱️ [FRONTEND] وقت استجابة الداتابيز: ' + duration + 'ms');

      if (!result.error) {
        setAllCustomers(result.data || []);
        setCustomersLoaded(true);
        logWithTime('✅ [FRONTEND] تم تحميل العملاء بنجاح');
        // تطبيق الفلترة الحالية
        applyFilters();
      } else {
        logErrorWithTime('❌ [BACKEND] خطأ في تحميل العملاء: ' + result.error);
      }
    } catch (err) {
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      logErrorWithTime('💥 [FRONTEND] استثناء في تحميل العملاء (بعد ' + duration + 'ms):', err);
    } finally {
      setLoading(false);
      const endTime = performance.now();
      const totalDuration = (endTime - startTime).toFixed(2);
      logWithTime('🏁 [FRONTEND] انتهاء عملية التحميل - الإجمالي: ' + totalDuration + 'ms');
    }
  };

  const applyFilters = () => {
    const startTime = performance.now();

    logWithTime('🔍 [FRONTEND] applyFilters بدأ - البحث: "' + debouncedSearch + '" | النوع: ' + filterType);
    logWithTime('📊 [FRONTEND] عدد العملاء الأصلي: ' + allCustomers.length);

    let filtered = [...allCustomers];

    // تطبيق فلتر البحث العالمي
    if (debouncedSearch.trim().length > 0) {
      const searchLower = debouncedSearch.toLowerCase();
      const searchStartTime = performance.now();

      filtered = filtered.filter(customer => {
        const nameMatch = customer.name.toLowerCase().includes(searchLower);
        const phoneMatch = customer.phone?.includes(debouncedSearch);
        const cityMatch = customer.city?.toLowerCase().includes(searchLower);
        return nameMatch || phoneMatch || cityMatch;
      });

      const searchEndTime = performance.now();
      const searchDuration = (searchEndTime - searchStartTime).toFixed(2);

      logWithTime('📈 [FRONTEND] البحث اكتمل - النتائج: ' + filtered.length + ' (استغرق ' + searchDuration + 'ms)');
    }

    // تطبيق فلتر الأعمدة
    const activeColumnFilters = Object.entries(columnSearch).filter(([_, value]) => value && value.trim() !== '');
    if (activeColumnFilters.length > 0) {
      filtered = filtered.filter(customer => {
        return activeColumnFilters.every(([key, value]) => {
          if (!value) return true;
          const searchValue = value.toLowerCase();
          let itemValue = '';

          if (key === 'type') itemValue = customer.customerType || '';
          else if (key === 'balance') itemValue = (customer.balance || 0).toString();
          else if (key === 'creditLimit') itemValue = (customer.creditLimit || 0).toString();
          else itemValue = customer[key] || '';

          return String(itemValue).toLowerCase().includes(searchValue);
        });
      });
    }

    // تطبيق فلتر النوع
    if (filterType && filterType !== 'all') {
      const beforeTypeFilter = filtered.length;
      const typeStartTime = performance.now();

      filtered = filtered.filter(customer => customer.customerType === filterType);

      const typeEndTime = performance.now();
      const typeDuration = (typeEndTime - typeStartTime).toFixed(2);

      logWithTime('📊 [FRONTEND] فلترة النوع اكتملت - النتائج: ' + filtered.length + ' من ' + beforeTypeFilter + ' (استغرق ' + typeDuration + 'ms)');
    }

    // تحديث الـ state
    setCustomers(filtered);
    setTotalPages(1);
    setTotalItems(filtered.length);

    const endTime = performance.now();
    const totalDuration = (endTime - startTime).toFixed(2);

    logWithTime('🎯 [FRONTEND] applyFilters انتهت - النتائج النهائية: ' + filtered.length + ' عميل (الإجمالي: ' + totalDuration + 'ms)');
  };

  useEffect(() => {
    const startTime = performance.now();
    logWithTime('🎯 [FRONTEND] useEffect للفلاتر بدأ - هل العملاء محملين؟ ' + customersLoaded);
    logWithTime('🔍 [FRONTEND] البحث الحالي: "' + debouncedSearch + '" | النوع الحالي: ' + filterType);

    // Step 1: التحقق من تحميل العملاء
    const step1Time = performance.now();
    if (customersLoaded && allCustomers.length > 0) {
      logWithTime('✅ [FRONTEND] Step 1: العملاء محملين - تطبيق الفلاتر (استغرق ' + (step1Time - startTime).toFixed(2) + 'ms)');

      // Step 2: استدعاء applyFilters
      const step2Time = performance.now();
      applyFilters();
      logWithTime('🔧 [FRONTEND] Step 2: تم استدعاء applyFilters (استغرق ' + (step2Time - step1Time).toFixed(2) + 'ms)');
    } else {
      logWithTime('⏳ [FRONTEND] Step 1: العملاء لم يتم تحميلهم بعد (استغرق ' + (step1Time - startTime).toFixed(2) + 'ms)');
    }

    const endTime = performance.now();
    logWithTime('🏁 [FRONTEND] useEffect للفلاتر انتهى - الإجمالي: ' + (endTime - startTime).toFixed(2) + 'ms');
  }, [debouncedSearch, filterType, customersLoaded, columnSearch, overdueThreshold]);

  const loadCustomers = async (isBackground = false) => {
    // هذه الدالة مش هتتستخدم تاني - بنستخدم loadAllCustomers و applyFilters
  };

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
      console.log('💾 [FRONTEND] بدء حفظ العميل - تعديل؟', !!editingCustomer);
      console.log('📝 [FRONTEND] بيانات العميل:', formData);

      if (editingCustomer) {
        console.log('✏️ [FRONTEND] تعديل عميل رقم:', editingCustomer.id);
        const result = await window.api.updateCustomer(editingCustomer.id, formData);
        console.log('📦 [BACKEND] نتيجة التعديل:', result);

        if (result.error) {
          console.error('❌ [BACKEND] خطأ في التعديل:', result.error);
          alert(result.error);
          return;
        }
        // تحديث العميل في allCustomers محلياً
        setAllCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, ...formData } : c));
        setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, ...formData } : c));
        console.log('✅ [FRONTEND] تم تحديث العميل محلياً');
      } else {
        console.log('➕ [FRONTEND] إضافة عميل جديد');
        const result = await window.api.addCustomer(formData);
        console.log('📦 [BACKEND] نتيجة الإضافة:', result);

        if (result.error) {
          console.error('❌ [BACKEND] خطأ في الإضافة:', result.error);
          alert(result.error);
          return;
        }
        // إضافة العميل الجديد لـ allCustomers
        const newCustomer = { id: result.id || Date.now(), ...formData };
        setAllCustomers(prev => [...prev, newCustomer]);
        console.log('✅ [FRONTEND] تم إضافة العميل محلياً:', newCustomer);
        // تطبيق الفلاتر تاني عشان يظهر العميل الجديد
        applyFilters();
      }
      setShowModal(false);
      resetCustomerForm();
      setEditingCustomer(null);
      console.log('🎉 [FRONTEND] انتهت عملية حفظ العميل بنجاح');
    } catch (err) {
      console.error('💥 [FRONTEND] استثناء في حفظ العميل:', err);
      alert('خطأ في حفظ البيانات: ' + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await saveCustomer();
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

  const handleEdit = (customer) => {
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
  };

  const handleDelete = async (id) => {
    console.log('🗑️ [FRONTEND] طلب حذف العميل رقم:', id);

    if (confirm('هل أنت متأكد من الحذف؟')) {
      try {
        console.log('⚠️ [FRONTEND] المستخدم أكد الحذف - جاري التنفيذ');
        const result = await window.api.deleteCustomer(id);
        console.log('📦 [BACKEND] نتيجة الحذف:', result);

        if (result.error) {
          console.error('❌ [BACKEND] خطأ في الحذف:', result.error);
          alert('خطأ في الحذف');
        } else {
          // حذف العميل من allCustomers محلياً
          setAllCustomers(prev => {
            const beforeDelete = prev.length;
            const afterDelete = prev.filter(c => c.id !== id).length;
            console.log('📊 [FRONTEND] عدد العملاء قبل الحذف:', beforeDelete, 'بعد الحذف:', afterDelete);
            return prev.filter(c => c.id !== id);
          });
          setCustomers(prev => prev.filter(c => c.id !== id));
          console.log('✅ [FRONTEND] تم حذف العميل محلياً');
          alert('تم الحذف بنجاح');
        }
      } catch (err) {
        console.error('💥 [FRONTEND] استثناء في الحذف:', err);
        alert('خطأ في الحذف');
      }
    } else {
      console.log('❌ [FRONTEND] المستخدم ألغى الحذف');
    }
  };

  const handlePayment = (customer) => {
    setSelectedCustomer(customer);
    setPaymentData({ amount: '', notes: '', paymentDate: new Date().toISOString().split('T')[0] });
    setShowPaymentModal(true);
  };

  const submitPayment = async (paymentFormData) => {
    console.log('💳 [FRONTEND] بدء تسجيل دفعة');
    console.log('👤 [FRONTEND] العميل:', selectedCustomer?.name, 'الرصيد الحالي:', selectedCustomer?.balance);
    console.log('💰 [FRONTEND] بيانات الدفعة:', paymentFormData);

    // تأكيد بسيط للمستخدم قبل الإرسال
    const paymentAmount = parseFloat(paymentFormData.amount);
    // Allow negative amounts (customer may receive money), but disallow zero or non-numeric
    if (isNaN(paymentAmount) || paymentAmount === 0) {
      console.error('❌ [FRONTEND] مبلغ غير صالح:', paymentAmount);
      alert('الرجاء إدخال مبلغ صالح (غير صفر)');
      return;
    }

    const previewNewBalance = (selectedCustomer.balance - paymentAmount).toFixed(2);
    const paymentDate = new Date(paymentFormData.paymentDate);
    const confirmText = `سوف تُسجّل دفعة بقيمة ${formatCurrency(paymentAmount)} بتاريخ ${paymentDate.toLocaleDateString('ar-EG')}\nالرصيد بعد التسجيل: ${previewNewBalance}\n\nهل تريد المتابعة؟`;
    if (!window.confirm(confirmText)) {
      console.log('❌ [FRONTEND] المستخدم ألغى الدفعة');
      return;
    }

    console.log('✅ [FRONTEND] المستخدم أكد الدفعة - جاري الإرسال للداتابيز');
    setPaymentSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomer.id,
        amount: paymentAmount,
        notes: paymentFormData.notes || '',
        paymentDate: paymentFormData.paymentDate // ✅ إرسال التاريخ بصيغة YYYY-MM-DD
      };

      console.log('📤 [FRONTEND] إرسال طلب الدفعة للباك:', payload);
      const result = await window.api.addCustomerPayment(payload);
      console.log('📦 [BACKEND] استجابة الدفعة:', result);

      if (!result.error) {
        console.log('✅ [BACKEND] تم تسجيل الدفعة بنجاح');
        const newBalance = (selectedCustomer.balance || 0) - paymentAmount;
        console.log('📊 [FRONTEND] تحديث الرصيد من', selectedCustomer.balance, 'إلى', newBalance);

        // تحديث رصيد العميل في allCustomers محلياً
        setAllCustomers(prev => prev.map(c =>
          c.id === selectedCustomer.id
            ? { ...c, balance: newBalance }
            : c
        ));

        // تحديث رصيد العميل في customers (العرض الحالي) مباشرة
        setCustomers(prev => prev.map(c =>
          c.id === selectedCustomer.id
            ? { ...c, balance: newBalance }
            : c
        ));

        // clear local paymentData so modal fields reset when closed
        setPaymentData({ amount: '', notes: '', paymentDate: new Date().toISOString().split('T')[0] });
        console.log('🎉 [FRONTEND] انتهت عملية الدفعة بنجاح');
      } else {
        console.error('❌ [BACKEND] خطأ في تسجيل الدفعة:', result.error);
      }

      // return result to caller so it can show alerts / close UI
      return result;
    } catch (err) {
      console.error('💥 [FRONTEND] استثناء في تسجيل الدفعة:', err);
      alert('خطأ في التسجيل: ' + err.message);
    } finally {
      setPaymentSubmitting(false);
      console.log('🏁 [FRONTEND] انتهاء عملية الدفعة');
    }
  };

  const getTotalDebt = () => {
    return customers.reduce((sum, customer) => sum + Math.max(0, customer.balance), 0);
  };

  // دوال مساعدة
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getCustomerTypeColor = (type) => {
    switch (type) {
      case 'VIP':
        return '#f59e0b';
      case 'تاجر جملة':
        return '#8b5cf6';
      case 'عادي':
      default:
        return '#3b82f6';
    }
  };

  const customerStats = useMemo(() => {
    let vipCount = 0;
    let debtedCount = 0;
    let compliantCount = 0;
    let totalDebt = 0;
    let overdueCount = 0;
    let total = customers.length;

    for (const c of customers) {
      if (c.customerType === 'VIP') vipCount += 1;
      if (c.balance > 0) {
        debtedCount += 1;
        totalDebt += c.balance;
      } else {
        compliantCount++;
      }
      if ((c.lastPaymentDays || 0) > overdueThreshold) {
        overdueCount++;
      }
    }

    return { vipCount, debtedCount, compliantCount, totalDebt, overdueCount, total };
  }, [customers, overdueThreshold]);

  // ===== EVENT HANDLERS =====
  const handleShowLedger = useCallback((customerId) => {
    setSelectedCustomer(customerId);
    setShowLedger(true);
  }, []);

  const handlePaymentCallback = useCallback((customer) => {
    setSelectedCustomer(customer);
    setShowPayment(true);
  }, []);

  const handleEditCallback = useCallback((customer) => {
    setCustomerFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      phone2: customer.phone2 || '',
      address: customer.address || '',
      city: customer.city || '',
      district: customer.district || '',
      notes: customer.notes || '',
      creditLimit: customer.creditLimit || 0,
      customerType: customer.customerType || 'عادي'
    });
    setEditingCustomer(customer);
    setShowNewCustomer(true);
  }, []);

  const handleDeleteCallback = useCallback(async (customerId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العميل؟')) return;

    try {
      console.log('⚠️ [FRONTEND] المستخدم أكد الحذف - جاري التنفيذ');
      const result = await window.api.deleteCustomer(customerId);
      console.log('📦 [BACKEND] نتيجة الحذف:', result);

      if (result.error) {
        console.error('❌ [BACKEND] خطأ في الحذف:', result.error);
        alert('خطأ في الحذف');
      } else {
        // حذف العميل من allCustomers محلياً
        setAllCustomers(prev => {
          const beforeDelete = prev.length;
          const afterDelete = prev.filter(c => c.id !== customerId).length;
          console.log('📊 [FRONTEND] عدد العملاء قبل الحذف:', beforeDelete, 'بعد الحذف:', afterDelete);
          return prev.filter(c => c.id !== customerId);
        });
        setCustomers(prev => prev.filter(c => c.id !== customerId));
        console.log('✅ [FRONTEND] تم حذف العميل محلياً');
        alert('تم الحذف بنجاح');
      }
    } catch (err) {
      console.error('💥 [FRONTEND] استثناء في الحذف:', err);
      alert('خطأ في الحذف');
    }
  }, []);

  // دالة لحساب آخر تاريخ دفع وحالة النشاط - من البيانات الحقيقية
  const getLastPaymentInfo = (customer) => {
    // نحصل على آخر حركة من customerLedger أو invoices
    // إذا ما فيش آخر دفعة نستخدم آخر فاتورة
    const lastPaymentDays = customer.lastPaymentDays || 0;
    const lastPaymentDate = new Date();
    lastPaymentDate.setDate(lastPaymentDate.getDate() - lastPaymentDays);

    // يستخدم overdueThreshold من الإعدادات
    const isOverdue = lastPaymentDays > overdueThreshold;
    const lastOperationType = customer.lastOperationType || 'فاتورة';

    return {
      lastPaymentDate: lastPaymentDate.toLocaleDateString('ar-EG'),
      daysAgo: lastPaymentDays,
      operationType: lastOperationType,
      isOverdue: isOverdue,
      tooltipText: `آخر ${lastOperationType}: ${lastPaymentDate.toLocaleDateString('ar-EG')}\n(${lastPaymentDays} يوم مضت)`
    };
  };

  const cellStyle = {
    padding: '14px',
    maxWidth: '180px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: '14px',
    color: '#374151',
  };



  // البحث والفلترة


  const handleColumnSearchChange = (field, value) => {
    setColumnSearch(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleColumn = (column) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  // معالج الأسهم والـ Enter للتنقل في البحث
  const handleSearchKeyDown = (e) => {
    if (customers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex(prev => {
        if (prev < customers.length - 1) {
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
      handlePayment(customers[selectedSearchIndex]);
    }
  };

  // Reset الاختيار عند تغيير البحث
  useEffect(() => {
    setSelectedSearchIndex(-1);
  }, [searchTerm, filterType]);

  // دالة الطباعة
  const printReport = useCallback((reportType) => {
    let reportCustomers = [];
    let reportTitle = '';
    
    switch (reportType) {
      case 'all':
        reportCustomers = allCustomers;
        reportTitle = 'كشف بجميع العملاء';
        break;
      case 'debted':
        reportCustomers = allCustomers.filter(c => c.balance > 0);
        reportTitle = 'العملاء المدينين';
        break;
      case 'overdue':
        reportCustomers = allCustomers.filter(c => (c.lastPaymentDays || 0) > overdueThreshold);
        reportTitle = 'العملاء المتأخرين في الدفع';
        break;
      case 'compliant':
        reportCustomers = allCustomers.filter(c => (c.lastPaymentDays || 0) <= overdueThreshold);
        reportTitle = 'العملاء الملتزمين';
        break;
      default:
        return;
    }

    // إنشاء نافذة الطباعة
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>${reportTitle}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; }
            h1 { text-align: center; color: #1f2937; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #d1d5db; padding: 10px; text-align: right; }
            th { background-color: #3b82f6; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .total { font-weight: bold; background-color: #dbeafe; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>${reportTitle}</h1>
          <p>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
          <p>عدد العملاء: ${reportCustomers.length}</p>
          
          <table>
            <thead>
              <tr>
                <th>الرقم</th>
                <th>اسم العميل</th>
                <th>النوع</th>
                <th>الهاتف</th>
                <th>الرصيد</th>
              </tr>
            </thead>
            <tbody>
              ${reportCustomers.map(customer => `
                <tr>
                  <td>${customer.id}</td>
                  <td>${customer.name}</td>
                  <td>${customer.customerType}</td>
                  <td>${customer.phone || '-'}</td>
                  <td>${formatCurrency(customer.balance)}</td>
                </tr>
              `).join('')}
              <tr class="total">
                <td colspan="4">الإجمالي</td>
                <td>${formatCurrency(reportCustomers.reduce((sum, c) => sum + c.balance, 0))}</td>
              </tr>
            </tbody>
          </table>
          
          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [allCustomers, overdueThreshold, formatCurrency]);
    const debtedCustomers = customers.filter(c => c.balance > 0);
    const totalDebt = debtedCustomers.reduce((sum, c) => sum + c.balance, 0);

    const reportData = debtedCustomers.map(c => ({
      id: c.id,
      name: c.name,
      type: c.customerType,
      phone: c.phone,
      city: c.city,
      debt: c.balance,
      creditLimit: c.creditLimit
    })).sort((a, b) => b.debt - a.debt);

    return {
      title: 'تقرير المديونيات',
      subtitle: `إجمالي المديونيات: ${totalDebt.toFixed(2)}`,
      summary: `عدد العملاء المدينين: ${debtedCustomers.length}`,
      data: reportData,
      columns: ['#', 'الاسم', 'النوع', 'الهاتف', 'المدينة', 'المبلغ المدين', 'الحد الائتماني'],
      totals: `إجمالي: ${totalDebt.toFixed(2)}`
    };
  };

  const generateCustomerTypesReport = () => {
    const types = ['عادي', 'VIP', 'تاجر جملة'];
    const reportData = types.map(type => {
      const typeCustomers = customers.filter(c => c.customerType === type);
      const totalBalance = typeCustomers.reduce((sum, c) => sum + c.balance, 0);
      return {
        type,
        count: typeCustomers.length,
        totalDebt: totalBalance,
        avgDebt: typeCustomers.length > 0 ? (totalBalance / typeCustomers.length).toFixed(2) : 0
      };
    });

    return {
      title: 'تقرير تصنيف العملاء',
      subtitle: `إجمالي العملاء: ${customers.length}`,
      summary: `تحليل حسب نوع العميل`,
      data: reportData,
      columns: ['النوع', 'عدد العملاء', 'إجمالي المديونيات', 'متوسط المديونية'],
      totals: `إجمالي العملاء: ${customers.length}`
    };
  };

  const generateCitiesReport = () => {
    const citiesMap = {};
    customers.forEach(c => {
      const city = c.city || 'بدون مدينة';
      if (!citiesMap[city]) {
        citiesMap[city] = { count: 0, totalDebt: 0, totalCredit: 0 };
      }
      citiesMap[city].count++;
      citiesMap[city].totalDebt += Math.max(0, c.balance);
      citiesMap[city].totalCredit += Math.min(0, -c.balance);
    });

    const reportData = Object.entries(citiesMap)
      .map(([city, data]) => ({
        city,
        count: data.count,
        totalDebt: data.totalDebt,
        totalCredit: data.totalCredit
      }))
      .sort((a, b) => b.totalDebt - a.totalDebt);

    return {
      title: 'تقرير التوزيع الجغرافي',
      subtitle: `عدد المدن: ${Object.keys(citiesMap).length}`,
      summary: `توزيع العملاء حسب المدينة`,
      data: reportData,
      columns: ['المدينة', 'عدد العملاء', 'إجمالي المديونيات', 'إجمالي الأرصدة الدائنة'],
      totals: `إجمالي المدن: ${Object.keys(citiesMap).length}`
    };
  };

  const generateSelectedCustomersReport = () => {
    if (customers.length === 0) return null;

    const totalDebt = customers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
    const totalCredit = customers.reduce((sum, c) => sum + Math.min(0, -c.balance), 0);

    const reportData = customers.map((c, idx) => ({
      no: idx + 1,
      name: c.name,
      type: c.customerType,
      phone: c.phone,
      city: c.city,
      balance: c.balance,
      creditLimit: c.creditLimit
    }));

    return {
      title: 'تقرير العملاء المختارين',
      subtitle: `عدد العملاء: ${customers.length}`,
      summary: `البحث: "${searchTerm}" | النوع: ${filterType === 'all' ? 'الكل' : filterType}`,
      data: reportData,
      columns: ['#', 'الاسم', 'النوع', 'الهاتف', 'المدينة', 'الرصيد', 'الحد الائتماني'],
      totals: `إجمالي المديونيات: ${totalDebt.toFixed(2)} | الأرصدة الدائنة: ${totalCredit.toFixed(2)}`
    };
  };

  const generateTopDebtorsReport = () => {
    const topDebtors = customers
      .filter(c => c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 20);

    const totalDebt = topDebtors.reduce((sum, c) => sum + c.balance, 0);

    return {
      title: 'تقرير أكبر المدينين',
      subtitle: `أكبر 20 عميل مدين`,
      summary: `إجمالي مديونياتهم: ${totalDebt.toFixed(2)}`,
      data: topDebtors.map((c, idx) => ({
        rank: idx + 1,
        name: c.name,
        type: c.customerType,
        phone: c.phone,
        debt: c.balance,
        percentage: ((c.balance / totalDebt) * 100).toFixed(1)
      })),
      columns: ['الترتيب', 'الاسم', 'النوع', 'الهاتف', 'المبلغ المدين', 'النسبة'],
      totals: `إجمالي: ${totalDebt.toFixed(2)}`
    };
  };

  const generateDebtAgingReport = () => {
    // حساب أعمار الديون - نفترض أن كل عميل له آخر فاتورة (سنستخدم بيانات وهمية للآن)
    const today = new Date();
    const debtedCustomers = customers.filter(c => c.balance > 0);

    const agingBuckets = {
      '0-30': [],
      '31-60': [],
      '61-90': [],
      '+90': []
    };

    debtedCustomers.forEach(customer => {
      // نقسم الديون عشوائياً بناءً على ID (في التطبيق الفعلي تأتي من invoices)
      const daysOld = (customer.id * 15) % 120;
      let bucket;

      if (daysOld <= 30) bucket = '0-30';
      else if (daysOld <= 60) bucket = '31-60';
      else if (daysOld <= 90) bucket = '61-90';
      else bucket = '+90';

      agingBuckets[bucket].push({
        name: customer.name,
        type: customer.customerType,
        phone: customer.phone,
        debt: customer.balance,
        age: daysOld,
        daysText: `${daysOld} يوم`
      });
    });

    const reportData = [];
    Object.entries(agingBuckets).forEach(([range, items]) => {
      const subtotal = items.reduce((sum, item) => sum + item.debt, 0);
      reportData.push({
        type: 'header',
        range,
        count: items.length,
        subtotal: subtotal.toFixed(2),
        percentage: ((subtotal / debtedCustomers.reduce((sum, c) => sum + c.balance, 0)) * 100).toFixed(1)
      });
      items.forEach(item => {
        reportData.push({
          type: 'item',
          name: item.name,
          customerType: item.type,
          phone: item.phone,
          debt: item.debt.toFixed(2),
          age: item.daysText
        });
      });
    });

    const totalDebt = debtedCustomers.reduce((sum, c) => sum + c.balance, 0);

    return {
      title: 'تقرير أعمار الديون (Aging Report)',
      subtitle: `تحليل المديونيات حسب الفترة الزمنية`,
      summary: `إجمالي المديونيات: ${totalDebt.toFixed(2)} | عدد العملاء المدينين: ${debtedCustomers.length}`,
      data: reportData,
      isAging: true,
      bucketSummary: {
        '0-30': {
          count: agingBuckets['0-30'].length,
          total: agingBuckets['0-30'].reduce((sum, c) => sum + c.debt, 0)
        },
        '31-60': {
          count: agingBuckets['31-60'].length,
          total: agingBuckets['31-60'].reduce((sum, c) => sum + c.debt, 0)
        },
        '61-90': {
          count: agingBuckets['61-90'].length,
          total: agingBuckets['61-90'].reduce((sum, c) => sum + c.debt, 0)
        },
        '+90': {
          count: agingBuckets['+90'].length,
          total: agingBuckets['+90'].reduce((sum, c) => sum + c.debt, 0)
        }
      },
      totals: `إجمالي الديون: ${totalDebt.toFixed(2)}`
    };
  };

  const generateGoodPayersReport = () => {
    const goodPayers = customers.filter(c => c.balance <= 0);
    const perfectPayers = goodPayers.filter(c => c.balance === 0);
    const advancePayers = goodPayers.filter(c => c.balance < 0);

    const advanceTotal = advancePayers.reduce((sum, c) => sum + Math.abs(c.balance), 0);

    const reportData = goodPayers.map(c => ({
      name: c.name,
      type: c.customerType,
      phone: c.phone,
      city: c.city,
      phone2: c.phone2,
      status: c.balance === 0 ? 'مسدد' : `دفعة مقدمة: ${Math.abs(c.balance).toFixed(2)}`,
      balance: Math.abs(c.balance).toFixed(2)
    }));

    return {
      title: 'تقرير العملاء الملتزمين',
      subtitle: `العملاء الذين لا يملكون ديون`,
      summary: `عملاء ملتزمين: ${goodPayers.length} | منهم ${perfectPayers.length} مسددة | ${advancePayers.length} لديهم دفعات مقدمة`,
      data: reportData,
      columns: ['الاسم', 'النوع', 'الهاتف', 'المدينة', 'الهاتف 2', 'الحالة', 'المبلغ'],
      totals: `إجمالي الدفعات المقدمة: ${advanceTotal.toFixed(2)} | عملاء ملتزمين: ${goodPayers.length}`
    };
  };

  const generateTrendReport = () => {
    // تقرير الاتجاه - نحسب بيانات شهرية وهمية
    const monthlyData = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

      // حساب وهمي للمديونيات (في التطبيق الفعلي تأتي من قاعدة البيانات)
      const variation = Math.sin(i * 0.5) * 1000;
      const baseDebt = customers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
      const monthlyDebt = Math.max(0, baseDebt + variation);

      monthlyData.push({
        month: monthName,
        debt: monthlyDebt.toFixed(2),
        change: i === 0 ? 0 : ((variation / baseDebt) * 100).toFixed(1),
        trend: variation >= 0 ? '↑' : '↓'
      });
    }

    const currentTotal = customers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
    const previousTotal = currentTotal * 0.9;
    const monthlyChange = ((currentTotal - previousTotal) / previousTotal * 100).toFixed(1);

    return {
      title: 'تقرير تطور المديونية (Trend Report)',
      subtitle: `المديونيات خلال آخر 12 شهر`,
      summary: `إجمالي المديونيات الحالية: ${currentTotal.toFixed(2)} | التغير هذا الشهر: ${monthlyChange}%`,
      data: monthlyData,
      columns: ['الشهر', 'إجمالي المديونيات', 'التغير من الشهر السابق', 'الاتجاه'],
      totals: `إجمالي: ${currentTotal.toFixed(2)} | متوسط: ${(currentTotal / 12).toFixed(2)}`
    };
  };

  const generatePaymentMovementsReport = () => {
    // في التطبيق الفعلي، هذا يأتي من سجل الحركات المالية
    // هنا نعرض توليد بيانات وهمية
    const movements = [];

    customers.forEach(customer => {
      const invoiceCount = Math.floor(Math.random() * 5) + 1;
      const totalInvoices = customer.balance > 0 ? customer.balance + (Math.random() * 500) : Math.random() * 1000;

      for (let i = 0; i < invoiceCount; i++) {
        const isPayment = Math.random() > 0.4;
        const amount = isPayment ? Math.random() * 500 : Math.random() * 1000;
        const daysAgo = Math.floor(Math.random() * 90);
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);

        movements.push({
          date: date.toLocaleDateString('ar-EG'),
          customer: customer.name,
          type: isPayment ? 'دفعة' : 'فاتورة',
          amount: amount.toFixed(2),
          description: isPayment ? `دفعة رقم ${i + 1}` : `فاتورة رقم ${i + 1}`,
          balance: (Math.random() * 5000).toFixed(2)
        });
      }
    });

    movements.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      title: 'تقرير الحركات المالية',
      subtitle: `جميع العمليات المالية للعملاء`,
      summary: `إجمالي العمليات: ${movements.length}`,
      data: movements.slice(0, 100), // آخر 100 حركة
      columns: ['التاريخ', 'العميل', 'نوع العملية', 'المبلغ', 'الوصف', 'الرصيد'],
      totals: `إجمالي العمليات المعروضة: ${movements.slice(0, 100).length}`
    };
  };

  const generatePaymentBehaviorReport = () => {
    // تقرير سلوك الدفع
    const behaviorData = customers.map(customer => {
      const avgPaymentDays = 15 + Math.floor(Math.random() * 45);
      const delayCount = Math.floor(Math.random() * 5);
      const avgPaymentAmount = customer.balance > 0 ? customer.balance / 2 : Math.random() * 1000;

      let classification;
      if (customer.balance === 0 && delayCount === 0) classification = 'ملتزم';
      else if (customer.balance < 1000 && delayCount <= 1) classification = 'متوسط';
      else classification = 'متأخر';

      return {
        name: customer.name,
        type: customer.customerType,
        phone: customer.phone,
        avgPaymentDays,
        delayCount,
        avgPaymentAmount: avgPaymentAmount.toFixed(2),
        classification,
        lastPayment: `${Math.floor(Math.random() * 30)} يوم`,
        score: (100 - (delayCount * 10) - (avgPaymentDays / 2)).toFixed(1)
      };
    });

    const committedCount = behaviorData.filter(b => b.classification === 'ملتزم').length;
    const averageCount = behaviorData.filter(b => b.classification === 'متوسط').length;
    const delayedCount = behaviorData.filter(b => b.classification === 'متأخر').length;

    return {
      title: 'تقرير سلوك الدفع',
      subtitle: `تحليل التزام العملاء بالدفع`,
      summary: `ملتزمون: ${committedCount} | متوسطون: ${averageCount} | متأخرون: ${delayedCount}`,
      data: behaviorData,
      columns: ['الاسم', 'النوع', 'الهاتف', 'متوسط أيام السداد', 'عدد التأخيرات', 'متوسط الدفعة', 'التصنيف', 'آخر دفعة', 'النقاط'],
      totals: `إجمالي العملاء: ${behaviorData.length} | متوسط النقاط: ${(behaviorData.reduce((sum, b) => sum + parseFloat(b.score), 0) / behaviorData.length).toFixed(1)}`
    };
  };

  const generateInactiveCustomersReport = () => {
    // تقرير العملاء غير النشطين
    const inactiveData = customers.map(customer => {
      const daysInactive = Math.floor(Math.random() * 365);
      const lastInvoiceDate = new Date();
      lastInvoiceDate.setDate(lastInvoiceDate.getDate() - daysInactive);

      const lastPaymentDate = new Date();
      lastPaymentDate.setDate(lastPaymentDate.getDate() - (daysInactive + Math.floor(Math.random() * 30)));

      return {
        name: customer.name,
        type: customer.customerType,
        phone: customer.phone,
        city: customer.city,
        lastInvoice: lastInvoiceDate.toLocaleDateString('ar-EG'),
        lastPayment: lastPaymentDate.toLocaleDateString('ar-EG'),
        daysInactive,
        inactivityStatus: daysInactive > 180 ? '🔴 خطير' : daysInactive > 90 ? '🟠 تحذير' : '🟢 نشط',
        currentBalance: customer.balance.toFixed(2)
      };
    }).filter(c => c.daysInactive > 30).sort((a, b) => b.daysInactive - a.daysInactive);

    const criticalCount = inactiveData.filter(c => c.daysInactive > 180).length;
    const warningCount = inactiveData.filter(c => c.daysInactive > 90 && c.daysInactive <= 180).length;

    return {
      title: 'تقرير العملاء غير النشطين',
      subtitle: `العملاء الذين لم يقوموا بعمليات حديثة`,
      summary: `عملاء غير نشطين: ${inactiveData.length} | حرجة: ${criticalCount} | تحذير: ${warningCount}`,
      data: inactiveData,
      columns: ['الاسم', 'النوع', 'الهاتف', 'المدينة', 'آخر فاتورة', 'آخر دفعة', 'عدد أيام عدم النشاط', 'الحالة', 'الرصيد الحالي'],
      totals: `إجمالي غير النشطين: ${inactiveData.length} | حرجة: ${criticalCount} | تحذير: ${warningCount}`
    };
  };

  const printReport = (reportType) => {
    let report;
    switch (reportType) {
      case 'all':
        reportCustomers = allCustomers;
        reportTitle = 'كشف بجميع العملاء';
        break;
      case 'debted':
        reportCustomers = allCustomers.filter(c => c.balance > 0);
        reportTitle = 'العملاء المدينين';
        break;
      case 'overdue':
        reportCustomers = allCustomers.filter(c => (c.lastPaymentDays || 0) > overdueThreshold);
        reportTitle = 'العملاء المتأخرين في الدفع';
        break;
      case 'compliant':
        reportCustomers = allCustomers.filter(c => (c.lastPaymentDays || 0) <= overdueThreshold);
        reportTitle = 'العملاء الملتزمين';
        break;
      default:
        return;
    }

    // إنشاء نافذة الطباعة
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>${reportTitle}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; }
            h1 { text-align: center; color: #1f2937; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #d1d5db; padding: 10px; text-align: right; }
            th { background-color: #3b82f6; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .total { font-weight: bold; background-color: #dbeafe; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>${reportTitle}</h1>
          <p>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
          <p>عدد العملاء: ${reportCustomers.length}</p>
          
          <table>
            <thead>
              <tr>
                <th>الرقم</th>
                <th>اسم العميل</th>
                <th>النوع</th>
                <th>الهاتف</th>
                <th>الرصيد</th>
              </tr>
            </thead>
            <tbody>
              ${reportCustomers.map(customer => `
                <tr>
                  <td>${customer.id}</td>
                  <td>${customer.name}</td>
                  <td>${customer.customerType}</td>
                  <td>${customer.phone || '-'}</td>
                  <td>${formatCurrency(customer.balance)}</td>
                </tr>
              `).join('')}
              <tr class="total">
                <td colspan="4">الإجمالي</td>
                <td>${formatCurrency(reportCustomers.reduce((sum, c) => sum + c.balance, 0))}</td>
              </tr>
            </tbody>
          </table>
          
          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [allCustomers, overdueThreshold, formatCurrency]);

  // ===== RENDER =====
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '20px',
        color: '#6b7280'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{
            border: '4px solid #f3f4f6',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          جاري تحميل العملاء...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '25px',
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#1f2937', fontSize: '28px' }}>
            إدارة العملاء
          </h1>
          <p style={{ margin: '5px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            إجمالي العملاء: {customerStats.total} | 
            المدينين: {customerStats.overdueCount} | 
            الملتزمين: {customerStats.compliantCount}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '600',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6b7280'}
          >
            <Settings size={18} />
            الإعدادات
          </button>

          <button
            onClick={() => setShowReports(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '600',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#8b5cf6'}
          >
            <Printer size={18} />
            التقارير
          </button>

          <button
            onClick={() => {
              setCustomerFormData({
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
              setEditingCustomer(null);
              setShowNewCustomer(true);
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '600',
              fontSize: '16px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            <Plus size={20} />
            عميل جديد
          </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div style={{
        backgroundColor: 'white',
        padding: '15px 20px',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ position: 'relative', maxWidth: '500px' }}>
          <Search
            size={20}
            style={{
              position: 'absolute',
              right: '15px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af'
            }}
          />
          <input
            type="text"
            placeholder="ابحث عن عميل (الاسم، الهاتف، النوع...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 45px 12px 15px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '15px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>
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
              <label style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                cursor: 'pointer',
                gap: '10px',
                borderBottom: '1px solid #f3f4f6',
                marginBottom: '5px',
                fontWeight: 'bold',
                color: '#3b82f6',
                borderRadius: '8px',
                transition: 'background-color 0.2s',
              }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <input
                  type="checkbox"
                  checked={showSearchRow}
                  onChange={(e) => setShowSearchRow(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#3b82f6' }}
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
                <label key={key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  gap: '10px',
                  borderRadius: '8px',
                  transition: 'background-color 0.2s',
                  color: '#374151',
                  fontSize: '14px'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[key] || false}
                    onChange={() => toggleColumn(key)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#3b82f6' }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div style={{ padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>إجمالي العملاء</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>{allCustomers.length}</div>
        </div>
        <div style={{ padding: '15px', backgroundColor: '#fffbeb', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>عملاء VIP</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>
            {customerStats.vipCount}
          </div>
        </div>
        <div style={{ padding: '15px', backgroundColor: '#fef2f2', borderRadius: '8px', textAlign: 'center', border: '1px solid #fee2e2' }}>
          <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '5px' }}>🔴 عملاء متأخرين</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc2626' }}>
            {customerStats.overdueCount}
          </div>
          <div style={{ fontSize: '10px', color: '#ef4444' }}>مضى {overdueThreshold} يوم</div>
        </div>
        <div style={{ padding: '15px', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>نتائج البحث</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#374151' }}>{customers.length}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
          <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
            <tr>
              {visibleColumns.id && <th style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#374151' }}>#</th>}
              {visibleColumns.name && <th style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#374151' }}>الاسم</th>}
              {visibleColumns.type && <th style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#374151' }}>النوع</th>}
              {visibleColumns.phone && <th style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#374151' }}>الهاتف</th>}
              {visibleColumns.phone2 && <th style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#374151' }}>الهاتف 2</th>}
              {visibleColumns.address && <th style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#374151' }}>العنوان</th>}
              {visibleColumns.city && <th style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#374151' }}>المدينة</th>}
              {visibleColumns.district && <th style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#374151' }}>المنطقة</th>}
              {visibleColumns.notes && <th style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#374151' }}>الملاحظات</th>}
              {visibleColumns.creditLimit && <th style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#374151' }}>الحد الائتماني</th>}
              {visibleColumns.balance && <th style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#374151' }}>الرصيد</th>}
              {visibleColumns.actions && <th style={{ padding: '4px 6px', textAlign: 'center', width: '36px' }}>عرض</th>}
              {visibleColumns.actions && <th style={{ padding: '4px 6px', textAlign: 'center', width: '36px' }}>دفع</th>}
              {visibleColumns.actions && <th style={{ padding: '4px 6px', textAlign: 'center', width: '36px' }}>تعديل</th>}
              {visibleColumns.actions && <th style={{ padding: '4px 6px', textAlign: 'center', width: '36px' }}>حذف</th>}
            </tr>
            {/* صف البحث */}
            {showSearchRow && (
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                {visibleColumns.id && <th style={{ padding: '5px' }}><input style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }} placeholder="بحث..." value={columnSearch.id || ''} onChange={(e) => handleColumnSearchChange('id', e.target.value)} /></th>}
                {visibleColumns.name && <th style={{ padding: '5px' }}><input style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }} placeholder="بحث..." value={columnSearch.name || ''} onChange={(e) => handleColumnSearchChange('name', e.target.value)} /></th>}
                {visibleColumns.type && <th style={{ padding: '5px' }}><input style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }} placeholder="بحث..." value={columnSearch.type || ''} onChange={(e) => handleColumnSearchChange('type', e.target.value)} /></th>}
                {visibleColumns.phone && <th style={{ padding: '5px' }}><input style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }} placeholder="بحث..." value={columnSearch.phone || ''} onChange={(e) => handleColumnSearchChange('phone', e.target.value)} /></th>}
                {visibleColumns.phone2 && <th style={{ padding: '5px' }}><input style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }} placeholder="بحث..." value={columnSearch.phone2 || ''} onChange={(e) => handleColumnSearchChange('phone2', e.target.value)} /></th>}
                {visibleColumns.address && <th style={{ padding: '5px' }}><input style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }} placeholder="بحث..." value={columnSearch.address || ''} onChange={(e) => handleColumnSearchChange('address', e.target.value)} /></th>}
                {visibleColumns.city && <th style={{ padding: '5px' }}><input style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }} placeholder="بحث..." value={columnSearch.city || ''} onChange={(e) => handleColumnSearchChange('city', e.target.value)} /></th>}
                {visibleColumns.district && <th style={{ padding: '5px' }}><input style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }} placeholder="بحث..." value={columnSearch.district || ''} onChange={(e) => handleColumnSearchChange('district', e.target.value)} /></th>}
                {visibleColumns.notes && <th style={{ padding: '5px' }}><input style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }} placeholder="بحث..." value={columnSearch.notes || ''} onChange={(e) => handleColumnSearchChange('notes', e.target.value)} /></th>}
                {visibleColumns.creditLimit && <th style={{ padding: '5px' }}><input style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }} placeholder="بحث..." value={columnSearch.creditLimit || ''} onChange={(e) => handleColumnSearchChange('creditLimit', e.target.value)} /></th>}
                {visibleColumns.balance && <th style={{ padding: '5px' }}><input style={{ width: '100%', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }} placeholder="بحث..." value={columnSearch.balance || ''} onChange={(e) => handleColumnSearchChange('balance', e.target.value)} /></th>}
                {visibleColumns.actions && <th style={{ padding: '5px' }}></th>}
                {visibleColumns.actions && <th style={{ padding: '5px' }}></th>}
                {visibleColumns.actions && <th style={{ padding: '5px' }}></th>}
                {visibleColumns.actions && <th style={{ padding: '5px' }}></th>}
              </tr>
            )}
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan="20" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>
                  لا توجد عملاء مطابقة للبحث
                </td>
              </tr>
            ) : (
              customers.map((customer, index) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  index={index}
                  isSelected={selectedSearchIndex === index}
                  visibleColumns={visibleColumns}
                  overdueThreshold={overdueThreshold}
                  onShowLedger={handleShowLedger}
                  onPayment={handlePaymentCallback}
                  onEdit={handleEditCallback}
                  onDelete={handleDeleteCallback}
                  getCustomerTypeColor={getCustomerTypeColor}
                  formatCurrency={formatCurrency}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <div style={{ color: '#6b7280', fontSize: '14px' }}>
                  عرض {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredCustomers.length)} من {filteredCustomers.length}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      backgroundColor: currentPage === 1 ? '#f9fafb' : 'white',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: currentPage === 1 ? 0.5 : 1
                    }}
                  >
                    <ChevronRight size={18} />
                  </button>

                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    // Show only nearby pages
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            backgroundColor: currentPage === pageNum ? '#3b82f6' : 'white',
                            color: currentPage === pageNum ? 'white' : '#374151',
                            cursor: 'pointer',
                            fontWeight: currentPage === pageNum ? '600' : '400',
                            minWidth: '40px'
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (
                      pageNum === currentPage - 3 ||
                      pageNum === currentPage + 3
                    ) {
                      return <span key={pageNum} style={{ padding: '8px 4px' }}>...</span>;
                    }
                    return null;
                  })}

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      backgroundColor: currentPage === totalPages ? '#f9fafb' : 'white',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: currentPage === totalPages ? 0.5 : 1
                    }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <NewCustomerModal
        isOpen={showModal}
        customer={formData}
        onChange={setFormData}
        onSave={saveCustomer}
        existingCustomers={customers}
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
        onPaymentDataChange={setPaymentData}
        onSubmit={submitPayment}
        onClose={() => setShowPaymentModal(false)}
        isSubmitting={paymentSubmitting}
        formatCurrency={formatCurrency}
      />

      {/* Customer Ledger */}
      {
        showLedger && (
          <CustomerLedger
            customerId={showLedger}
            onClose={() => {
              setShowLedger(null);
              loadCustomers(true);
            }}
          />
        )
      }

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div
          style={{
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
          }}
          onClick={() => setShowSettings(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '30px',
              width: '500px',
              maxWidth: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '25px', color: '#1f2937' }}>⚙️ الإعدادات</h2>

            <div style={{
              marginBottom: '25px',
              padding: '20px',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              border: '2px solid #3b82f6'
            }}>
              <label style={{ display: 'block', marginBottom: '15px', fontWeight: '600', color: '#1e40af' }}>
                🔴 عتبة التأخير في الدفع (بالأيام)
              </label>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <input
                  type="range"
                  min="7"
                  max="90"
                  step="1"
                  value={overdueThreshold}
                  onChange={(e) => setOverdueThreshold(parseInt(e.target.value))}
                  style={{
                    flex: 1,
                    height: '8px',
                    accentColor: '#3b82f6'
                  }}
                />
                <div style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  minWidth: '80px',
                  textAlign: 'center'
                }}>
                  {overdueThreshold} يوم
                </div>
              </div>
              <p style={{ marginTop: '10px', fontSize: '12px', color: '#1e40af' }}>
                ℹ️ النقطة الحمراء تظهر عند تجاوز {overdueThreshold} يوم بدون دفع
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  localStorage.setItem('overdueThreshold', overdueThreshold.toString());
                  setShowSettings(false);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                ✅ حفظ
              </button>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                ✕ إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORTS MODAL */}
      {showReports && (
        <div
          style={{
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
          }}
          onClick={() => setShowReports(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '30px',
              width: '600px',
              maxWidth: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '25px', color: '#1f2937' }}>📊 التقارير</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <button
                onClick={() => {
                  printReport('all');
                  setShowReports(false);
                }}
                style={{
                  padding: '20px',
                  backgroundColor: '#dbeafe',
                  border: '2px solid #3b82f6',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'right',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#bfdbfe';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#dbeafe';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#1e40af', fontSize: '16px' }}>
                  📋 جميع العملاء
                </div>
                <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '5px' }}>
                  {customerStats.total} عميل
                </div>
              </button>

              <button
                onClick={() => {
                  printReport('debted');
                  setShowReports(false);
                }}
                style={{
                  padding: '20px',
                  backgroundColor: '#fee2e2',
                  border: '2px solid #ef4444',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'right',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fecaca';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fee2e2';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '16px' }}>
                  💰 العملاء المدينين
                </div>
                <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '5px' }}>
                  {formatCurrency(customerStats.totalDebt)}
                </div>
              </button>

              <button
                onClick={() => {
                  printReport('overdue');
                  setShowReports(false);
                }}
                style={{
                  padding: '20px',
                  backgroundColor: '#fef3c7',
                  border: '2px solid #f59e0b',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'right',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fde68a';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fef3c7';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#d97706', fontSize: '16px' }}>
                  ⚠️ المتأخرين
                </div>
                <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '5px' }}>
                  {customerStats.overdueCount} عميل
                </div>
              </button>

                <button
                  onClick={() => {
                    printReport('behavior');
                    setShowReports(false);
                  }}
                  style={{
                    padding: '15px',
                    backgroundColor: '#fda29b',
                    border: '2px solid #ff6b6b',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fd8c7a';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#fda29b';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: '#ff6b6b', fontSize: '16px' }}>🧠 سلوك الدفع</div>
                  <div style={{ fontSize: '12px', color: '#c92a2a', marginTop: '5px' }}>ملتزم / متوسط / متأخر</div>
                </button>

                <button
                  onClick={() => {
                    printReport('inactive');
                    setShowReports(false);
                  }}
                  style={{
                    padding: '15px',
                    backgroundColor: '#d7d7d7',
                    border: '2px solid #737373',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#c4c4c4';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#d7d7d7';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: '#737373', fontSize: '16px' }}>🎯 العملاء غير النشطين</div>
                  <div style={{ fontSize: '12px', color: '#525252', marginTop: '5px' }}>30+ يوم بلا حركة</div>
                </button>

                <div
                  style={{
                    padding: '15px',
                    backgroundColor: '#f3f4f6',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    textAlign: 'right',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>📈 معلومات سريعة</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                    <div>إجمالي العملاء: {customers.length}</div>
                    <div>إجمالي المديونيات: {customerStats.totalDebt.toFixed(2)}</div>
                    <div style={{ color: '#dc2626' }}>عملاء متأخرين: {customerStats.overdueCount}</div>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowReports(false)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '12px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* CSS ANIMATIONS */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .customer-row:hover {
          background-color: #eff6ff !important;
        }

        .action-btn:hover {
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}
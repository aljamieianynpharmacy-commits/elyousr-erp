import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { safeAlert } from '../utils/safeAlert';
import { safeConfirm } from '../utils/safeConfirm';
import { Plus, Search, Settings } from 'lucide-react';
import CustomerLedger from './CustomerLedger';
import NewCustomerModal from '../components/NewCustomerModal';
import PaymentModal from '../components/PaymentModal';
import { filterPosPaymentMethods } from '../utils/paymentMethodFilters';
import CustomersTable from '../components/customers/CustomersTable';
import CustomersQuickStats from '../components/customers/CustomersQuickStats';
import CustomerImportHandler from '../components/customers/CustomerImportHandler';
import './Customers.css';

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
  const customerImportInputRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [customerLookup, setCustomerLookup] = useState([]);
  const [loadingCustomerLookup, setLoadingCustomerLookup] = useState(false);

  // تحسين سلاسة الإدخال: نؤخر حساب نتائج البحث الثقيلة عن الكتابة الفورية
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 120);
  const deferredSearchTerm = useDeferredValue(debouncedSearchTerm);
  const filteredSearchTerm = useMemo(() => deferredSearchTerm.trim().toLowerCase(), [deferredSearchTerm]);
  const debouncedColumnSearch = useDebouncedValue(columnSearch, 80);
  const normalizedColumnSearch = useMemo(() => (
    Object.fromEntries(
      Object.entries(debouncedColumnSearch || {})
        .map(([key, value]) => [key, String(value ?? '').trim()])
        .filter(([, value]) => value !== '')
    )
  ), [debouncedColumnSearch]);

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

  // Server-side state
  const [paginatedCustomers, setPaginatedCustomers] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [customerStats, setCustomerStats] = useState({
    vipCount: 0,
    debtedCount: 0,
    compliantCount: 0,
    totalDebt: 0,
    overdueCount: 0
  });

  const fetchCustomersAndStats = useCallback(async () => {
    const isFirstLoad = !hasLoadedOnceRef.current;
    try {
      if (isFirstLoad) {
        setInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const params = {
        page: currentPage,
        pageSize: PAGE_SIZE,
        searchTerm: filteredSearchTerm,
        customerType: filterType === 'all' ? null : filterType,
        columnFilters: normalizedColumnSearch,
        sortCol,
        sortDir,
        overdueThreshold
      };

      const [customersRes, statsRes] = await Promise.all([
        window.api.getCustomers(params),
        window.api.getCustomerStats({
          overdueThreshold,
          searchTerm: filteredSearchTerm,
          customerType: filterType === 'all' ? null : filterType,
          columnFilters: normalizedColumnSearch
        })
      ]);

      if (customersRes && !customersRes.error) {
        setPaginatedCustomers(customersRes.data || []);
        setTotalItems(customersRes.total || 0);
        setTotalPages(customersRes.totalPages || 1);
      }

      if (statsRes && !statsRes.error) {
        setCustomerStats(statsRes);
      }

      hasLoadedOnceRef.current = true;
    } catch (err) {
      console.error('💥 [FRONTEND] استثناء في تحميل العملاء:', err);
      safeAlert('خطأ في تحميل بيانات العملاء: ' + err.message);
    } finally {
      if (isFirstLoad) {
        setInitialLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [currentPage, filteredSearchTerm, filterType, sortCol, sortDir, overdueThreshold, normalizedColumnSearch]);

  const loadCustomerLookup = useCallback(async ({ force = false } = {}) => {
    if (loadingCustomerLookup) return customerLookup;
    if (!force && customerLookup.length > 0) return customerLookup;

    setLoadingCustomerLookup(true);
    try {
      const lookupRes = await window.api.getCustomerLookup();
      if (lookupRes?.error) {
        throw new Error(lookupRes.error);
      }

      const rows = Array.isArray(lookupRes)
        ? lookupRes
        : (Array.isArray(lookupRes?.data) ? lookupRes.data : []);
      setCustomerLookup(rows);
      return rows;
    } catch (err) {
      console.error('Failed to load customer lookup:', err);
      safeAlert('خطأ في تحميل قائمة مطابقة العملاء: ' + (err?.message || 'خطأ غير متوقع'));
      return [];
    } finally {
      setLoadingCustomerLookup(false);
    }
  }, [customerLookup, loadingCustomerLookup]);

  const ensureCustomerLookup = useCallback(async () => {
    const rows = await loadCustomerLookup();
    return Array.isArray(rows);
  }, [loadCustomerLookup]);

  const refreshCustomers = useCallback(async ({ reloadLookup = false } = {}) => {
    await fetchCustomersAndStats();
    if (reloadLookup) {
      await loadCustomerLookup({ force: true });
    }
  }, [fetchCustomersAndStats, loadCustomerLookup]);

  const refreshCustomersWithLookup = useCallback(async () => {
    await refreshCustomers({ reloadLookup: true });
  }, [refreshCustomers]);

  useEffect(() => {
    fetchCustomersAndStats();
  }, [fetchCustomersAndStats]);

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

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
      await refreshCustomers({ reloadLookup: true });
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

  const openNewCustomerModal = async () => {
    await ensureCustomerLookup();
    setEditingCustomer(null);
    resetCustomerForm();
    setShowModal(true);
  };

  const downloadCustomerTemplate = () => {
    const templateButton = document.getElementById('hidden-download-template-btn');
    templateButton?.click();
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

  // Callbacks للأزرار - تمنع إعادة إنشاء الدوال في كل render
  const handleShowLedger = useCallback((customerId) => {
    setShowLedger(customerId);
  }, []);

  const handlePaymentCallback = useCallback((customer) => {
    setSelectedCustomer(customer);
    setPaymentData({ amount: '', notes: '', paymentDate: new Date().toISOString().split('T')[0] });
    setShowPaymentModal(true);
  }, []);

  const handleEditCallback = useCallback(async (customer) => {
    await ensureCustomerLookup();
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
  }, [ensureCustomerLookup]);

  const handleDeleteCallback = useCallback(async (id) => {
    const customer = paginatedCustomers.find((row) => row.id === id);
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

      await refreshCustomers({ reloadLookup: true });
      await safeAlert('تم حذف العميل بنجاح', null, { type: 'success', title: 'العملاء' });
    } catch (err) {
      await safeAlert(err?.message || 'تعذر حذف العميل', null, { type: 'error', title: 'تعذر الحذف' });
    }
  }, [paginatedCustomers, refreshCustomers]);

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
    if (paginatedCustomers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex(prev => {
        if (prev < paginatedCustomers.length - 1) {
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
      handlePaymentCallback(paginatedCustomers[selectedSearchIndex]);
    }
  }, [paginatedCustomers, selectedSearchIndex, handlePaymentCallback]);

  // Reset الاختيار عند تغيير البحث
  useEffect(() => {
    setSelectedSearchIndex(-1);
  }, [filteredSearchTerm, filterType, normalizedColumnSearch, currentPage]);

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
            onClick={downloadCustomerTemplate}
            style={{
              backgroundColor: '#1d4ed8',
              color: 'white',
              padding: '10px 14px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            قالب CSV
          </button>
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
        {isRefreshing && (
          <span style={{ fontSize: '12px', color: '#6b7280' }}>Refreshing...</span>
        )}
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

      <CustomerImportHandler
        allCustomers={customerLookup}
        refreshCustomers={refreshCustomersWithLookup}
        inputRef={customerImportInputRef}
      />

      <NewCustomerModal
        isOpen={showModal}
        customer={formData}
        onChange={setFormData}
        onSave={saveCustomer}
        existingCustomers={customerLookup}
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

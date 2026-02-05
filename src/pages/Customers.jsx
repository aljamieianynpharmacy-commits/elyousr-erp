import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { FixedSizeList as List, areEqual } from 'react-window';
import { FileText, DollarSign, Edit2, Trash2, Plus, Search, Settings, Printer } from 'lucide-react';
import CustomerLedger from './CustomerLedger';
import NewCustomerModal from '../components/NewCustomerModal';
import PaymentModal from '../components/PaymentModal';
import './Customers.css';

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
  action_ledger: { width: 36 },
  action_payment: { width: 36 },
  action_edit: { width: 36 },
  action_delete: { width: 36 }
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
    order.push('action_ledger', 'action_payment', 'action_edit', 'action_delete');
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

const normalizeSearchValue = (value) => String(value ?? '').toLowerCase().trim();

const buildSearchIndex = (customer) => (
  [
    customer.id,
    customer.name,
    customer.phone,
    customer.phone2,
    customer.city,
    customer.district,
    customer.address,
    customer.notes,
    customer.customerType
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map(normalizeSearchValue)
    .join(' ')
);

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

const VirtualizedCustomerRow = memo(function VirtualizedCustomerRow({ index, style, data }) {
  const {
    customers,
    visibleColumns,
    selectedIndex,
    overdueThreshold,
    onShowLedger,
    onPayment,
    onEdit,
    onDelete
  } = data;
  const customer = customers[index];

  if (!customer) {
    return null;
  }

  const isSelected = selectedIndex === index;
  const lastPaymentDays = customer.lastPaymentDays || 0;
  const isOverdue = customer.isOverdue !== undefined
    ? customer.isOverdue
    : lastPaymentDays > overdueThreshold;
  const balance = customer.balance || 0;

  const rowClassName = [
    'customers-row',
    index % 2 === 0 ? 'is-even' : 'is-odd',
    isSelected ? 'is-selected' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={rowClassName} style={style} role="row">
      {visibleColumns.id && <div className="customers-cell" role="cell">{customer.id}</div>}
      {visibleColumns.name && (
        <div className="customers-cell customers-name-cell" role="cell">
          <div className="customers-name-content">
            {isOverdue && (
              <span
                className="customers-overdue-dot"
                title={`🔴 لم يدفع منذ ${lastPaymentDays} يوم`}
              />
            )}
            <span>{customer.name}</span>
          </div>
        </div>
      )}
      {visibleColumns.type && (
        <div className="customers-cell" role="cell">
          <span className={`customers-type-badge ${getCustomerTypeClass(customer.customerType)}`}>
            {customer.customerType}
          </span>
        </div>
      )}
      {visibleColumns.phone && <div className="customers-cell customers-muted" role="cell">{customer.phone || '-'}</div>}
      {visibleColumns.phone2 && <div className="customers-cell customers-muted" role="cell">{customer.phone2 || '-'}</div>}
      {visibleColumns.address && <div className="customers-cell customers-muted customers-ellipsis" role="cell">{customer.address || '-'}</div>}
      {visibleColumns.city && <div className="customers-cell customers-muted" role="cell">{customer.city || '-'}</div>}
      {visibleColumns.district && <div className="customers-cell customers-muted" role="cell">{customer.district || '-'}</div>}
      {visibleColumns.notes && <div className="customers-cell customers-muted customers-ellipsis" role="cell">{customer.notes || '-'}</div>}
      {visibleColumns.creditLimit && (
        <div className="customers-cell customers-muted customers-bold" role="cell">
          {(customer.creditLimit || 0).toFixed(2)}
        </div>
      )}
      {visibleColumns.balance && (
        <div className="customers-cell" role="cell">
          <span className={`customers-balance ${getBalanceClass(balance)}`}>
            {balance.toFixed(2)}
          </span>
        </div>
      )}
      {visibleColumns.actions && (
        <div className="customers-cell customers-action-cell" role="cell">
          <button
            onClick={() => onShowLedger(customer.id)}
            title="كشف الحساب"
            className="customers-action-button"
          >
            <FileText size={16} color="#0307c9ff" />
          </button>
        </div>
      )}
      {visibleColumns.actions && (
        <div className="customers-cell customers-action-cell" role="cell">
          <button
            onClick={() => onPayment(customer)}
            title="تسجيل دفعة"
            className="customers-action-button"
          >
            <DollarSign size={16} color="#177400ff" />
          </button>
        </div>
      )}
      {visibleColumns.actions && (
        <div className="customers-cell customers-action-cell" role="cell">
          <button
            onClick={() => onEdit(customer)}
            title="تعديل"
            className="customers-action-button"
          >
            <Edit2 size={16} color="#f78c00ff" />
          </button>
        </div>
      )}
      {visibleColumns.actions && (
        <div className="customers-cell customers-action-cell" role="cell">
          <button
            onClick={() => onDelete(customer.id)}
            title="حذف"
            className="customers-action-button"
          >
            <Trash2 size={16} color="#dc2626" />
          </button>
        </div>
      )}
    </div>
  );
}, areEqual);

const CustomersTable = memo(function CustomersTable({
  customers,
  visibleColumns,
  showSearchRow,
  columnSearch,
  onColumnSearchChange,
  selectedIndex,
  overdueThreshold,
  onShowLedger,
  onPayment,
  onEdit,
  onDelete,
  listRef
}) {
  const columnOrder = useMemo(() => getVisibleColumnOrder(visibleColumns), [visibleColumns]);

  const gridTemplateColumns = useMemo(() => {
    if (columnOrder.length === 0) {
      return '1fr';
    }
    return columnOrder.map((key) => {
      const spec = COLUMN_SPECS[key] || {};
      if (spec.width) return `${spec.width}px`;
      const minWidth = spec.minWidth || 120;
      return `minmax(${minWidth}px, 1fr)`;
    }).join(' ');
  }, [columnOrder]);

  const tableMinWidth = useMemo(() => {
    if (columnOrder.length === 0) return 300;
    return columnOrder.reduce((sum, key) => {
      const spec = COLUMN_SPECS[key] || {};
      return sum + (spec.width || spec.minWidth || 120);
    }, 0);
  }, [columnOrder]);

  const listHeight = useMemo(() => {
    if (customers.length === 0) return ROW_HEIGHT * 2;
    return Math.min(MAX_LIST_HEIGHT, Math.max(ROW_HEIGHT, customers.length * ROW_HEIGHT));
  }, [customers.length]);

  const itemData = useMemo(() => ({
    customers,
    visibleColumns,
    selectedIndex,
    overdueThreshold,
    onShowLedger,
    onPayment,
    onEdit,
    onDelete
  }), [customers, visibleColumns, selectedIndex, overdueThreshold, onShowLedger, onPayment, onEdit, onDelete]);

  return (
    <div className="customers-table-scroll">
      <div className="customers-table" style={{ '--customers-grid': gridTemplateColumns, minWidth: tableMinWidth }}>
        <div className="customers-table-header" role="row">
          {visibleColumns.id && <div className="customers-header-cell" role="columnheader">#</div>}
          {visibleColumns.name && <div className="customers-header-cell" role="columnheader">الاسم</div>}
          {visibleColumns.type && <div className="customers-header-cell" role="columnheader">النوع</div>}
          {visibleColumns.phone && <div className="customers-header-cell" role="columnheader">الهاتف</div>}
          {visibleColumns.phone2 && <div className="customers-header-cell" role="columnheader">الهاتف 2</div>}
          {visibleColumns.address && <div className="customers-header-cell" role="columnheader">العنوان</div>}
          {visibleColumns.city && <div className="customers-header-cell" role="columnheader">المدينة</div>}
          {visibleColumns.district && <div className="customers-header-cell" role="columnheader">المنطقة</div>}
          {visibleColumns.notes && <div className="customers-header-cell" role="columnheader">الملاحظات</div>}
          {visibleColumns.creditLimit && <div className="customers-header-cell" role="columnheader">الحد الائتماني</div>}
          {visibleColumns.balance && <div className="customers-header-cell" role="columnheader">الرصيد</div>}
          {visibleColumns.actions && <div className="customers-header-cell customers-action-cell" role="columnheader">عرض</div>}
          {visibleColumns.actions && <div className="customers-header-cell customers-action-cell" role="columnheader">دفع</div>}
          {visibleColumns.actions && <div className="customers-header-cell customers-action-cell" role="columnheader">تعديل</div>}
          {visibleColumns.actions && <div className="customers-header-cell customers-action-cell" role="columnheader">حذف</div>}
        </div>

        {showSearchRow && (
          <div className="customers-table-search" role="row">
            {visibleColumns.id && (
              <div className="customers-search-cell">
                <input
                  className="customers-search-input"
                  placeholder="بحث..."
                  value={columnSearch.id || ''}
                  onChange={(e) => onColumnSearchChange('id', e.target.value)}
                />
              </div>
            )}
            {visibleColumns.name && (
              <div className="customers-search-cell">
                <input
                  className="customers-search-input"
                  placeholder="بحث..."
                  value={columnSearch.name || ''}
                  onChange={(e) => onColumnSearchChange('name', e.target.value)}
                />
              </div>
            )}
            {visibleColumns.type && (
              <div className="customers-search-cell">
                <input
                  className="customers-search-input"
                  placeholder="بحث..."
                  value={columnSearch.type || ''}
                  onChange={(e) => onColumnSearchChange('type', e.target.value)}
                />
              </div>
            )}
            {visibleColumns.phone && (
              <div className="customers-search-cell">
                <input
                  className="customers-search-input"
                  placeholder="بحث..."
                  value={columnSearch.phone || ''}
                  onChange={(e) => onColumnSearchChange('phone', e.target.value)}
                />
              </div>
            )}
            {visibleColumns.phone2 && (
              <div className="customers-search-cell">
                <input
                  className="customers-search-input"
                  placeholder="بحث..."
                  value={columnSearch.phone2 || ''}
                  onChange={(e) => onColumnSearchChange('phone2', e.target.value)}
                />
              </div>
            )}
            {visibleColumns.address && (
              <div className="customers-search-cell">
                <input
                  className="customers-search-input"
                  placeholder="بحث..."
                  value={columnSearch.address || ''}
                  onChange={(e) => onColumnSearchChange('address', e.target.value)}
                />
              </div>
            )}
            {visibleColumns.city && (
              <div className="customers-search-cell">
                <input
                  className="customers-search-input"
                  placeholder="بحث..."
                  value={columnSearch.city || ''}
                  onChange={(e) => onColumnSearchChange('city', e.target.value)}
                />
              </div>
            )}
            {visibleColumns.district && (
              <div className="customers-search-cell">
                <input
                  className="customers-search-input"
                  placeholder="بحث..."
                  value={columnSearch.district || ''}
                  onChange={(e) => onColumnSearchChange('district', e.target.value)}
                />
              </div>
            )}
            {visibleColumns.notes && (
              <div className="customers-search-cell">
                <input
                  className="customers-search-input"
                  placeholder="بحث..."
                  value={columnSearch.notes || ''}
                  onChange={(e) => onColumnSearchChange('notes', e.target.value)}
                />
              </div>
            )}
            {visibleColumns.creditLimit && (
              <div className="customers-search-cell">
                <input
                  className="customers-search-input"
                  placeholder="بحث..."
                  value={columnSearch.creditLimit || ''}
                  onChange={(e) => onColumnSearchChange('creditLimit', e.target.value)}
                />
              </div>
            )}
            {visibleColumns.balance && (
              <div className="customers-search-cell">
                <input
                  className="customers-search-input"
                  placeholder="بحث..."
                  value={columnSearch.balance || ''}
                  onChange={(e) => onColumnSearchChange('balance', e.target.value)}
                />
              </div>
            )}
            {visibleColumns.actions && <div className="customers-search-cell" />}
            {visibleColumns.actions && <div className="customers-search-cell" />}
            {visibleColumns.actions && <div className="customers-search-cell" />}
            {visibleColumns.actions && <div className="customers-search-cell" />}
          </div>
        )}

        {customers.length === 0 ? (
          <div className="customers-empty">لا توجد عملاء مطابقة للبحث</div>
        ) : (
          <List
            ref={listRef}
            className="customers-list"
            direction="rtl"
            height={listHeight}
            itemCount={customers.length}
            itemSize={ROW_HEIGHT}
            width="100%"
            itemData={itemData}
            overscanCount={6}
            itemKey={(index, data) => data.customers[index]?.id ?? index}
          >
            {VirtualizedCustomerRow}
          </List>
        )}
      </div>
    </div>
  );
});

const CustomersQuickStats = memo(function CustomersQuickStats({
  totalCount,
  vipCount,
  overdueCount,
  overdueThreshold,
  filteredCount
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
      <div style={{ padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '8px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>إجمالي العملاء</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>{totalCount}</div>
      </div>
      <div style={{ padding: '15px', backgroundColor: '#fffbeb', borderRadius: '8px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>عملاء VIP</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>
          {vipCount}
        </div>
      </div>
      <div style={{ padding: '15px', backgroundColor: '#fef2f2', borderRadius: '8px', textAlign: 'center', border: '1px solid #fee2e2' }}>
        <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '5px' }}>🔴 عملاء متأخرين</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc2626' }}>
          {overdueCount}
        </div>
        <div style={{ fontSize: '10px', color: '#ef4444' }}>مضى {overdueThreshold} يوم</div>
      </div>
      <div style={{ padding: '15px', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>نتائج البحث</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#374151' }}>{filteredCount}</div>
      </div>
    </div>
  );
});

export default function Customers() {
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLedger, setShowLedger] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, VIP, عادي, تاجر جملة
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const paymentInputRef = useRef(null);
  const listRef = useRef(null);
  const [showReports, setShowReports] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState('debts');
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
  const [showSettings, setShowSettings] = useState(false);
  const [overdueThreshold, setOverdueThreshold] = useState(() => {
    const saved = localStorage.getItem('overdueThreshold');
    return saved ? parseInt(saved) : 30;
  });
  const [tempThreshold, setTempThreshold] = useState(overdueThreshold);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [columnSearch, setColumnSearch] = useState({});
  const [showSearchRow, setShowSearchRow] = useState(false);
  const debouncedSearch = useDebouncedValue(searchTerm.trim(), 250);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType]);

  // State لتخزين كل العملاء (للبحث المحلي)
  const [allCustomers, setAllCustomers] = useState([]);

  const loadAllCustomers = useCallback(async () => {
    try {
      setLoading(true);

      const result = await window.api.getCustomers({
        page: 1,
        pageSize: 1000, // تحميل كل العملاء دفعة واحدة
        searchTerm: '',
        customerType: 'all',
        overdueThreshold: overdueThreshold // تمرير حد التأخير للإعدادات
      });

      if (!result.error) {
        setAllCustomers(result.data || []);
      } else {
        console.error('❌ [BACKEND] خطأ في تحميل العملاء: ' + result.error);
      }
    } catch (err) {
      console.error('💥 [FRONTEND] استثناء في تحميل العملاء:', err);
    } finally {
      setLoading(false);
    }
  }, [overdueThreshold]);

  useEffect(() => {
    loadAllCustomers();
  }, [loadAllCustomers]);

  const indexedCustomers = useMemo(() => (
    allCustomers.map((customer) => ({
      ...customer,
      _search: buildSearchIndex(customer)
    }))
  ), [allCustomers]);

  const normalizedSearch = useMemo(() => normalizeSearchValue(debouncedSearch), [debouncedSearch]);

  const activeColumnFilters = useMemo(() => (
    Object.entries(columnSearch)
      .filter(([, value]) => value && value.trim() !== '')
      .map(([key, value]) => [key, normalizeSearchValue(value)])
  ), [columnSearch]);

  const filteredCustomers = useMemo(() => {
    let filtered = indexedCustomers;

    if (normalizedSearch.length > 0) {
      filtered = filtered.filter((customer) => customer._search.includes(normalizedSearch));
    }

    if (activeColumnFilters.length > 0) {
      filtered = filtered.filter((customer) => (
        activeColumnFilters.every(([key, value]) => {
          if (!value) return true;
          let itemValue = '';

          if (key === 'type') itemValue = customer.customerType || '';
          else if (key === 'balance') itemValue = customer.balance || 0;
          else if (key === 'creditLimit') itemValue = customer.creditLimit || 0;
          else itemValue = customer[key] || '';

          return normalizeSearchValue(itemValue).includes(value);
        })
      ));
    }

    if (filterType && filterType !== 'all') {
      filtered = filtered.filter((customer) => customer.customerType === filterType);
    }

    return filtered;
  }, [indexedCustomers, normalizedSearch, filterType, activeColumnFilters]);

  const totalItems = filteredCustomers.length;
  const totalPages = 1;

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
          alert(result.error);
          return;
        }
        
        setAllCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, ...formData } : c));
      } else {
        const result = await window.api.addCustomer(formData);

        if (result.error) {
          console.error('Error adding customer:', result.error);
          alert(result.error);
          return;
        }
        
        const newCustomer = { id: result.id || Date.now(), ...formData };
        setAllCustomers(prev => [...prev, newCustomer]);
      }
      
      setShowModal(false);
      resetCustomerForm();
      setEditingCustomer(null);
    } catch (err) {
      console.error('Exception saving customer:', err);
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
    if (!confirm('هل أنت متأكد من الحذف؟')) return;

    try {
      const result = await window.api.deleteCustomer(id);

      if (result.error) {
        console.error('Error deleting customer:', result.error);
        alert('خطأ في الحذف');
      } else {
        setAllCustomers(prev => prev.filter(c => c.id !== id));
        alert('تم الحذف بنجاح');
      }
    } catch (err) {
      console.error('Exception deleting customer:', err);
      alert('خطأ في الحذف');
    }
  };

  const handlePayment = (customer) => {
    setSelectedCustomer(customer);
    setPaymentData({ amount: '', notes: '', paymentDate: new Date().toISOString().split('T')[0] });
    setShowPaymentModal(true);
  };

  const submitPayment = async (paymentFormData) => {
    const paymentAmount = parseFloat(paymentFormData.amount);
    
    if (isNaN(paymentAmount) || paymentAmount === 0) {
      alert('الرجاء إدخال مبلغ صالح (غير صفر)');
      return;
    }

    const previewNewBalance = (selectedCustomer.balance - paymentAmount).toFixed(2);
    const paymentDate = new Date(paymentFormData.paymentDate);
    const confirmText = `سوف تُسجّل دفعة بقيمة ${formatCurrency(paymentAmount)} بتاريخ ${paymentDate.toLocaleDateString('ar-EG')}\nالرصيد بعد التسجيل: ${previewNewBalance}\n\nهل تريد المتابعة؟`;
    
    if (!window.confirm(confirmText)) return;

    setPaymentSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomer.id,
        amount: paymentAmount,
        notes: paymentFormData.notes || '',
        paymentDate: paymentFormData.paymentDate
      };

      const result = await window.api.addCustomerPayment(payload);

      if (!result.error) {
        const newBalance = (selectedCustomer.balance || 0) - paymentAmount;
        
        setAllCustomers(prev => prev.map(c =>
          c.id === selectedCustomer.id ? { ...c, balance: newBalance } : c
        ));

        setPaymentData({ amount: '', notes: '', paymentDate: new Date().toISOString().split('T')[0] });
      } else {
        console.error('Error submitting payment:', result.error);
      }

      return result;
    } catch (err) {
      console.error('Exception submitting payment:', err);
      alert('خطأ في التسجيل: ' + err.message);
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

  const overduePreviewCount = useMemo(
    () => allCustomers.filter(c => (c.lastPaymentDays || 0) > tempThreshold).length,
    [allCustomers, tempThreshold]
  );

  // Auto-focus على مربع الدفع عند فتح الموديل
  useEffect(() => {
    if (showPaymentModal && paymentInputRef.current) {
      setTimeout(() => paymentInputRef.current?.focus(), 0);
    }
  }, [showPaymentModal]);

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
    console.log('🗑️ [FRONTEND] طلب حذف العميل رقم:', id);

    if (confirm('هل أنت متأكد من الحذف؟')) {
      try {
        console.log('⚠️ [FRONTEND] المستخدم أكد الحذف - جاري التنفيذ');
        const result = await window.api.deleteCustomer(id);
        console.log('📦 [BACKEND] نتيجة الحذف:', result);

        if (result.error) {
          console.error('Error deleting customer:', result.error);
          alert('خطأ في الحذف');
        } else {
          setAllCustomers(prev => prev.filter(c => c.id !== id));
          alert('تم الحذف بنجاح');
        }
      } catch (err) {
        console.error('Exception deleting customer:', err);
        alert('خطأ في الحذف');
      }
    }
  }, []);

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
  }, [searchTerm, filterType, debouncedSearch, columnSearch]);

  useEffect(() => {
    if (selectedSearchIndex >= 0 && listRef.current) {
      listRef.current.scrollToItem(selectedSearchIndex, 'smart');
    }
  }, [selectedSearchIndex]);

  // دوال التقارير
  const generateDebtsReport = () => {
    const debtedCustomers = filteredCustomers.filter(c => c.balance > 0);
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
      const typeCustomers = filteredCustomers.filter(c => c.customerType === type);
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
      subtitle: `إجمالي العملاء: ${filteredCustomers.length}`,
      summary: `تحليل حسب نوع العميل`,
      data: reportData,
      columns: ['النوع', 'عدد العملاء', 'إجمالي المديونيات', 'متوسط المديونية'],
      totals: `إجمالي العملاء: ${filteredCustomers.length}`
    };
  };

  const generateCitiesReport = () => {
    const citiesMap = {};
    filteredCustomers.forEach(c => {
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
    if (filteredCustomers.length === 0) return null;

    const totalDebt = filteredCustomers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
    const totalCredit = filteredCustomers.reduce((sum, c) => sum + Math.min(0, -c.balance), 0);

    const reportData = filteredCustomers.map((c, idx) => ({
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
      subtitle: `عدد العملاء: ${filteredCustomers.length}`,
      summary: `البحث: "${searchTerm}" | النوع: ${filterType === 'all' ? 'الكل' : filterType}`,
      data: reportData,
      columns: ['#', 'الاسم', 'النوع', 'الهاتف', 'المدينة', 'الرصيد', 'الحد الائتماني'],
      totals: `إجمالي المديونيات: ${totalDebt.toFixed(2)} | الأرصدة الدائنة: ${totalCredit.toFixed(2)}`
    };
  };

  const generateTopDebtorsReport = () => {
    const topDebtors = filteredCustomers
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
    const debtedCustomers = filteredCustomers.filter(c => c.balance > 0);

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
    const goodPayers = filteredCustomers.filter(c => c.balance <= 0);
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
      const baseDebt = filteredCustomers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
      const monthlyDebt = Math.max(0, baseDebt + variation);

      monthlyData.push({
        month: monthName,
        debt: monthlyDebt.toFixed(2),
        change: i === 0 ? 0 : ((variation / baseDebt) * 100).toFixed(1),
        trend: variation >= 0 ? '↑' : '↓'
      });
    }

    const currentTotal = filteredCustomers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
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

    filteredCustomers.forEach(customer => {
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
    const behaviorData = filteredCustomers.map(customer => {
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
    const inactiveData = filteredCustomers.map(customer => {
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
        currentBalance: (customer.balance || 0).toFixed(2)
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
      case 'debts':
        report = generateDebtsReport();
        break;
      case 'types':
        report = generateCustomerTypesReport();
        break;
      case 'cities':
        report = generateCitiesReport();
        break;
      case 'selected':
        report = generateSelectedCustomersReport();
        if (!report) {
          alert('لا توجد عملاء مطابقة للبحث');
          return;
        }
        break;
      case 'topDebtors':
        report = generateTopDebtorsReport();
        break;
      case 'aging':
        report = generateDebtAgingReport();
        break;
      case 'goodPayers':
        report = generateGoodPayersReport();
        break;
      case 'trend':
        report = generateTrendReport();
        break;
      case 'movements':
        report = generatePaymentMovementsReport();
        break;
      case 'behavior':
        report = generatePaymentBehaviorReport();
        break;
      case 'inactive':
        report = generateInactiveCustomersReport();
        break;
      default:
        return;
    }

    const printWindow = window.open('', '', 'height=600,width=900');

    let tableRows = '';

    if (report.isAging) {
      // تنسيق خاص لتقرير أعمار الديون
      tableRows = report.data.map((row, idx) => {
        if (row.type === 'header') {
          return `<tr style="background-color: #3b82f6; color: white; font-weight: bold;">
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${row.range} يوم</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${row.count}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${row.subtotal}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${row.percentage}%</td>
          </tr>`;
        } else {
          return `<tr>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"></td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${row.name}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${row.debt}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${row.age}</td>
          </tr>`;
        }
      }).join('');
    } else {
      // تنسيق عادي للتقارير الأخرى
      tableRows = report.data.map((row, idx) => {
        const cells = report.columns.map(col => {
          let key = col;
          if (col === '#') key = 'id';
          else if (col === 'الترتيب') key = 'rank';
          else if (col === 'الاسم') key = 'name';
          else if (col === 'النوع') key = 'type';
          else if (col === 'الهاتف') key = 'phone';
          else if (col === 'الهاتف 2') key = 'phone2';
          else if (col === 'المدينة') key = 'city';
          else if (col === 'المبلغ المدين') key = 'debt';
          else if (col === 'النسبة') key = 'percentage';
          else if (col === 'الرصيد') key = 'balance';
          else if (col === 'الحد الائتماني') key = 'creditLimit';

          const value = row[key] !== undefined ? row[key] : row[col.toLowerCase()] || '-';
          return `<td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${value}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
    }

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${report.title}</title>
        <style>
          body { font-family: 'Arial', sans-serif; margin: 20px; background: white; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; }
          .header h1 { margin: 0; font-size: 26px; color: #1f2937; font-weight: bold; }
          .header p { margin: 5px 0; color: #6b7280; }
          .summary { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 15px; margin-bottom: 20px; border-radius: 8px; border-right: 4px solid #3b82f6; }
          .summary strong { color: #1e40af; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          th { background: #374151; color: white; padding: 12px; text-align: right; font-weight: bold; font-size: 13px; }
          td { padding: 10px; border: 1px solid #e5e7eb; text-align: right; }
          tr:nth-child(even) { background: #f9fafb; }
          tr:hover { background: #eff6ff; }
          .footer { margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 15px; }
          .totals { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); font-weight: bold; padding: 15px; margin-top: 20px; border-radius: 8px; border-right: 4px solid #10b981; font-size: 14px; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
          .stat-box { padding: 15px; background: #f3f4f6; border-radius: 8px; text-align: center; border: 1px solid #d1d5db; }
          .stat-box strong { display: block; font-size: 18px; color: #1f2937; margin-top: 5px; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 ${report.title}</h1>
          <p>${report.subtitle}</p>
          <p style="font-size: 12px; color: #9ca3af;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')} | الوقت: ${new Date().toLocaleTimeString('ar-EG')}</p>
        </div>
        
        <div class="summary">
          <strong>ملخص:</strong> ${report.summary}
        </div>

        ${report.bucketSummary ? `
        <div class="stats">
          <div class="stat-box">
            <span>0-30 يوم</span>
            <strong>${report.bucketSummary['0-30'].count}</strong>
            <p style="font-size: 12px; color: #6b7280; margin: 5px 0;">${report.bucketSummary['0-30'].total.toFixed(2)}</p>
          </div>
          <div class="stat-box">
            <span>31-60 يوم</span>
            <strong>${report.bucketSummary['31-60'].count}</strong>
            <p style="font-size: 12px; color: #6b7280; margin: 5px 0;">${report.bucketSummary['31-60'].total.toFixed(2)}</p>
          </div>
          <div class="stat-box">
            <span>61-90 يوم</span>
            <strong>${report.bucketSummary['61-90'].count}</strong>
            <p style="font-size: 12px; color: #6b7280; margin: 5px 0;">${report.bucketSummary['61-90'].total.toFixed(2)}</p>
          </div>
          <div class="stat-box">
            <span>+90 يوم</span>
            <strong>${report.bucketSummary['+90'].count}</strong>
            <p style="font-size: 12px; color: #6b7280; margin: 5px 0;">${report.bucketSummary['+90'].total.toFixed(2)}</p>
          </div>
        </div>
        ` : ''}

        <table>
          <thead>
            <tr>
              ${report.columns.map(col => `<th>${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="totals">
          ${report.totals}
        </div>

        <div class="footer">
          <p>🔐 تقرير سري - نظام إدارة ERP الحديث</p>
          <p style="margin-top: 10px;">تم الإنشاء بواسطة: نظام العملاء | ${new Date().toLocaleString('ar-EG')}</p>
          <button class="no-print" onclick="window.print()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 20px; font-size: 14px; font-weight: bold;">🖨️ طباعة</button>
          <button class="no-print" onclick="window.close()" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 20px; margin-right: 10px; font-size: 14px;">✕ إغلاق</button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>👥 إدارة العملاء</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowReports(true)}
            style={{
              backgroundColor: '#8b5cf6',
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
            <Printer size={18} />
            التقارير والطباعة
          </button>
          <button
            onClick={openSettings}
            style={{
              backgroundColor: '#6366f1',
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
            <Settings size={18} />
            الإعدادات
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
        gridTemplateColumns: '1fr 1fr auto',
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
        totalCount={allCustomers.length}
        vipCount={customerStats.vipCount}
        overdueCount={customerStats.overdueCount}
        overdueThreshold={overdueThreshold}
        filteredCount={filteredCustomers.length}
      />

      <div className="card customers-table-card">
        <CustomersTable
          customers={filteredCustomers}
          visibleColumns={visibleColumns}
          showSearchRow={showSearchRow}
          columnSearch={columnSearch}
          onColumnSearchChange={handleColumnSearchChange}
          selectedIndex={selectedSearchIndex}
          overdueThreshold={overdueThreshold}
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
              // لا نحتاج loadAllCustomers() هنا بعد الآن
            }}
            onDataChanged={() => {
              // يتم استدعاؤها فقط عند حذف أو تعديل معاملات
              loadAllCustomers();
            }}
          />
        )
      }

      {/* Reports Modal */}
      {
        showReports && (
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
              zIndex: 1300
            }}
            onClick={() => setShowReports(false)}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '30px',
                width: '500px',
                maxHeight: '80vh',
                overflow: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginBottom: '30px', color: '#1f2937' }}>📊 التقارير والطباعة</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <button
                  onClick={() => {
                    printReport('debts');
                    setShowReports(false);
                  }}
                  className="report-card report-debts"
                >
                  <div className="report-title">💳 تقرير المديونيات</div>
                  <div className="report-subtitle">عملاء مدينين بفترات</div>
                </button>

                <button
                  onClick={() => {
                    printReport('topDebtors');
                    setShowReports(false);
                  }}
                  className="report-card report-top-debtors"
                >
                  <div className="report-title">🏆 أكبر المدينين</div>
                  <div className="report-subtitle">أكبر 20 عميل مدين</div>
                </button>

                <button
                  onClick={() => {
                    printReport('types');
                    setShowReports(false);
                  }}
                  className="report-card report-types"
                >
                  <div className="report-title">📋 تصنيف العملاء</div>
                  <div className="report-subtitle">عادي / VIP / جملة</div>
                </button>

                <button
                  onClick={() => {
                    printReport('cities');
                    setShowReports(false);
                  }}
                  className="report-card report-cities"
                >
                  <div className="report-title">🗺️ التوزيع الجغرافي</div>
                  <div className="report-subtitle">العملاء حسب المدينة</div>
                </button>

                <button
                  onClick={() => {
                    printReport('selected');
                    setShowReports(false);
                  }}
                  className="report-card report-selected"
                >
                  <div className="report-title">🔍 التقرير المخصص</div>
                  <div className="report-subtitle">بناءً على البحث الحالي</div>
                </button>

                <button
                  onClick={() => {
                    printReport('aging');
                    setShowReports(false);
                  }}
                  className="report-card report-aging"
                >
                  <div className="report-title">⏳ أعمار الديون</div>
                  <div className="report-subtitle">0-30 / 31-60 / +90 يوم</div>
                </button>

                <button
                  onClick={() => {
                    printReport('goodPayers');
                    setShowReports(false);
                  }}
                  className="report-card report-good-payers"
                >
                  <div className="report-title">💸 العملاء الملتزمون</div>
                  <div className="report-subtitle">صفر دين أو دفعات مقدمة</div>
                </button>

                <button
                  onClick={() => {
                    printReport('trend');
                    setShowReports(false);
                  }}
                  className="report-card report-trend"
                >
                  <div className="report-title">📈 تطور المديونية</div>
                  <div className="report-subtitle">12 شهر الأخيرة</div>
                </button>

                <button
                  onClick={() => {
                    printReport('movements');
                    setShowReports(false);
                  }}
                  className="report-card report-movements"
                >
                  <div className="report-title">🧾 الحركات المالية</div>
                  <div className="report-subtitle">فواتير و دفعات</div>
                </button>

                <button
                  onClick={() => {
                    printReport('behavior');
                    setShowReports(false);
                  }}
                  className="report-card report-behavior"
                >
                  <div className="report-title">🧠 سلوك الدفع</div>
                  <div className="report-subtitle">ملتزم / متوسط / متأخر</div>
                </button>

                <button
                  onClick={() => {
                    printReport('inactive');
                    setShowReports(false);
                  }}
                  className="report-card report-inactive"
                >
                  <div className="report-title">🎯 العملاء غير النشطين</div>
                  <div className="report-subtitle">30+ يوم بلا حركة</div>
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
                    <div>إجمالي العملاء: {filteredCustomers.length}</div>
                    <div>إجمالي المديونيات: {customerStats.totalDebt.toFixed(2)}</div>
                    <div style={{ color: '#dc2626' }}>عملاء متأخرين: {customerStats.overdueCount}</div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowReports(false)}
                style={{
                  width: '100%',
                  marginTop: '20px',
                  padding: '10px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        )
      }

      {/* Settings Modal */}
      {
        showSettings && (
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
              zIndex: 1400
            }}
            onClick={() => setShowSettings(false)}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '30px',
                width: '500px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginBottom: '30px', color: '#1f2937' }}>⚙️ الإعدادات</h2>

              <div style={{ marginBottom: '30px', borderRadius: '8px', backgroundColor: '#f0f9ff', padding: '20px', border: '2px solid #3b82f6' }}>
                <label style={{ display: 'block', marginBottom: '15px', fontWeight: 'bold', color: '#1e40af' }}>
                  🔴 عدد أيام عدم الدفع (حتى تظهر النقطة الحمراء)
                </label>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <input
                    type="range"
                    min="7"
                    max="90"
                    step="1"
                    value={tempThreshold}
                    onChange={(e) => setTempThreshold(parseInt(e.target.value))}
                    style={{
                      flex: 1,
                      height: '8px',
                      borderRadius: '5px',
                      outline: 'none',
                      accentColor: '#3b82f6'
                    }}
                  />
                  <div
                    style={{
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      minWidth: '80px',
                      textAlign: 'center'
                    }}
                  >
                    {tempThreshold} يوم
                  </div>
                </div>
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#1e40af' }}>
                  ℹ️ النقطة الحمراء ستظهر عندما يمر {tempThreshold} يوم بدون دفع أو فاتورة
                </div>
              </div>

              <div style={{ marginBottom: '20px', backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#374151' }}>📊 معلومات سريعة:</h3>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  <div>• إجمالي العملاء: <strong>{allCustomers.length}</strong></div>
                  <div style={{ marginTop: '8px' }}>• عملاء مدينين: <strong>{customerStats.debtedCount}</strong></div>
                  <div style={{ marginTop: '8px', color: '#dc2626', fontWeight: 'bold' }}>
                    • عملاء متأخرين الآن: <strong>{overduePreviewCount}</strong>
                  </div>
                  <div style={{ marginTop: '8px' }}>• عملاء ملتزمين: <strong>{customerStats.compliantCount}</strong></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    localStorage.setItem('overdueThreshold', tempThreshold.toString());
                    setOverdueThreshold(tempThreshold);
                    setShowSettings(false);
                    loadAllCustomers(); // إعادة تحميل بشبكة الأيام الجديدة
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  ✅ حفظ الإعدادات
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  ✕ إلغاء
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

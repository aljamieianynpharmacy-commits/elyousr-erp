import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue, memo } from 'react';
import { safeAlert } from '../utils/safeAlert';
import { safeConfirm } from '../utils/safeConfirm';
import { FixedSizeList as List, areEqual } from 'react-window';
import { Plus, Search, Settings } from 'lucide-react';
import CustomerLedger from './CustomerLedger';
import NewCustomerModal from '../components/NewCustomerModal';
import PaymentModal from '../components/PaymentModal';
import { filterPosPaymentMethods } from '../utils/paymentMethodFilters';
import {
  CUSTOMER_IMPORT_FIELD_OPTIONS,
  delimiter as detectImportDelimiter,
  parseLine as parseImportLine,
  toImportHeaders as toCustomerImportHeaders,
  buildCustomerImportAutoMapping,
  mapRowsWithCustomerImportMapping,
  sanitizeImportedCustomer
} from '../utils/customerImportUtils';
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

const VirtualizedCustomerRow = memo(function VirtualizedCustomerRow({ index, style, data }) {
  const {
    customers,
    visibleColumns,
    selectedIndex,
    overdueThreshold,
    highlightTerm,
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
            <span>{highlightMatch(customer.name, highlightTerm)}</span>
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
          <div className="customers-actions-group">
            <button
              type="button"
              onClick={() => onShowLedger(customer.id)}
              title={'\u0639\u0631\u0636 \u0643\u0634\u0641 \u0627\u0644\u062D\u0633\u0627\u0628'}
              className="customers-action-button customers-action-view"
            >
              {'\u{1F441}\uFE0F'}
            </button>
            <button
              type="button"
              onClick={() => onPayment(customer)}
              title={'\u062A\u0633\u062C\u064A\u0644 \u062F\u0641\u0639\u0629'}
              className="customers-action-button customers-action-payment"
            >
              {'\u{1F4B5}'}
            </button>
            <button
              type="button"
              onClick={() => onEdit(customer)}
              title={'\u062A\u0639\u062F\u064A\u0644'}
              className="customers-action-button customers-action-edit"
            >
              {'\u270F\uFE0F'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(customer.id)}
              title={'\u062D\u0630\u0641'}
              className="customers-action-button customers-action-delete"
            >
              {'\u{1F5D1}\uFE0F'}
            </button>
          </div>
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
  highlightTerm,
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
    highlightTerm,
    onShowLedger,
    onPayment,
    onEdit,
    onDelete
  }), [customers, visibleColumns, selectedIndex, overdueThreshold, highlightTerm, onShowLedger, onPayment, onEdit, onDelete]);

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
          {visibleColumns.actions && <div className="customers-header-cell customers-action-cell" role="columnheader">{'\u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A'}</div>}
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

  const customerImportInputRef = useRef(null);
  const [customerImportSession, setCustomerImportSession] = useState(null);
  const [importingCustomers, setImportingCustomers] = useState(false);
  const [updateExistingOnImport, setUpdateExistingOnImport] = useState(true);

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

  const customerImportColumnSamples = useMemo(() => {
    const sampleMap = new Map();
    if (!customerImportSession?.headers?.length || !customerImportSession?.rows?.length) return sampleMap;

    const previewRows = customerImportSession.rows.slice(0, 120);
    customerImportSession.headers.forEach((header) => {
      for (const row of previewRows) {
        const value = String(row?.[header.index] ?? '').trim();
        if (value) {
          sampleMap.set(header.id, value.slice(0, 120));
          break;
        }
      }
    });

    return sampleMap;
  }, [customerImportSession]);

  const closeCustomerImportSession = useCallback(() => {
    if (importingCustomers) return;
    setCustomerImportSession(null);
  }, [importingCustomers]);

  const updateCustomerImportFieldMapping = useCallback((fieldKey, columnId) => {
    setCustomerImportSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        mapping: {
          ...prev.mapping,
          [fieldKey]: columnId
        }
      };
    });
  }, []);

  const applyCustomerImportAutoMapping = useCallback(() => {
    setCustomerImportSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        mapping: buildCustomerImportAutoMapping(prev.headers)
      };
    });
  }, []);

  const parseDelimitedCustomerRows = useCallback((rawText) => {
    const lines = String(rawText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) throw new Error('الملف لا يحتوي على بيانات كافية');

    const delim = detectImportDelimiter(lines[0]);
    const headers = toCustomerImportHeaders(parseImportLine(lines[0], delim));
    const rows = lines
      .slice(1)
      .map((line) => parseImportLine(line, delim))
      .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));

    if (!headers.length) throw new Error('تعذر قراءة الأعمدة من الملف');
    if (!rows.length) throw new Error('الملف لا يحتوي على صفوف بيانات');

    return { headers, rows };
  }, []);

  const parseWorkbookCustomerRows = useCallback(async (file) => {
    const xlsxModule = await import('xlsx');
    const XLSX = xlsxModule?.default || xlsxModule;

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: false
    });

    const firstSheetName = workbook?.SheetNames?.[0];
    if (!firstSheetName) throw new Error('ملف Excel لا يحتوي على أي ورقة بيانات');

    const sheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false
    });

    const rows = Array.isArray(matrix) ? matrix : [];
    const hasAnyValue = (row) => (
      Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== '')
    );
    const firstNonEmptyIndex = rows.findIndex(hasAnyValue);

    if (firstNonEmptyIndex === -1) throw new Error('ورقة Excel فارغة');

    const headerRow = rows[firstNonEmptyIndex] || [];
    const dataRows = rows
      .slice(firstNonEmptyIndex + 1)
      .map((row) => (Array.isArray(row) ? row : []))
      .filter(hasAnyValue);

    const headers = toCustomerImportHeaders(headerRow);
    if (!headers.length) throw new Error('تعذر قراءة أعمدة ملف Excel');
    if (!dataRows.length) throw new Error('ورقة Excel لا تحتوي على بيانات');

    return { headers, rows: dataRows, sheetName: firstSheetName };
  }, []);

  const importCustomersFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const fileName = String(file.name || '').toLowerCase();
      let parsed = null;

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        parsed = await parseWorkbookCustomerRows(file);
      } else if (fileName.endsWith('.csv') || fileName.endsWith('.tsv') || fileName.endsWith('.txt')) {
        parsed = parseDelimitedCustomerRows(await file.text());
      } else {
        throw new Error('صيغة الملف غير مدعومة. استخدم Excel أو CSV أو TSV');
      }

      setCustomerImportSession({
        fileName: file.name,
        headers: parsed.headers,
        rows: parsed.rows,
        sheetName: parsed.sheetName || null,
        mapping: buildCustomerImportAutoMapping(parsed.headers)
      });
    } catch (err) {
      await safeAlert(err?.message || 'تعذر قراءة الملف', null, {
        type: 'error',
        title: 'استيراد العملاء'
      });
    }
  };

  const downloadCustomerImportTemplate = () => {
    const headers = [
      'name',
      'phone',
      'phone2',
      'address',
      'city',
      'district',
      'notes',
      'creditLimit',
      'balance',
      'customerType'
    ];
    const rows = [
      headers.join(','),
      [
        'عميل تجريبي',
        '01000000000',
        '',
        'القاهرة - شارع النصر',
        'القاهرة',
        'مدينة نصر',
        'ملاحظة اختيارية',
        '5000',
        '1250',
        'VIP'
      ].join(',')
    ];

    const blob = new Blob([`\uFEFF${rows.join('\r\n')}`], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customers-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const startCustomerImport = useCallback(async () => {
    if (!customerImportSession || importingCustomers) return;

    if (!customerImportSession.mapping?.name) {
      await safeAlert('اختَر عمود "اسم العميل" قبل بدء الاستيراد', null, {
        type: 'warning',
        title: 'مطابقة الأعمدة'
      });
      return;
    }

    setImportingCustomers(true);
    try {
      const mappedRows = mapRowsWithCustomerImportMapping(
        customerImportSession.rows,
        customerImportSession.mapping
      ).map((mapped, index) => ({
        sourceIndex: index + 2,
        customer: sanitizeImportedCustomer(mapped)
      }));

      const validRows = mappedRows.filter((item) => item.customer.name);
      const skipped = Math.max(0, mappedRows.length - validRows.length);

      if (!validRows.length) {
        throw new Error('لم يتم العثور على صفوف صالحة تحتوي على اسم عميل');
      }

      const existingByName = new Map();
      const existingByPhone = new Map();
      if (updateExistingOnImport) {
        for (const customer of allCustomers) {
          const nameKey = normalizeCustomerNameKey(customer?.name);
          const phoneKey = normalizeCustomerPhoneKey(customer?.phone);
          if (nameKey && !existingByName.has(nameKey)) existingByName.set(nameKey, customer);
          if (phoneKey && !existingByPhone.has(phoneKey)) existingByPhone.set(phoneKey, customer);
        }
      }

      let created = 0;
      let updated = 0;
      let failed = 0;
      const rowErrors = [];

      for (const item of validRows) {
        const row = item.customer;
        const nameKey = normalizeCustomerNameKey(row.name);
        const phoneKey = normalizeCustomerPhoneKey(row.phone);

        try {
          let existingCustomer = null;
          if (updateExistingOnImport) {
            if (phoneKey) existingCustomer = existingByPhone.get(phoneKey) || null;
            if (!existingCustomer && nameKey) existingCustomer = existingByName.get(nameKey) || null;
          }

          if (existingCustomer) {
            const updatePayload = {
              name: row.name || existingCustomer.name || '',
              phone: row.phone || existingCustomer.phone || '',
              phone2: row.phone2 || existingCustomer.phone2 || '',
              address: row.address || existingCustomer.address || '',
              city: row.city || existingCustomer.city || '',
              district: row.district || existingCustomer.district || '',
              notes: row.notes || existingCustomer.notes || '',
              creditLimit: row.creditLimit ?? existingCustomer.creditLimit ?? 0,
              customerType: row.customerType || existingCustomer.customerType || 'عادي',
              ...(Number.isFinite(row.balance)
                ? { balance: row.balance }
                : {})
            };
            const updateResult = await window.api.updateCustomer(existingCustomer.id, updatePayload);
            if (updateResult?.error) throw new Error(updateResult.error);

            updated += 1;
            const mergedCustomer = { ...existingCustomer, ...updatePayload };
            const mergedNameKey = normalizeCustomerNameKey(mergedCustomer.name);
            const mergedPhoneKey = normalizeCustomerPhoneKey(mergedCustomer.phone);
            if (mergedNameKey) existingByName.set(mergedNameKey, mergedCustomer);
            if (mergedPhoneKey) existingByPhone.set(mergedPhoneKey, mergedCustomer);
          } else {
            const addResult = await window.api.addCustomer({
              ...row,
              customerType: row.customerType || 'عادي'
            });
            if (addResult?.error) throw new Error(addResult.error);

            created += 1;
            const inserted = { ...row, ...(addResult || {}) };
            const insertedNameKey = normalizeCustomerNameKey(inserted.name);
            const insertedPhoneKey = normalizeCustomerPhoneKey(inserted.phone);
            if (insertedNameKey) existingByName.set(insertedNameKey, inserted);
            if (insertedPhoneKey) existingByPhone.set(insertedPhoneKey, inserted);
          }
        } catch (rowError) {
          failed += 1;
          if (rowErrors.length < 10) {
            rowErrors.push(`صف ${item.sourceIndex}: ${rowError?.message || 'خطأ غير متوقع'}`);
          }
        }
      }

      await refreshCustomers();
      setCustomerImportSession(null);

      await safeAlert(
        `نتيجة الاستيراد:\nجديد: ${created}\nتم تحديثه: ${updated}\nتم تجاهله (بدون اسم): ${skipped}\nفشل: ${failed}`,
        null,
        {
          type: failed > 0 ? 'warning' : 'success',
          title: 'استيراد العملاء',
          detail: rowErrors.length ? rowErrors.join('\n') : undefined
        }
      );
    } catch (err) {
      await safeAlert(err?.message || 'تعذر استيراد العملاء', null, {
        type: 'error',
        title: 'استيراد العملاء'
      });
    } finally {
      setImportingCustomers(false);
    }
  }, [customerImportSession, importingCustomers, updateExistingOnImport, allCustomers, refreshCustomers]);

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



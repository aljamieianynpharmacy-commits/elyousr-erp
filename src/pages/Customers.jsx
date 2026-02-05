import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { FileText, DollarSign, Edit2, Trash2, Plus, Search, Settings, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import CustomerLedger from './CustomerLedger';
import NewCustomerModal from '../components/NewCustomerModal';
import PaymentModal from '../components/PaymentModal';

// ============= CONSTANTS =============
const ITEMS_PER_PAGE = 50; // عدد العملاء في كل صفحة
const DEBOUNCE_DELAY = 300; // تأخير البحث بالميلي ثانية

// ============= UTILITY FUNCTIONS =============
const formatCurrency = (value) => {
  return new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const getCustomerTypeColor = (type) => {
  const colors = {
    'جملة': '#3b82f6',
    'قطاعي': '#10b981',
    'VIP': '#f59e0b',
    'عادي': '#6b7280'
  };
  return colors[type] || '#6b7280';
};

// ============= OPTIMIZED CUSTOMER ROW COMPONENT =============
const CustomerRow = memo(({ 
  customer, 
  index, 
  visibleColumns,
  overdueThreshold,
  onShowLedger,
  onPayment,
  onEdit,
  onDelete 
}) => {
  const isOverdue = (customer.lastPaymentDays || 0) > overdueThreshold;
  const rowBgColor = index % 2 === 0 ? 'white' : '#f9fafb';

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
  // ===== STATE MANAGEMENT =====
  const [allCustomers, setAllCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showLedger, setShowLedger] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
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
  const [overdueThreshold, setOverdueThreshold] = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  const [showReports, setShowReports] = useState(false);

  // Visible columns state
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    name: true,
    type: true,
    phone: true,
    balance: true,
    actions: true
  });

  // Refs
  const searchTimeoutRef = useRef(null);
  const tableContainerRef = useRef(null);

  // ===== LOAD CUSTOMERS FROM API =====
  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.api.getCustomers({});
      
      if (result.error) {
        console.error('خطأ في تحميل العملاء:', result.error);
        setAllCustomers([]);
        setFilteredCustomers([]);
      } else {
        setAllCustomers(result.data || []);
        setFilteredCustomers(result.data || []);
      }
    } catch (error) {
      console.error('خطأ في تحميل العملاء:', error);
      setAllCustomers([]);
      setFilteredCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ===== INITIAL LOAD =====
  useEffect(() => {
    loadCustomers();
    
    // Load settings from localStorage
    const savedThreshold = localStorage.getItem('overdueThreshold');
    if (savedThreshold) {
      setOverdueThreshold(parseInt(savedThreshold));
    }
  }, [loadCustomers]);

  // ===== DEBOUNCED SEARCH =====
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (!searchTerm.trim()) {
        setFilteredCustomers(allCustomers);
        setCurrentPage(1);
        return;
      }

      const term = searchTerm.toLowerCase().trim();
      const filtered = allCustomers.filter(customer => 
        customer.name?.toLowerCase().includes(term) ||
        customer.phone?.includes(term) ||
        customer.customerType?.toLowerCase().includes(term) ||
        customer.id?.toString().includes(term)
      );

      setFilteredCustomers(filtered);
      setCurrentPage(1);
    }, DEBOUNCE_DELAY);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, allCustomers]);

  // ===== PAGINATION LOGIC =====
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredCustomers.slice(startIndex, endIndex);
  }, [filteredCustomers, currentPage]);

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);

  // ===== STATISTICS =====
  const customerStats = useMemo(() => {
    const stats = {
      total: allCustomers.length,
      totalDebt: 0,
      overdueCount: 0,
      compliantCount: 0
    };

    allCustomers.forEach(customer => {
      if (customer.balance > 0) {
        stats.totalDebt += customer.balance;
      }
      if ((customer.lastPaymentDays || 0) > overdueThreshold) {
        stats.overdueCount++;
      } else {
        stats.compliantCount++;
      }
    });

    return stats;
  }, [allCustomers, overdueThreshold]);

  // ===== EVENT HANDLERS =====
  const handleShowLedger = useCallback((customerId) => {
    setSelectedCustomer(customerId);
    setShowLedger(true);
  }, []);

  const handlePayment = useCallback((customer) => {
    setSelectedCustomer(customer);
    setShowPayment(true);
  }, []);

  const handleEdit = useCallback((customer) => {
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

  const handleDelete = useCallback(async (customerId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العميل؟')) return;

    try {
      const result = await window.api.deleteCustomer(customerId);
      
      if (result.error) {
        console.error('خطأ في حذف العميل:', result.error);
        alert('فشل في حذف العميل: ' + result.error);
      } else {
        await loadCustomers();
      }
    } catch (error) {
      console.error('خطأ في حذف العميل:', error);
      alert('فشل في حذف العميل');
    }
  }, [loadCustomers]);

  const handleSaveCustomer = useCallback(async () => {
    try {
      let result;
      
      if (editingCustomer) {
        // تحديث عميل موجود
        result = await window.api.updateCustomer(editingCustomer.id, customerFormData);
      } else {
        // إضافة عميل جديد
        result = await window.api.addCustomer(customerFormData);
      }
      
      if (result.error) {
        console.error('خطأ في حفظ العميل:', result.error);
        alert('فشل في حفظ العميل: ' + result.error);
        return;
      }
      
      // إعادة تحميل العملاء
      await loadCustomers();
      
      // إغلاق المودال وإعادة تعيين البيانات
      setShowNewCustomer(false);
      setEditingCustomer(null);
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
    } catch (error) {
      console.error('خطأ في حفظ العميل:', error);
      alert('فشل في حفظ العميل');
    }
  }, [editingCustomer, customerFormData, loadCustomers]);

  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
    // Scroll to top of table
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  }, []);

  // ===== PRINT REPORTS =====
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
  }, [allCustomers, overdueThreshold]);

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

      {/* TABLE */}
      <div
        ref={tableContainerRef}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}
      >
        {filteredCustomers.length === 0 ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>
              {searchTerm ? '🔍 لا توجد نتائج للبحث' : '📋 لا يوجد عملاء'}
            </p>
            <p style={{ fontSize: '14px' }}>
              {searchTerm ? 'جرب كلمات بحث أخرى' : 'ابدأ بإضافة عميل جديد'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                    {visibleColumns.id && (
                      <th style={{ padding: '15px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                        الرقم
                      </th>
                    )}
                    {visibleColumns.name && (
                      <th style={{ padding: '15px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                        اسم العميل
                      </th>
                    )}
                    {visibleColumns.type && (
                      <th style={{ padding: '15px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                        النوع
                      </th>
                    )}
                    {visibleColumns.phone && (
                      <th style={{ padding: '15px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                        الهاتف
                      </th>
                    )}
                    {visibleColumns.balance && (
                      <th style={{ padding: '15px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                        الرصيد
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>
                        الإجراءات
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.map((customer, index) => (
                    <CustomerRow
                      key={customer.id}
                      customer={customer}
                      index={index}
                      visibleColumns={visibleColumns}
                      overdueThreshold={overdueThreshold}
                      onShowLedger={handleShowLedger}
                      onPayment={handlePayment}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
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

      {/* MODALS */}
      {showLedger && (
        <CustomerLedger
          customerId={selectedCustomer}
          onClose={() => setShowLedger(false)}
        />
      )}

      {showNewCustomer && (
        <NewCustomerModal
          isOpen={showNewCustomer}
          customer={customerFormData}
          onChange={setCustomerFormData}
          onClose={() => {
            setShowNewCustomer(false);
            setEditingCustomer(null);
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
          }}
          onSave={handleSaveCustomer}
          existingCustomers={allCustomers}
          title={editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
          editingCustomerId={editingCustomer?.id}
          isEditMode={!!editingCustomer}
        />
      )}

      {showPayment && (
        <PaymentModal
          customer={selectedCustomer}
          onClose={() => setShowPayment(false)}
          onSave={loadCustomers}
        />
      )}

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
                  printReport('compliant');
                  setShowReports(false);
                }}
                style={{
                  padding: '20px',
                  backgroundColor: '#d1fae5',
                  border: '2px solid #10b981',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'right',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#a7f3d0';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#d1fae5';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#059669', fontSize: '16px' }}>
                  ✅ الملتزمين
                </div>
                <div style={{ fontSize: '12px', color: '#10b981', marginTop: '5px' }}>
                  {customerStats.compliantCount} عميل
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
import React, { useState, useEffect } from 'react';

const showToast = (message, type = 'success') => {
  // Create toast container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
    `;
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  const bgColor = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  }[type] || '#10b981';

  toast.style.cssText = `
    background-color: ${bgColor};
    color: white;
    padding: 16px;
    margin-bottom: 10px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    animation: slideIn 0.3s ease-out;
  `;

  toast.textContent = message;
  container.appendChild(toast);

  // Add animation
  const style = document.createElement('style');
  if (!document.getElementById('toast-animation')) {
    style.id = 'toast-animation';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [expandedProduct, setExpandedProduct] = useState(null);

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 20;
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    brand: '',
    basePrice: 0,
    cost: 0,
    image: '',
    sku: '',
    weight: '',
    dimensions: ''
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    color: '#000000',
    icon: '📦'
  });

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load Categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Reset page when filter or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory, sortConfig]);

  // Load Products on change
  useEffect(() => {
    loadProducts();
  }, [currentPage, debouncedSearch, filterCategory, sortConfig]);

  const loadCategories = async () => {
    try {
      const categoriesData = await window.api.getCategories();
      if (categoriesData && !categoriesData.error) {
        setCategories(categoriesData);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        pageSize,
        searchTerm: debouncedSearch,
        categoryId: filterCategory || null,
        sortCol: sortConfig.key,
        sortDir: sortConfig.direction
      };

      const result = await window.api.getProducts(params);

      if (result.error) {
        setError(result.error);
      } else {
        setProducts(result.data || []);
        setTotalPages(result.totalPages || 1);
        setTotalItems(result.total || 0);
      }
    } catch (err) {
      setError('فشل تحميل البيانات');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to refresh current view without full reset (not used anymore in favor of optimistic)
  // const refreshData = () => loadProducts(); 


  const handleOpenModal = (product = null) => {
    if (product) {
      setModalMode('edit');
      setSelectedProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        categoryId: product.categoryId || '',
        brand: product.brand || '',
        basePrice: product.basePrice || 0,
        cost: product.cost || 0,
        image: product.image || '',
        sku: product.sku || '',
        weight: product.weight || '',
        dimensions: product.dimensions || ''
      });
    } else {
      setModalMode('add');
      setSelectedProduct(null);
      setFormData({
        name: '',
        description: '',
        categoryId: '',
        brand: '',
        basePrice: 0,
        cost: 0,
        image: '',
        sku: '',
        weight: '',
        dimensions: ''
      });
    }
    setShowModal(true);
  };

  const handleSaveProduct = async () => {
    if (!formData.name) {
      showToast('الرجاء إدخال اسم المنتج', 'warning');
      return;
    }

    try {
      let result;
      // Clean data before sending
      const cleanData = {
        ...formData,
        categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
        basePrice: parseFloat(formData.basePrice || 0),
        cost: parseFloat(formData.cost || 0)
      };

      if (modalMode === 'add') {
        result = await window.api.addProduct(cleanData);
      } else {
        result = await window.api.updateProduct(selectedProduct.id, cleanData);
      }

      if (result.error) {
        showToast('خطأ: ' + result.error, 'error');
      } else {
        setShowModal(false);
        if (modalMode === 'add') {
          if (currentPage !== 1) setCurrentPage(1);
          else loadProducts();
        } else {
          // Optimistic Update
          setProducts(prev => prev.map(p => p.id === result.id ? result : p));
        }
        showToast(modalMode === 'add' ? 'تم إضافة المنتج بنجاح' : 'تم تحديث المنتج بنجاح', 'success');
      }
    } catch (err) {
      showToast('خطأ: ' + err.message, 'error');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      try {
        const result = await window.api.deleteProduct(productId);
        if (result.error) {
          showToast('خطأ: ' + result.error, 'error');
        } else {
          setProducts(prev => prev.filter(p => p.id !== productId));
          setTotalItems(prev => prev - 1);
          showToast('تم حذف المنتج بنجاح', 'success');
        }
      } catch (err) {
        showToast('خطأ: ' + err.message, 'error');
      }
    }
  };

  const handleOpenCategoryModal = (category = null) => {
    if (category) {
      setSelectedCategory(category);
      setCategoryFormData({
        name: category.name,
        description: category.description || '',
        color: category.color || '#000000',
        icon: category.icon || '📦'
      });
    } else {
      setSelectedCategory(null);
      setCategoryFormData({
        name: '',
        description: '',
        color: '#000000',
        icon: '📦'
      });
    }
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryFormData.name) {
      showToast('الرجاء إدخال اسم الفئة', 'warning');
      return;
    }

    try {
      let result;
      if (selectedCategory) {
        result = await window.api.updateCategory(selectedCategory.id, categoryFormData);
      } else {
        result = await window.api.addCategory(categoryFormData);
      }

      if (result.error) {
        showToast('خطأ: ' + result.error, 'error');
      } else {
        setShowCategoryModal(false);
        loadProducts();
        showToast(selectedCategory ? 'تم تحديث الفئة بنجاح' : 'تم إضافة الفئة بنجاح', 'success');
      }
    } catch (err) {
      showToast('خطأ: ' + err.message, 'error');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الفئة؟')) {
      try {
        const result = await window.api.deleteCategory(categoryId);
        if (result.error) {
          showToast('خطأ: ' + result.error, 'error');
        } else {
          loadCategories();
          loadProducts();
          showToast('تم حذف الفئة بنجاح', 'success');
        }
      } catch (err) {
        showToast('خطأ: ' + err.message, 'error');
      }
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };



  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'غير مصنف';
  };

  const getCategoryColor = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.color : '#9ca3af';
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>جاري التحميل...</div>;
  if (error) return <div style={{ color: 'red', padding: '20px' }}>{error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>📦 إدارة المنتجات</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleOpenCategoryModal()}
            style={{
              backgroundColor: '#8b5cf6',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>🏷️</span> إدارة الفئات
          </button>
          <button
            onClick={() => handleOpenModal()}
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>➕</span> إضافة منتج جديد
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', backgroundColor: '#f9fafb', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 ابحث باسم المنتج، كود SKU، أو الباركود..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 12px 12px 40px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              fontSize: '14px'
            }}
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb', minWidth: '200px', cursor: 'pointer' }}
        >
          <option value="">📂 جميع الفئات</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.icon || '📦'} {cat.name}</option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
              <th onClick={() => requestSort('id')} style={{ padding: '15px', cursor: 'pointer', width: '60px' }}># {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th style={{ padding: '15px', width: '80px' }}>صورة</th>
              <th onClick={() => requestSort('name')} style={{ padding: '15px', cursor: 'pointer' }}>المنتج {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => requestSort('categoryId')} style={{ padding: '15px', cursor: 'pointer' }}>الفئة {sortConfig.key === 'categoryId' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => requestSort('basePrice')} style={{ padding: '15px', cursor: 'pointer' }}>سعر البيع {sortConfig.key === 'basePrice' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => requestSort('cost')} style={{ padding: '15px', cursor: 'pointer' }}>التكلفة {sortConfig.key === 'cost' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th style={{ padding: '15px' }}>المخزون</th>
              <th style={{ padding: '15px', textAlign: 'center' }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  🤔 لا توجد منتجات
                </td>
              </tr>
            ) : (
              products.map((product, index) => (
                <React.Fragment key={product.id}>
                  <tr
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9fafb'}
                  >
                    <td style={{ padding: '15px', color: '#6b7280' }}>{product.id}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        backgroundColor: '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px'
                      }}>
                        {product.image ? (
                          <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          '📦'
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{product.name}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {product.sku && <span style={{ marginRight: '10px' }}>SKU: {product.sku}</span>}
                        {product.brand && <span>Brand: {product.brand}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <span style={{
                        backgroundColor: getCategoryColor(product.categoryId) + '20',
                        color: getCategoryColor(product.categoryId),
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        border: `1px solid ${getCategoryColor(product.categoryId)}`
                      }}>
                        {getCategoryName(product.categoryId)}
                      </span>
                    </td>
                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#059669' }}>
                      {product.basePrice.toFixed(2)} ج.م
                    </td>
                    <td style={{ padding: '15px', color: '#6366f1' }}>
                      {product.cost?.toFixed(2) || '0.00'} ج.م
                    </td>
                    <td style={{ padding: '15px' }}>
                      {product.inventory ? (
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{product.inventory.totalQuantity}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>قطعة</div>
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                          title="التفاصيل"
                          style={{
                            padding: '8px',
                            backgroundColor: expandedProduct === product.id ? '#f59e0b' : '#fff',
                            color: expandedProduct === product.id ? 'white' : '#f59e0b',
                            border: '1px solid #f59e0b',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          👁️
                        </button>
                        <button
                          onClick={() => handleOpenModal(product)}
                          title="تعديل"
                          style={{
                            padding: '8px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          title="حذف"
                          style={{
                            padding: '8px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedProduct === product.id && (
                    <tr>
                      <td colSpan="8" style={{ padding: '0', backgroundColor: '#fcfcfc', borderBottom: '1px solid #e5e7eb' }}>
                        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                          <div>
                            <h4 style={{ marginTop: 0, color: '#374151' }}>📋 تفاصيل المنتج</h4>
                            <p style={{ fontSize: '13px', margin: '5px 0' }}><strong>الوصف:</strong> {product.description || 'لا يوجد وصف'}</p>
                            <p style={{ fontSize: '13px', margin: '5px 0' }}><strong>الوزن:</strong> {product.weight || '-'}</p>
                            <p style={{ fontSize: '13px', margin: '5px 0' }}><strong>الأبعاد:</strong> {product.dimensions || '-'}</p>
                            <p style={{ fontSize: '13px', margin: '5px 0' }}><strong>الباركود:</strong> {product.barcode || '-'}</p>
                          </div>
                          <div>
                            <h4 style={{ marginTop: 0, color: '#0369a1' }}>📦 تفاصيل المخزون</h4>
                            {product.inventory ? (
                              <div style={{ fontSize: '13px' }}>
                                <p style={{ margin: '5px 0' }}>• في المستودع: <strong>{product.inventory.warehouseQty}</strong></p>
                                <p style={{ margin: '5px 0' }}>• في المعرض: <strong>{product.inventory.displayQty}</strong></p>
                                <p style={{ margin: '5px 0' }}>• الحد الأدنى: <strong>{product.inventory.minStock}</strong></p>
                              </div>
                            ) : (
                              <p style={{ fontSize: '13px', color: '#6b7280' }}>لا توجد بيانات مخزون</p>
                            )}
                          </div>
                          <div>
                            <h4 style={{ marginTop: 0, color: '#be185d' }}>📏 المتغيرات (Variants)</h4>
                            {product.variants && product.variants.length > 0 ? (
                              <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                {product.variants.map((v, i) => (
                                  <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px dashed #eee' }}>
                                    {v.productSize && <span>المقاس: <strong>{v.productSize}</strong> | </span>}
                                    {v.color && <span>اللون: <strong>{v.color}</strong> | </span>}
                                    <span>السعر: <strong>{v.price}</strong></span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p style={{ fontSize: '13px', color: '#6b7280' }}>لا توجد متغيرات</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2>{modalMode === 'add' ? '➕ إضافة منتج جديد' : '✏️ تعديل المنتج'}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>اسم المنتج *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>الفئة</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                >
                  <option value="">اختر فئة</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>العلامة التجارية</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>SKU</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>السعر الأساسي</label>
                <input
                  type="number"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                  step="0.01"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>التكلفة</label>
                <input
                  type="number"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                  step="0.01"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>الوزن</label>
                <input
                  type="text"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="مثال: 500g"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>الأبعاد</label>
                <input
                  type="text"
                  value={formData.dimensions}
                  onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                  placeholder="مثال: 10x20x30cm"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>الوصف</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>رابط الصورة (URL)</label>
              <input
                type="text"
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleSaveProduct}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ✅ حفظ
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ❌ إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginTop: 0 }}>
              {selectedCategory ? '✏️ تحرير الفئة' : '➕ إضافة فئة جديدة'}
            </h2>

            {/* Category Form */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                اسم الفئة
              </label>
              <input
                type="text"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
                placeholder="مثال: قمصان"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                الوصف
              </label>
              <textarea
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  minHeight: '80px',
                  fontFamily: 'inherit'
                }}
                placeholder="وصف الفئة"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  الرمز 🎨
                </label>
                <input
                  type="text"
                  value={categoryFormData.icon}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, icon: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '20px',
                    textAlign: 'center'
                  }}
                  maxLength="2"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  اللون 🎨
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="color"
                    value={categoryFormData.color}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, color: e.target.value })}
                    style={{
                      width: '50px',
                      height: '40px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{
                    flex: 1,
                    backgroundColor: categoryFormData.color,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold'
                  }}>
                    {categoryFormData.icon}
                  </div>
                </div>
              </div>
            </div>

            {/* Categories List */}
            <div style={{ marginBottom: '20px', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>الفئات الحالية</h3>
              {categories.length === 0 ? (
                <p style={{ color: '#999', textAlign: 'center' }}>لا توجد فئات</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                  {categories.map(cat => (
                    <div key={cat.id} style={{
                      backgroundColor: cat.color || '#999',
                      color: 'white',
                      padding: '10px',
                      borderRadius: '6px',
                      textAlign: 'center',
                      position: 'relative',
                      cursor: 'pointer'
                    }}>
                      <div style={{ fontSize: '24px' }}>{cat.icon || '📦'}</div>
                      <div style={{ fontSize: '12px', marginTop: '5px' }}>{cat.name}</div>
                      <div style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        display: 'flex',
                        gap: '3px'
                      }}>
                        <button
                          onClick={() => handleOpenCategoryModal(cat)}
                          style={{
                            padding: '2px 6px',
                            fontSize: '10px',
                            backgroundColor: 'rgba(255,255,255,0.3)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          style={{
                            padding: '2px 6px',
                            fontSize: '10px',
                            backgroundColor: 'rgba(255,0,0,0.3)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleSaveCategory}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ✅ حفظ
              </button>
              <button
                onClick={() => setShowCategoryModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ❌ إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

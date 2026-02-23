import React, { useCallback, useEffect, useRef, useState } from 'react';
import { safeAlert } from '../utils/safeAlert';
import { safeConfirm } from '../utils/safeConfirm';
import './Products.css';

const DEFAULT_WAREHOUSE = {
  name: '',
  icon: '🏭',
  color: '#0f766e',
  isActive: true
};

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState(DEFAULT_WAREHOUSE);
  const [editingId, setEditingId] = useState(null);

  // Inventory Modal State
  const [selectedWarehouseForInventory, setSelectedWarehouseForInventory] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [actualQuantities, setActualQuantities] = useState({});

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.api.getWarehouses();
      if (res?.error) throw new Error(res.error);
      setWarehouses(Array.isArray(res) ? res : []);
    } catch (err) {
      await safeAlert(err.message || 'فشل تحميل المخازن', null, { type: 'error', title: 'المخازن' });
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  const handleSave = async () => {
    const name = (warehouseForm.name || '').trim();
    if (!name) {
      await safeAlert('اسم المخزن مطلوب', null, { type: 'warning', title: 'بيانات ناقصة' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        icon: (warehouseForm.icon || '🏭').trim(),
        color: warehouseForm.color || '#0f766e',
        isActive: warehouseForm.isActive !== false
      };

      const res = editingId
        ? await window.api.updateWarehouse(editingId, payload)
        : await window.api.addWarehouse(payload);

      if (res?.error) throw new Error(res.error);

      setWarehouseForm(DEFAULT_WAREHOUSE);
      setEditingId(null);
      await loadWarehouses();
      notify(editingId ? 'تم تحديث المخزن' : 'تم إضافة المخزن', 'success');
    } catch (err) {
      await safeAlert(err.message || 'فشل حفظ المخزن', null, { type: 'error', title: 'المخازن' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (warehouse) => {
    setWarehouseForm({
      name: warehouse.name || '',
      icon: warehouse.icon || '🏭',
      color: warehouse.color || '#0f766e',
      isActive: warehouse.isActive !== false
    });
    setEditingId(warehouse.id);
  };

  const handleCancel = () => {
    setWarehouseForm(DEFAULT_WAREHOUSE);
    setEditingId(null);
  };

  const handleDelete = async (id, name) => {
    const ok = await safeConfirm(`سيتم حذف المخزن "${name}". هل تريد المتابعة؟`, { title: 'حذف مخزن' });
    if (!ok) return;

    try {
      const res = await window.api.deleteWarehouse(id);
      if (res?.error) {
        await safeAlert(res.error, null, { type: 'error', title: 'تعذر الحذف' });
        return;
      }

      await loadWarehouses();
      notify('تم حذف المخزن', 'success');
    } catch (err) {
      await safeAlert(err.message || 'فشل حذف المخزن', null, { type: 'error', title: 'المخازن' });
    }
  };

  const handleToggleActive = async (warehouse) => {
    try {
      const res = await window.api.updateWarehouse(warehouse.id, {
        ...warehouse,
        isActive: !warehouse.isActive
      });
      if (res?.error) throw new Error(res.error);
      await loadWarehouses();
      notify(warehouse.isActive ? 'تم تعطيل المخزن' : 'تم تفعيل المخزن', 'success');
    } catch (err) {
      await safeAlert(err.message || 'فشل تحديث حالة المخزن', null, { type: 'error', title: 'المخازن' });
    }
  };

  const handleOpenInventory = async (warehouse) => {
    setSelectedWarehouseForInventory(warehouse);
    setInventoryLoading(true);
    setActualQuantities({});
    try {
      const res = await window.api.getWarehouseInventory(warehouse.id);
      if (res?.error) throw new Error(res.error);
      setInventoryItems(Array.isArray(res) ? res : []);

      const initialCounts = {};
      (Array.isArray(res) ? res : []).forEach(item => {
        initialCounts[item.id] = item.quantity;
      });
      setActualQuantities(initialCounts);
    } catch (err) {
      await safeAlert(err.message || 'فشل تحميل جرد المخزن', null, { type: 'error', title: 'جرد المخزن' });
      setInventoryItems([]);
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleCloseInventory = () => {
    setSelectedWarehouseForInventory(null);
    setInventoryItems([]);
  };

  const handleActualQuantityChange = (itemId, value) => {
    setActualQuantities(prev => ({
      ...prev,
      [itemId]: parseInt(value) || 0
    }));
  };

  return (
    <div className="products-page">
      <header className="products-header">
        <div>
          <h1>إدارة المخازن</h1>
        </div>
      </header>

      {/* الإحصائيات السريعة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '32px', color: '#0f766e' }}>🏭</div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{warehouses.length}</div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>إجمالي المخازن</div>
          </div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '32px', color: '#10b981' }}>✅</div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{warehouses.filter(w => w.isActive).length}</div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>مخازن نشطة</div>
          </div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '32px', color: '#ef4444' }}>❌</div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{warehouses.filter(w => !w.isActive).length}</div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>مخازن معطلة</div>
          </div>
        </div>
      </div>

      <section className="products-table-card" style={{ padding: '0', backgroundColor: 'transparent', boxShadow: 'none' }}>

        {/* نموذج الإضافة / التعديل */}
        <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {editingId ? '✏️ تعديل بيانات المخزن' : '➕ مخزن جديد'}
            </h3>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', flexDirection: 'row', direction: 'rtl' }}>
            <label style={{ flex: '1 1 200px' }}>
              <span style={{ display: 'block', textAlign: 'right', marginBottom: '6px' }}>اسم المخزن *</span>
              <input
                type="text"
                value={warehouseForm.name}
                onChange={(e) => setWarehouseForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="مثال: مخزن رئيسي"
                style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right' }}
              />
            </label>
            <label style={{ flex: '1 1 150px' }}>
              <span style={{ display: 'block', textAlign: 'right', marginBottom: '6px' }}>الأيقونة</span>
              <input
                type="text"
                value={warehouseForm.icon}
                onChange={(e) => setWarehouseForm((p) => ({ ...p, icon: e.target.value }))}
                placeholder="🏭"
                style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right' }}
              />
            </label>
            <label style={{ flex: '1 1 150px' }}>
              <span style={{ display: 'block', textAlign: 'right', marginBottom: '6px' }}>اللون المميز</span>
              <input
                type="color"
                value={warehouseForm.color}
                onChange={(e) => setWarehouseForm((p) => ({ ...p, color: e.target.value }))}
                style={{ width: '100%', height: '42px', padding: '2px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
              />
            </label>

            <label style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '42px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={warehouseForm.isActive}
                onChange={(e) => setWarehouseForm((p) => ({ ...p, isActive: e.target.checked }))}
                style={{ margin: 0, width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: 'bold', color: warehouseForm.isActive ? '#10b981' : '#64748b' }}>
                {warehouseForm.isActive ? 'مخزن نشط' : 'مخزن معطل'}
              </span>
            </label>

            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                style={{ padding: '10px 20px', height: '42px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', flex: '0 0 auto' }}
              >
                إلغاء
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '10px 24px', backgroundColor: '#0f766e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', minWidth: '120px' }}
            >
              {saving ? 'جاري الحفظ...' : editingId ? '💾 تحديث البيانات' : '➕ إضافة المخزن'}
            </button>
          </div>
        </div>

        {/* جدول المخازن */}
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <span style={{ fontSize: '24px', display: 'inline-block', animation: 'spin 1s linear infinite' }}>🔄</span>
              <p>جاري تحميل المخازن...</p>
            </div>
          ) : warehouses.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>لا توجد مخازن مضافة بعد.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '16px', color: '#475569', fontWeight: 'bold' }}>الأيقونة</th>
                    <th style={{ padding: '16px', color: '#475569', fontWeight: 'bold' }}>اسم المخزن</th>
                    <th style={{ padding: '16px', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>اللون المميز</th>
                    <th style={{ padding: '16px', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>الحالة</th>
                    <th style={{ padding: '16px', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map((w) => (
                    <tr key={w.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: w.isActive ? 1 : 0.6, transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '16px', fontSize: '24px' }}>{w.icon || '🏭'}</td>
                      <td style={{ padding: '16px', fontWeight: 'bold', color: '#1e293b' }}>{w.name}</td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: w.color || '#0f766e', margin: '0 auto', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} title={w.color}></div>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          backgroundColor: w.isActive ? '#dcfce7' : '#fee2e2',
                          color: w.isActive ? '#166534' : '#991b1b'
                        }}>
                          {w.isActive ? '✅ نشط' : '❌ معطل'}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenInventory(w)}
                            title="جرد المخزن / محتويات"
                            style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                          >
                            📦 محتويات المخزن / جرد
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(w)}
                            title={w.isActive ? 'تعطيل' : 'تفعيل'}
                            style={{ background: '#f1f5f9', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}
                          >
                            {w.isActive ? '⏸️' : '▶️'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(w)}
                            title="تعديل"
                            style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(w.id, w.name)}
                            title="حذف"
                            style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Inventory Modal */}
      {selectedWarehouseForInventory && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="modal-content" style={{
            background: '#fff', padding: '24px', borderRadius: '12px',
            width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column'
          }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>📦 جرد المخزن: {selectedWarehouseForInventory.name}</h2>
              <button onClick={handleCloseInventory} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>×</button>
            </header>

            {inventoryLoading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>جاري تحميل البيانات...</div>
            ) : inventoryItems.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>المخزن فارغ حالياً.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>المنتج</th>
                      <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>الباركود</th>
                      <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>الكمية المسجلة</th>
                      <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>الكمية الفعلية (جرد)</th>
                      <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>الفرق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryItems.map(item => {
                      const registeredQty = item.quantity;
                      const actualQty = actualQuantities[item.id] ?? registeredQty;
                      const diff = actualQty - registeredQty;
                      const diffColor = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b';

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px' }}>{item.product?.name || 'منتج غير معروف'}</td>
                          <td style={{ padding: '12px', color: '#64748b' }}>{item.product?.barcode || '-'}</td>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{registeredQty}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <input
                              type="number"
                              value={actualQty}
                              onChange={(e) => handleActualQuantityChange(item.id, e.target.value)}
                              style={{ width: '80px', padding: '6px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                              min="0"
                            />
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', color: diffColor, fontWeight: 'bold', direction: 'ltr' }}>
                            {diff > 0 ? `+${diff}` : diff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <footer style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => window.print()}
                style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                🖨️ طباعة نموذج الجرد
              </button>
            </footer>
          </div>
        </div>
      )}

      {toast ? <div className={`products-toast ${toast.type || 'success'}`}>{toast.message}</div> : null}
    </div>
  );
}

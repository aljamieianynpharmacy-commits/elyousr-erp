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

  return (
    <div className="products-page">
      <header className="products-header">
        <div>
          <h1>إدارة المخازن</h1>
        </div>
      </header>

      <section className="products-table-card">
        <div className="form-grid two-cols" style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
          <label>
            اسم المخزن *
            <input
              type="text"
              value={warehouseForm.name}
              onChange={(e) => setWarehouseForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="مثال: مخزن رئيسي"
            />
          </label>
          <label>
            الأيقونة
            <input
              type="text"
              value={warehouseForm.icon}
              onChange={(e) => setWarehouseForm((p) => ({ ...p, icon: e.target.value }))}
              placeholder="🏭"
            />
          </label>
          <label>
            اللون
            <input
              type="color"
              value={warehouseForm.color}
              onChange={(e) => setWarehouseForm((p) => ({ ...p, color: e.target.value }))}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={warehouseForm.isActive}
              onChange={(e) => setWarehouseForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            <span>نشط</span>
          </label>
          <div style={{ display: 'flex', gap: '8px', gridColumn: '1 / -1' }}>
            <button
              type="button"
              className="products-btn products-btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'جاري الحفظ...' : editingId ? '💾 تحديث' : '➕ إضافة'}
            </button>
            {editingId && (
              <button
                type="button"
                className="products-btn products-btn-light"
                onClick={handleCancel}
              >
                إلغاء
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="products-loading">
            <span className="spin">🔄</span>
            <span>جاري تحميل المخازن...</span>
          </div>
        ) : warehouses.length === 0 ? (
          <div className="products-empty">لا توجد مخازن</div>
        ) : (
          <div className="category-list">
            {warehouses.map((w) => (
              <article
                key={w.id}
                className="category-row"
                style={{
                  opacity: w.isActive ? 1 : 0.6,
                  borderLeft: `4px solid ${w.color || '#0f766e'}`
                }}
              >
                <div>
                  <strong>
                    {w.icon || '🏭'} {w.name}
                  </strong>
                  <small>
                    {w.isActive ? '✅ نشط' : '❌ معطل'}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => handleToggleActive(w)}
                    title={w.isActive ? 'تعطيل' : 'تفعيل'}
                  >
                    {w.isActive ? '⏸️' : '▶️'}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => handleEdit(w)}
                    title="تعديل"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => handleDelete(w.id, w.name)}
                    title="حذف"
                  >
                    🗑️
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {toast ? <div className={`products-toast ${toast.type || 'success'}`}>{toast.message}</div> : null}
    </div>
  );
}

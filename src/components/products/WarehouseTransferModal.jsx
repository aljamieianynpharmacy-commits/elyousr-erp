import React, { useCallback, useEffect, useState } from 'react';
import { safeAlert } from '../../utils/safeAlert';
import { nText, nInt } from '../../utils/productUtils';
import './ProductModal.css';

export default function WarehouseTransferModal({
  isOpen,
  onClose,
  product,
  warehouses = [],
  onTransferComplete
}) {
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [warehouseStocks, setWarehouseStocks] = useState([]);
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    if (!isOpen || !product?.id) return;

    // Load warehouse stocks
    (async () => {
      const res = await window.api.getWarehouseStocks(product.id);
      if (!res?.error) {
        setWarehouseStocks(Array.isArray(res) ? res : []);
      }
    })();

    // Load recent transfers
    (async () => {
      const res = await window.api.getWarehouseTransfers(product.id, 10);
      if (!res?.error) {
        setTransfers(Array.isArray(res) ? res : []);
      }
    })();

    // Reset form
    setFromWarehouseId('');
    setToWarehouseId('');
    setQuantity('');
    setNotes('');
  }, [isOpen, product]);

  const handleTransfer = async () => {
    const fromId = nInt(fromWarehouseId);
    const toId = nInt(toWarehouseId);
    const qty = nInt(quantity);

    if (!fromId || !toId) {
      await safeAlert('اختر المخزن المصدر والمخزن الهدف', null, { type: 'warning', title: 'نقل المنتج' });
      return;
    }

    if (fromId === toId) {
      await safeAlert('لا يمكن النقل لنفس المخزن', null, { type: 'warning', title: 'نقل المنتج' });
      return;
    }

    if (qty <= 0) {
      await safeAlert('الكمية يجب أن تكون أكبر من صفر', null, { type: 'warning', title: 'نقل المنتج' });
      return;
    }

    const fromStock = warehouseStocks.find(s => s.warehouseId === fromId);
    const availableQty = fromStock ? nInt(fromStock.quantity, 0) : 0;

    if (qty > availableQty) {
      await safeAlert(`الكمية المتاحة في المخزن المصدر: ${availableQty}`, null, { type: 'error', title: 'نقل المنتج' });
      return;
    }

    setTransferring(true);
    try {
      const res = await window.api.transferProductBetweenWarehouses(
        product.id,
        fromId,
        toId,
        qty,
        nText(notes)
      );

      if (res?.error) throw new Error(res.error);

      // Refresh stocks and transfers
      const stocksRes = await window.api.getWarehouseStocks(product.id);
      if (!stocksRes?.error) {
        setWarehouseStocks(Array.isArray(stocksRes) ? stocksRes : []);
      }

      const transfersRes = await window.api.getWarehouseTransfers(product.id, 10);
      if (!transfersRes?.error) {
        setTransfers(Array.isArray(transfersRes) ? transfersRes : []);
      }

      // Reset form
      setFromWarehouseId('');
      setToWarehouseId('');
      setQuantity('');
      setNotes('');

      if (onTransferComplete) {
        await onTransferComplete();
      }

      await safeAlert('تم نقل المنتج بنجاح', null, { type: 'success', title: 'نقل المنتج' });
    } catch (err) {
      await safeAlert(err.message || 'فشل نقل المنتج', null, { type: 'error', title: 'نقل المنتج' });
    } finally {
      setTransferring(false);
    }
  };

  if (!isOpen) return null;

  const activeWarehouses = warehouses.filter(w => w.isActive);
  const fromWarehouse = activeWarehouses.find(w => w.id === nInt(fromWarehouseId));
  const toWarehouse = activeWarehouses.find(w => w.id === nInt(toWarehouseId));
  const fromStock = warehouseStocks.find(s => s.warehouseId === nInt(fromWarehouseId));
  const availableQty = fromStock ? nInt(fromStock.quantity, 0) : 0;

  return (
    <div className="product-modal-overlay" onClick={() => !transferring && onClose()}>
      <div className="product-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="product-modal-header">
          <div>
            <h2>نقل منتج بين المخازن</h2>
            <p>{product?.name || 'منتج'}</p>
          </div>
          <button type="button" className="close-button" onClick={onClose} disabled={transferring}>
            ✕
          </button>
        </div>

        <div className="product-modal-body" style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <label className="form-group">
              <span>من المخزن</span>
              <select
                className="form-select"
                value={fromWarehouseId}
                onChange={(e) => {
                  setFromWarehouseId(e.target.value);
                  setQuantity('');
                }}
                disabled={transferring}
              >
                <option value="">اختر المخزن المصدر</option>
                {activeWarehouses.map((wh) => {
                  const stock = warehouseStocks.find(s => s.warehouseId === wh.id);
                  const qty = stock ? nInt(stock.quantity, 0) : 0;
                  return (
                    <option key={wh.id} value={wh.id}>
                      {wh.icon || '🏭'} {wh.name} (المتاح: {qty})
                    </option>
                  );
                })}
              </select>
            </label>

            {fromWarehouse && (
              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '0.9rem' }}>
                <strong>الكمية المتاحة:</strong> {availableQty}
              </div>
            )}

            <label className="form-group">
              <span>إلى المخزن</span>
              <select
                className="form-select"
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(e.target.value)}
                disabled={transferring}
              >
                <option value="">اختر المخزن الهدف</option>
                {activeWarehouses
                  .filter(wh => wh.id !== nInt(fromWarehouseId))
                  .map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.icon || '🏭'} {wh.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="form-group">
              <span>الكمية</span>
              <input
                type="number"
                min="1"
                max={availableQty}
                className="form-input"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={`الحد الأقصى: ${availableQty}`}
                disabled={transferring || !fromWarehouseId}
              />
            </label>

            <label className="form-group">
              <span>ملاحظات (اختياري)</span>
              <textarea
                className="form-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات حول عملية النقل"
                disabled={transferring}
              />
            </label>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                className="products-btn products-btn-primary"
                onClick={handleTransfer}
                disabled={transferring || !fromWarehouseId || !toWarehouseId || nInt(quantity) <= 0}
                style={{ flex: 1 }}
              >
                {transferring ? 'جاري النقل...' : 'نقل المنتج'}
              </button>
              <button
                type="button"
                className="products-btn products-btn-light"
                onClick={onClose}
                disabled={transferring}
              >
                إلغاء
              </button>
            </div>
          </div>

          {transfers.length > 0 && (
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '12px' }}>سجل الحركات الأخيرة</h3>
              <div style={{ display: 'grid', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {transfers.map((transfer) => {
                  const fromWh = warehouses.find(w => w.id === transfer.fromWarehouseId);
                  const toWh = warehouses.find(w => w.id === transfer.toWarehouseId);
                  return (
                    <div
                      key={transfer.id}
                      style={{
                        padding: '10px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                          {fromWh?.icon || '🏭'} {fromWh?.name || 'مخزن'} → {toWh?.icon || '🏭'} {toWh?.name || 'مخزن'}
                        </span>
                        <strong>{transfer.quantity}</strong>
                      </div>
                      {transfer.notes && (
                        <div style={{ marginTop: '4px', color: '#64748b', fontSize: '0.8rem' }}>
                          {transfer.notes}
                        </div>
                      )}
                      <div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '0.75rem' }}>
                        {new Date(transfer.createdAt).toLocaleString('ar-EG')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

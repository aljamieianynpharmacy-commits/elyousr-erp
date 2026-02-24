import React, { useEffect, useMemo, useState } from 'react';
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
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [warehouseStockData, setWarehouseStockData] = useState({ totals: [], variants: [] });
  const [transfers, setTransfers] = useState([]);

  const variants = useMemo(
    () => (Array.isArray(warehouseStockData?.variants) ? warehouseStockData.variants : []),
    [warehouseStockData]
  );

  const selectedVariant = useMemo(() => {
    const selectedId = nInt(variantId, 0);
    if (selectedId > 0) {
      return variants.find((variant) => variant.id === selectedId) || null;
    }
    return variants.length === 1 ? variants[0] : null;
  }, [variantId, variants]);

  const sourceStocks = useMemo(() => {
    if (selectedVariant) {
      return Array.isArray(selectedVariant.warehouseStocks) ? selectedVariant.warehouseStocks : [];
    }
    return Array.isArray(warehouseStockData?.totals) ? warehouseStockData.totals : [];
  }, [selectedVariant, warehouseStockData]);

  useEffect(() => {
    if (!isOpen || !product?.id) return;

    (async () => {
      const res = await window.api.getWarehouseStocks(product.id);
      if (!res?.error) {
        const payload = (res && typeof res === 'object' && !Array.isArray(res))
          ? res
          : { totals: Array.isArray(res) ? res : [], variants: [] };

        setWarehouseStockData({
          totals: Array.isArray(payload.totals) ? payload.totals : [],
          variants: Array.isArray(payload.variants) ? payload.variants : []
        });

        if (Array.isArray(payload.variants) && payload.variants.length === 1) {
          setVariantId(String(payload.variants[0].id));
        } else {
          setVariantId('');
        }
      }
    })();

    (async () => {
      const res = await window.api.getWarehouseTransfers(product.id, 10);
      if (!res?.error) {
        setTransfers(Array.isArray(res) ? res : []);
      }
    })();

    setFromWarehouseId('');
    setToWarehouseId('');
    setQuantity('');
    setNotes('');
  }, [isOpen, product]);

  const handleTransfer = async () => {
    const fromId = nInt(fromWarehouseId);
    const toId = nInt(toWarehouseId);
    const selectedVariantId = nInt(variantId, 0);
    const qty = nInt(quantity);

    if (!fromId || !toId) {
      await safeAlert('اختر المخزن المصدر والمخزن الهدف', null, { type: 'warning', title: 'نقل المنتج' });
      return;
    }

    if (variants.length > 1 && selectedVariantId <= 0) {
      await safeAlert('اختَر المقاس/اللون المراد نقله أولًا', null, { type: 'warning', title: 'نقل المنتج' });
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

    const fromStock = sourceStocks.find((stock) => stock.warehouseId === fromId);
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
        nText(notes),
        selectedVariantId || null
      );
      if (res?.error) throw new Error(res.error);

      const stocksRes = await window.api.getWarehouseStocks(product.id);
      if (!stocksRes?.error) {
        const payload = (stocksRes && typeof stocksRes === 'object' && !Array.isArray(stocksRes))
          ? stocksRes
          : { totals: Array.isArray(stocksRes) ? stocksRes : [], variants: [] };
        setWarehouseStockData({
          totals: Array.isArray(payload.totals) ? payload.totals : [],
          variants: Array.isArray(payload.variants) ? payload.variants : []
        });
        if (Array.isArray(payload.variants) && payload.variants.length === 1) {
          setVariantId(String(payload.variants[0].id));
        }
      }

      const transfersRes = await window.api.getWarehouseTransfers(product.id, 10);
      if (!transfersRes?.error) {
        setTransfers(Array.isArray(transfersRes) ? transfersRes : []);
      }

      setFromWarehouseId('');
      setToWarehouseId('');
      if (variants.length !== 1) {
        setVariantId('');
      }
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

  const activeWarehouses = warehouses.filter((warehouse) => warehouse.isActive);
  const fromWarehouse = activeWarehouses.find((warehouse) => warehouse.id === nInt(fromWarehouseId));
  const fromStock = sourceStocks.find((stock) => stock.warehouseId === nInt(fromWarehouseId));
  const availableQty = fromStock ? nInt(fromStock.quantity, 0) : 0;

  return (
    <div className="product-modal-overlay" onClick={() => !transferring && onClose()}>
      <div className="product-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
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
            {variants.length > 0 && (
              <label className="form-group">
                <span>المقاس / اللون</span>
                <select
                  className="form-select"
                  value={variantId}
                  onChange={(e) => {
                    setVariantId(e.target.value);
                    setFromWarehouseId('');
                    setToWarehouseId('');
                    setQuantity('');
                  }}
                  disabled={transferring || variants.length === 1}
                >
                  {variants.length > 1 ? <option value="">اختر المتغير</option> : null}
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {(variant.productSize || '-') + ' / ' + (variant.color || '-')} (إجمالي: {nInt(variant.quantity, 0)})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="form-group">
              <span>من المخزن</span>
              <select
                className="form-select"
                value={fromWarehouseId}
                onChange={(e) => {
                  setFromWarehouseId(e.target.value);
                  setQuantity('');
                }}
                disabled={transferring || (variants.length > 1 && !nInt(variantId))}
              >
                <option value="">اختر المخزن المصدر</option>
                {activeWarehouses.map((warehouse) => {
                  const stock = sourceStocks.find((entry) => entry.warehouseId === warehouse.id);
                  const qty = stock ? nInt(stock.quantity, 0) : 0;
                  return (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.icon || '🏭'} {warehouse.name} (المتاح: {qty})
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
                disabled={transferring || (variants.length > 1 && !nInt(variantId))}
              >
                <option value="">اختر المخزن الهدف</option>
                {activeWarehouses
                  .filter((warehouse) => warehouse.id !== nInt(fromWarehouseId))
                  .map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.icon || '🏭'} {warehouse.name}
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
                disabled={transferring || !fromWarehouseId || !toWarehouseId || nInt(quantity) <= 0 || (variants.length > 1 && !nInt(variantId))}
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
              <div style={{ display: 'grid', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                {transfers.map((transfer) => {
                  const fromWarehouseInfo = warehouses.find((warehouse) => warehouse.id === transfer.fromWarehouseId);
                  const toWarehouseInfo = warehouses.find((warehouse) => warehouse.id === transfer.toWarehouseId);
                  const variantLabel = transfer?.variant
                    ? `${transfer.variant.productSize || '-'} / ${transfer.variant.color || '-'}`
                    : 'كل المنتج';
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
                          {fromWarehouseInfo?.icon || '🏭'} {fromWarehouseInfo?.name || 'مخزن'} → {toWarehouseInfo?.icon || '🏭'} {toWarehouseInfo?.name || 'مخزن'}
                        </span>
                        <strong>{transfer.quantity}</strong>
                      </div>
                      <div style={{ marginTop: '4px', color: '#0f172a', fontSize: '0.8rem' }}>
                        المتغير: {variantLabel}
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

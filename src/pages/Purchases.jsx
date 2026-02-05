import React, { useState, useEffect } from 'react';
import { safeAlert } from '../utils/safeAlert';

export default function Purchases() {
    const [purchases, setPurchases] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [variants, setVariants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [paidAmount, setPaidAmount] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (searchTerm.trim()) {
            searchVariants();
        } else {
            loadVariants();
        }
    }, [searchTerm]);

    const loadData = async () => {
        try {
            await Promise.all([loadPurchases(), loadSuppliers(), loadVariants()]);
        } finally {
            setLoading(false);
        }
    };

    const loadPurchases = async () => {
        try {
            const data = await window.api.getPurchases();
            if (!data.error) setPurchases(data);
        } catch (err) {
            console.error('فشل تحميل المشتريات');
        }
    };

    const loadSuppliers = async () => {
        try {
            const data = await window.api.getSuppliers();
            if (!data.error) setSuppliers(data);
        } catch (err) {
            console.error('فشل تحميل الموردين');
        }
    };

    const loadVariants = async () => {
        try {
            const data = await window.api.getVariants();
            if (!data.error) setVariants(data);
        } catch (err) {
            console.error('فشل تحميل المنتجات');
        }
    };

    const searchVariants = async () => {
        try {
            const data = await window.api.searchVariants(searchTerm);
            if (!data.error) setVariants(data);
        } catch (err) {
            console.error('فشل البحث');
        }
    };

    const addToCart = (variant) => {
        const existingItem = cart.find(item => item.variantId === variant.id);

        if (existingItem) {
            setCart(cart.map(item =>
                item.variantId === variant.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, {
                variantId: variant.id,
                productName: variant.product.name,
                size: variant.productSize,
                color: variant.color,
                cost: variant.cost,
                quantity: 1
            }]);
        }
    };

    const updateQuantity = (variantId, newQuantity) => {
        if (newQuantity === 0) {
            setCart(cart.filter(item => item.variantId !== variantId));
        } else {
            setCart(cart.map(i =>
                i.variantId === variantId ? { ...i, quantity: newQuantity } : i
            ));
        }
    };

    const updateCost = (variantId, newCost) => {
        setCart(cart.map(item =>
            item.variantId === variantId
                ? { ...item, cost: parseFloat(newCost) || 0 }
                : item
        ));
    };

    const removeFromCart = (variantId) => {
        setCart(cart.filter(item => item.variantId !== variantId));
    };

    const getTotal = () => {
        return cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    };

    const handleSubmit = async () => {
        if (cart.length === 0) {
            safeAlert('السلة فارغة');
            return;
        }

        const purchaseData = {
            supplierId: selectedSupplier?.id,
            total: getTotal(),
            paid: parseFloat(paidAmount) || 0,
            items: cart.map(item => ({
                variantId: item.variantId,
                quantity: item.quantity,
                cost: item.cost
            }))
        };

        try {
            const result = await window.api.createPurchase(purchaseData);
            if (result.error) {
                safeAlert('خطأ: ' + result.error);
            } else {
                safeAlert('✅ تم حفظ فاتورة المشتريات بنجاح');
                setCart([]);
                setSelectedSupplier(null);
                setPaidAmount('');
                setShowModal(false);
                loadData();
            }
        } catch (err) {
            safeAlert('خطأ في الاتصال');
        }
    };

    if (loading) return <div>جاري التحميل...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h1>📥 فواتير المشتريات</h1>
                <button
                    onClick={() => setShowModal(true)}
                    style={{
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        padding: '10px 20px',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                    }}
                >
                    + فاتورة مشتريات جديدة
                </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                        <tr>
                            <th style={{ padding: '15px', textAlign: 'right' }}>رقم الفاتورة</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>المورد</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>الإجمالي</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>المدفوع</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>المتبقي</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>التاريخ</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>عدد الأصناف</th>
                        </tr>
                    </thead>
                    <tbody>
                        {purchases.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>
                                    لا توجد فواتير مشتريات
                                </td>
                            </tr>
                        ) : (
                            purchases.map((purchase) => (
                                <tr key={purchase.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '15px' }}>#{purchase.id}</td>
                                    <td style={{ padding: '15px' }}>{purchase.supplier?.name || 'غير محدد'}</td>
                                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#3b82f6' }}>
                                        {purchase.total.toFixed(2)} ج.م
                                    </td>
                                    <td style={{ padding: '15px', color: '#10b981' }}>
                                        {purchase.paid.toFixed(2)} ج.م
                                    </td>
                                    <td style={{ padding: '15px', color: '#ef4444' }}>
                                        {(purchase.total - purchase.paid).toFixed(2)} ج.م
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        {new Date(purchase.createdAt).toLocaleDateString('ar-EG')}
                                    </td>
                                    <td style={{ padding: '15px', textAlign: 'center' }}>{purchase.items.length}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* New Purchase Modal */}
            {showModal && (
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
                    onClick={() => setShowModal(false)}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            padding: '30px',
                            width: '90%',
                            maxWidth: '1000px',
                            maxHeight: '90vh',
                            overflowY: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ marginBottom: '20px' }}>فاتورة مشتريات جديدة</h2>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>المورد</label>
                            <select
                                value={selectedSupplier?.id || ''}
                                onChange={(e) => {
                                    const supplier = suppliers.find(s => s.id === parseInt(e.target.value));
                                    setSelectedSupplier(supplier || null);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db'
                                }}
                            >
                                <option value="">اختر مورد (اختياري)</option>
                                {suppliers.map(supplier => (
                                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <input
                                type="text"
                                placeholder="🔍 ابحث عن منتج..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db'
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px', maxHeight: '200px', overflowY: 'auto' }}>
                            {variants.slice(0, 20).map(variant => (
                                <div
                                    key={variant.id}
                                    onClick={() => addToCart(variant)}
                                    style={{
                                        backgroundColor: '#f9fafb',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        border: '1px solid #e5e7eb',
                                        fontSize: '13px'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{variant.product.name}</div>
                                    <div style={{ color: '#6b7280', fontSize: '11px' }}>{variant.productSize} - {variant.color}</div>
                                </div>
                            ))}
                        </div>

                        {cart.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <h3>الأصناف المختارة:</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: '#f9fafb' }}>
                                        <tr>
                                            <th style={{ padding: '10px', textAlign: 'right' }}>المنتج</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>الكمية</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>سعر التكلفة</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>الإجمالي</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>حذف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cart.map(item => (
                                            <tr key={item.variantId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                <td style={{ padding: '10px' }}>
                                                    {item.productName} ({item.size} - {item.color})
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => updateQuantity(item.variantId, parseInt(e.target.value) || 1)}
                                                        style={{ width: '60px', padding: '5px', textAlign: 'center' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.cost}
                                                        onChange={(e) => updateCost(item.variantId, e.target.value)}
                                                        style={{ width: '80px', padding: '5px', textAlign: 'center' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                                                    {(item.cost * item.quantity).toFixed(2)} ج.م
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => removeFromCart(item.variantId)}
                                                        style={{
                                                            backgroundColor: '#ef4444',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '5px 10px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        حذف
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>المبلغ المدفوع</label>
                            <input
                                type="number"
                                step="0.01"
                                value={paidAmount}
                                onChange={(e) => setPaidAmount(e.target.value)}
                                placeholder="0.00"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db'
                                }}
                            />
                        </div>

                        <div style={{
                            padding: '15px',
                            backgroundColor: '#f0f9ff',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            fontSize: '18px',
                            fontWeight: 'bold'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>الإجمالي:</span>
                                <span style={{ color: '#3b82f6' }}>{getTotal().toFixed(2)} ج.م</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleSubmit}
                                disabled={cart.length === 0}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    backgroundColor: cart.length === 0 ? '#9ca3af' : '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                حفظ الفاتورة
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    backgroundColor: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


import React, { useState, useEffect } from 'react';

export default function Returns() {
    const [returns, setReturns] = useState([]);
    const [sales, setSales] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [returnItems, setReturnItems] = useState([]);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            await Promise.all([loadReturns(), loadSales(), loadCustomers()]);
        } finally {
            setLoading(false);
        }
    };

    const loadReturns = async () => {
        try {
            const data = await window.api.getReturns();
            if (!data.error) setReturns(data);
        } catch (err) {
            console.error('فشل تحميل المرتجعات');
        }
    };

    const loadSales = async () => {
        try {
            const data = await window.api.getSales();
            if (!data.error) setSales(data);
        } catch (err) {
            console.error('فشل تحميل المبيعات');
        }
    };

    const loadCustomers = async () => {
        try {
            const data = await window.api.getCustomers();
            if (!data.error) setCustomers(data);
        } catch (err) {
            console.error('فشل تحميل العملاء');
        }
    };

    const handleSaleChange = (saleId) => {
        const sale = sales.find(s => s.id === parseInt(saleId));
        setSelectedSale(sale);
        setSelectedCustomer(sale?.customer || null);

        if (sale) {
            setReturnItems(sale.items.map(item => ({
                variantId: item.variantId,
                productName: item.variant.product.name,
                size: item.variant.productSize,
                color: item.variant.color,
                price: item.price,
                maxQuantity: item.quantity,
                quantity: 0
            })));
        }
    };

    const updateReturnQuantity = (variantId, quantity) => {
        setReturnItems(returnItems.map(item =>
            item.variantId === variantId
                ? { ...item, quantity: Math.min(Math.max(0, quantity), item.maxQuantity) }
                : item
        ));
    };

    const getTotal = () => {
        return returnItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const handleSubmit = async () => {
        const itemsToReturn = returnItems.filter(item => item.quantity > 0);

        if (itemsToReturn.length === 0) {
            alert('لم يتم تحديد أي كميات للمرتجع');
            return;
        }

        const returnData = {
            saleId: selectedSale?.id,
            customerId: selectedCustomer?.id,
            total: getTotal(),
            notes,
            items: itemsToReturn.map(item => ({
                variantId: item.variantId,
                quantity: item.quantity,
                price: item.price
            }))
        };

        try {
            const result = await window.api.createReturn(returnData);
            if (result.error) {
                alert('خطأ: ' + result.error);
            } else {
                alert('✅ تم حفظ المرتجع بنجاح');
                setShowModal(false);
                setSelectedSale(null);
                setSelectedCustomer(null);
                setReturnItems([]);
                setNotes('');
                loadData();
            }
        } catch (err) {
            alert('خطأ في الاتصال');
        }
    };

    if (loading) return <div>جاري التحميل...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h1>↩️ المرتجعات</h1>
                <button
                    onClick={() => setShowModal(true)}
                    style={{
                        backgroundColor: '#f59e0b',
                        color: 'white',
                        padding: '10px 20px',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                    }}
                >
                    + مرتجع جديد
                </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                        <tr>
                            <th style={{ padding: '15px', textAlign: 'right' }}>رقم المرتجع</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>رقم الفاتورة</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>العميل</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>المبلغ</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>التاريخ</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>عدد الأصناف</th>
                        </tr>
                    </thead>
                    <tbody>
                        {returns.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>
                                    لا توجد مرتجعات
                                </td>
                            </tr>
                        ) : (
                            returns.map((returnItem) => (
                                <tr key={returnItem.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '15px' }}>#{returnItem.id}</td>
                                    <td style={{ padding: '15px' }}>
                                        {returnItem.saleId ? `#${returnItem.saleId}` : '-'}
                                    </td>
                                    <td style={{ padding: '15px' }}>{returnItem.customer?.name || '-'}</td>
                                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#f59e0b' }}>
                                        {returnItem.total.toFixed(2)} ج.م
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        {new Date(returnItem.createdAt).toLocaleDateString('ar-EG')}
                                    </td>
                                    <td style={{ padding: '15px', textAlign: 'center' }}>{returnItem.items.length}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* New Return Modal */}
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
                            maxWidth: '800px',
                            maxHeight: '90vh',
                            overflowY: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ marginBottom: '20px' }}>مرتجع جديد</h2>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>رقم الفاتورة (اختياري)</label>
                            <select
                                value={selectedSale?.id || ''}
                                onChange={(e) => handleSaleChange(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db'
                                }}
                            >
                                <option value="">اختر فاتورة</option>
                                {sales.map(sale => (
                                    <option key={sale.id} value={sale.id}>
                                        #{sale.id} - {new Date(sale.createdAt).toLocaleDateString('ar-EG')} - {sale.total.toFixed(2)} ج.م
                                    </option>
                                ))}
                            </select>
                        </div>

                        {!selectedSale && (
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>العميل</label>
                                <select
                                    value={selectedCustomer?.id || ''}
                                    onChange={(e) => {
                                        const customer = customers.find(c => c.id === parseInt(e.target.value));
                                        setSelectedCustomer(customer || null);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db'
                                    }}
                                >
                                    <option value="">غير محدد</option>
                                    {customers.map(customer => (
                                        <option key={customer.id} value={customer.id}>{customer.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {selectedSale && returnItems.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ marginBottom: '10px' }}>أصناف الفاتورة:</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: '#f9fafb' }}>
                                        <tr>
                                            <th style={{ padding: '10px', textAlign: 'right' }}>المنتج</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>الكمية الأصلية</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>كمية المرتجع</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>السعر</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>الإجمالي</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {returnItems.map(item => (
                                            <tr key={item.variantId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                <td style={{ padding: '10px' }}>
                                                    {item.productName} ({item.size} - {item.color})
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>{item.maxQuantity}</td>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={item.maxQuantity}
                                                        value={item.quantity}
                                                        onChange={(e) => updateReturnQuantity(item.variantId, parseInt(e.target.value) || 0)}
                                                        style={{ width: '60px', padding: '5px', textAlign: 'center' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                                    {item.price.toFixed(2)} ج.م
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                                                    {(item.price * item.quantity).toFixed(2)} ج.م
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>ملاحظات</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows="3"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        <div style={{
                            padding: '15px',
                            backgroundColor: '#fffbeb',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            fontSize: '18px',
                            fontWeight: 'bold'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>إجمالي المرتجع:</span>
                                <span style={{ color: '#f59e0b' }}>{getTotal().toFixed(2)} ج.م</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleSubmit}
                                disabled={getTotal() === 0}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    backgroundColor: getTotal() === 0 ? '#9ca3af' : '#f59e0b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: getTotal() === 0 ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                حفظ المرتجع
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

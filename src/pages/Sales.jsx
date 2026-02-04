import React, { useState, useEffect } from 'react';

export default function Sales() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSale, setSelectedSale] = useState(null);

    useEffect(() => {
        loadSales();
    }, []);

    const loadSales = async () => {
        try {
            const data = await window.api.getSales();
            if (!data.error) {
                setSales(data);
            }
        } catch (err) {
            console.error('فشل تحميل المبيعات');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('ar-EG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getSaleDate = (sale) => sale.invoiceDate || sale.createdAt;

    if (loading) return <div>جاري التحميل...</div>;

    return (
        <div>
            <h1 style={{ marginBottom: '20px' }}>📋 سجل المبيعات</h1>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                        <tr>
                            <th style={{ padding: '15px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>رقم العملية</th>
                            <th style={{ padding: '15px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>التاريخ</th>
                            <th style={{ padding: '15px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>الإجمالي</th>
                            <th style={{ padding: '15px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>طريقة الدفع</th>
                            <th style={{ padding: '15px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>عدد المنتجات</th>
                            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>تفاصيل</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sales.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>
                                    لا توجد مبيعات بعد
                                </td>
                            </tr>
                        ) : (
                            sales.map((sale) => (
                                <tr key={sale.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '15px' }}>#{sale.id}</td>
                                    <td style={{ padding: '15px' }}>{formatDate(getSaleDate(sale))}</td>
                                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#10b981' }}>
                                        {sale.total.toFixed(2)} ج.م
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <span style={{
                                            backgroundColor: sale.payment === 'نقدي' ? '#dbeafe' : sale.payment === 'فيزا' ? '#fef3c7' : '#fee2e2',
                                            color: sale.payment === 'نقدي' ? '#1e40af' : sale.payment === 'فيزا' ? '#92400e' : '#991b1b',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '13px'
                                        }}>
                                            {sale.payment}
                                        </span>
                                    </td>
                                    <td style={{ padding: '15px' }}>{sale.items.length} منتجات</td>
                                    <td style={{ padding: '15px', textAlign: 'center' }}>
                                        <button
                                            onClick={() => setSelectedSale(sale)}
                                            style={{
                                                backgroundColor: '#2563eb',
                                                color: 'white',
                                                border: 'none',
                                                padding: '6px 16px',
                                                borderRadius: '6px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            عرض
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Sale Details Modal */}
            {selectedSale && (
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
                }}
                    onClick={() => setSelectedSale(null)}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            padding: '30px',
                            maxWidth: '600px',
                            width: '90%',
                            maxHeight: '80vh',
                            overflowY: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2>تفاصيل الفاتورة #{selectedSale.id}</h2>
                            <button
                                onClick={() => setSelectedSale(null)}
                                style={{
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                            <div style={{ marginBottom: '10px' }}>
                                <strong>التاريخ:</strong> {formatDate(getSaleDate(selectedSale))}
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                                <strong>طريقة الدفع:</strong> {selectedSale.payment}
                            </div>
                        </div>

                        <h3 style={{ marginBottom: '15px' }}>المنتجات:</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ backgroundColor: '#f9fafb' }}>
                                <tr>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>المنتج</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>الكمية</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>السعر</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedSale.items.map((item) => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '10px' }}>
                                            <div>{item.variant.product.name}</div>
                                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                {item.variant.productSize} - {item.variant.color}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>{item.quantity}</td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>{item.price.toFixed(2)} ج.م</td>
                                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                                            {(item.price * item.quantity).toFixed(2)} ج.م
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{
                            marginTop: '20px',
                            padding: '15px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '18px',
                            fontWeight: 'bold'
                        }}>
                            <span>الإجمالي الكلي:</span>
                            <span>{selectedSale.total.toFixed(2)} ج.م</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

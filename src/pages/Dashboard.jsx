import React, { useState, useEffect } from 'react';

export default function Dashboard({ token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, [token]);

  const loadStats = async () => {
    try {
      const result = await window.api.getDashboardStats(token);
      if (result.error) {
        setError(result.error);
      } else {
        setStats(result);
      }
    } catch (err) {
      setError('فشل تحميل البيانات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>جاري التحميل...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!stats) return <div>لا توجد بيانات</div>;

  return (
    <div>
      <h1>📊 لوحة التحكم</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginTop: '20px' }}>
        {/* البطاقات الإحصائية */}
        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>مبيعات اليوم</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>
            {stats.salesAmount.toFixed(2)} ج.م
          </div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
            {stats.salesCount} عملية
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>المصروفات اليوم</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>
            {stats.expensesAmount.toFixed(2)} ج.م
          </div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>مصروفات مسجلة</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>الربح</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#6366f1' }}>
            {(stats.salesAmount - stats.expensesAmount).toFixed(2)} ج.م
          </div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>اليوم</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>إجمالي المنتجات</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>
            {stats.productsCount}
          </div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>منتج في النظام</div>
        </div>
      </div>

      {/* منتجات قليلة المخزون */}
      {stats.lowStockVariants && stats.lowStockVariants.length > 0 && (
        <div className="card" style={{ marginTop: '30px' }}>
          <h2>⚠️ منتجات قليلة المخزون</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>المنتج</th>
                <th>الحجم</th>
                <th>اللون</th>
                <th>الكمية</th>
                <th>السعر</th>
              </tr>
            </thead>
            <tbody>
              {stats.lowStockVariants.map((variant, idx) => (
                <tr key={variant.id}>
                  <td>{idx + 1}</td>
                  <td>منتج {variant.productId}</td>
                  <td>{variant.size}</td>
                  <td>{variant.color}</td>
                  <td style={{ color: variant.quantity <= 3 ? '#ef4444' : '#f59e0b' }}>
                    <strong>{variant.quantity}</strong>
                  </td>
                  <td>{variant.price.toFixed(2)} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button className="btn-primary" style={{ marginTop: '30px' }} onClick={loadStats}>
        تحديث البيانات
      </button>
    </div>
  );
}

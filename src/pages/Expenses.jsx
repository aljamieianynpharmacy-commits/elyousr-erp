import React, { useState, useEffect } from 'react';

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ title: '', amount: '' });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const data = await window.api.getExpenses();
      if (!data.error) {
        setExpenses(data);
      }
    } catch (err) {
      console.error('فشل تحميل المصروفات');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await window.api.addExpense(formData);
      loadExpenses();
      setShowModal(false);
      setFormData({ title: '', amount: '' });
    } catch (err) {
      alert('خطأ في حفظ المصروف');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من الحذف؟')) {
      try {
        await window.api.deleteExpense(id);
        loadExpenses();
      } catch (err) {
        alert('خطأ في الحذف');
      }
    }
  };

  const getTotalExpenses = () => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1>💸 إدارة المصروفات</h1>
        <button
          onClick={() => {
            setShowModal(true);
            setFormData({ title: '', amount: '' });
          }}
          style={{
            backgroundColor: '#ef4444',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          + إضافة مصروف جديد
        </button>
      </div>

      <div className="card" style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#fef2f2' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>إجمالي المصروفات:</span>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
            {getTotalExpenses().toFixed(2)} ج.م
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#f9fafb' }}>
            <tr>
              <th style={{ padding: '15px', textAlign: 'right' }}>#</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>الوصف</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>المبلغ</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>التاريخ</th>
              <th style={{ padding: '15px', textAlign: 'center' }}>العمليات</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>
                  لا توجد مصروفات مسجلة
                </td>
              </tr>
            ) : (
              expenses.map((expense) => (
                <tr key={expense.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '15px' }}>{expense.id}</td>
                  <td style={{ padding: '15px' }}>{expense.title}</td>
                  <td style={{ padding: '15px', fontWeight: 'bold', color: '#ef4444' }}>
                    {expense.amount.toFixed(2)} ج.م
                  </td>
                  <td style={{ padding: '15px' }}>
                    {new Date(expense.createdAt).toLocaleDateString('ar-EG')}
                  </td>
                  <td style={{ padding: '15px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      style={{
                        color: '#ef4444',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
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
              width: '400px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px' }}>إضافة مصروف جديد</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>الوصف *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="مثال: فاتورة كهرباء"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db'
                  }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>المبلغ *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

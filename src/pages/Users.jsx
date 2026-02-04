import React, { useState, useEffect } from 'react';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'CASHIER'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await window.api.getUsers();
      if (!data.error) {
        setUsers(data);
      }
    } catch (err) {
      console.error('فشل تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const updateData = { ...formData };
        if (!updateData.password) delete updateData.password;
        await window.api.updateUser(editingUser.id, updateData);
      } else {
        await window.api.addUser(formData);
      }
      loadUsers();
      setShowModal(false);
      setFormData({ name: '', username: '', password: '', role: 'CASHIER' });
      setEditingUser(null);
    } catch (err) {
      alert('خطأ في حفظ البيانات');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({ name: user.name, username: user.username, password: '', role: user.role });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      try {
        await window.api.deleteUser(id);
        loadUsers();
      } catch (err) {
        alert('خطأ في الحذف');
      }
    }
  };

  const getRoleName = (role) => {
    const roles = {
      ADMIN: 'مدير',
      CASHIER: 'أمين صندوق',
      STOREKEEPER: 'أمين مخزن'
    };
    return roles[role] || role;
  };

  const getRoleColor = (role) => {
    const colors = {
      ADMIN: '#ef4444',
      CASHIER: '#3b82f6',
      STOREKEEPER: '#10b981'
    };
    return colors[role] || '#6b7280';
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1>👤 إدارة المستخدمين</h1>
        <button
          onClick={() => {
            setShowModal(true);
            setEditingUser(null);
            setFormData({ name: '', username: '', password: '', role: 'CASHIER' });
          }}
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          + إضافة مستخدم جديد
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#f9fafb' }}>
            <tr>
              <th style={{ padding: '15px', textAlign: 'right' }}>#</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>الاسم</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>اسم المستخدم</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>الصلاحية</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>تاريخ التسجيل</th>
              <th style={{ padding: '15px', textAlign: 'center' }}>العمليات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '15px' }}>{user.id}</td>
                <td style={{ padding: '15px' }}>{user.name}</td>
                <td style={{ padding: '15px' }}>{user.username}</td>
                <td style={{ padding: '15px' }}>
                  <span style={{
                    backgroundColor: getRoleColor(user.role) + '20',
                    color: getRoleColor(user.role),
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 'bold'
                  }}>
                    {getRoleName(user.role)}
                  </span>
                </td>
                <td style={{ padding: '15px' }}>
                  {new Date(user.createdAt).toLocaleDateString('ar-EG')}
                </td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  <button
                    onClick={() => handleEdit(user)}
                    style={{
                      color: '#2563eb',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      marginLeft: '10px'
                    }}
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
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
            ))}
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
            <h2 style={{ marginBottom: '20px' }}>
              {editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>الاسم *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db'
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>اسم المستخدم *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required={!editingUser}
                  disabled={editingUser}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    backgroundColor: editingUser ? '#f3f4f6' : 'white'
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  كلمة المرور {!editingUser && '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                  placeholder={editingUser ? 'اتركها فارغة إذا لم ترد التغيير' : ''}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db'
                  }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>الصلاحية *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db'
                  }}
                >
                  <option value="ADMIN">مدير</option>
                  <option value="CASHIER">أمين صندوق</option>
                  <option value="STOREKEEPER">أمين مخزن</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#2563eb',
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

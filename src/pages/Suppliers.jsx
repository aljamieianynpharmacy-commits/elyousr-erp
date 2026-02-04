import React, { useState, useEffect } from 'react';

export default function Suppliers() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '' });

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async () => {
        try {
            const data = await window.api.getSuppliers();
            if (!data.error) {
                setSuppliers(data);
            }
        } catch (err) {
            console.error('فشل تحميل الموردين');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingSupplier) {
                await window.api.updateSupplier(editingSupplier.id, formData);
            } else {
                await window.api.addSupplier(formData);
            }
            loadSuppliers();
            setShowModal(false);
            setFormData({ name: '', phone: '' });
            setEditingSupplier(null);
        } catch (err) {
            alert('خطأ في حفظ البيانات');
        }
    };

    const handleEdit = (supplier) => {
        setEditingSupplier(supplier);
        setFormData({ name: supplier.name, phone: supplier.phone || '' });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (confirm('هل أنت متأكد من الحذف؟')) {
            try {
                await window.api.deleteSupplier(id);
                loadSuppliers();
            } catch (err) {
                alert('خطأ في الحذف');
            }
        }
    };

    if (loading) return <div>جاري التحميل...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h1>🚚 إدارة الموردين</h1>
                <button
                    onClick={() => {
                        setShowModal(true);
                        setEditingSupplier(null);
                        setFormData({ name: '', phone: '' });
                    }}
                    style={{
                        backgroundColor: '#10b981',
                        color: 'white',
                        padding: '10px 20px',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                    }}
                >
                    + إضافة مورد جديد
                </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                        <tr>
                            <th style={{ padding: '15px', textAlign: 'right' }}>#</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>اسم المورد</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>رقم الهاتف</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>تاريخ التسجيل</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>العمليات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {suppliers.map((supplier) => (
                            <tr key={supplier.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '15px' }}>{supplier.id}</td>
                                <td style={{ padding: '15px' }}>{supplier.name}</td>
                                <td style={{ padding: '15px' }}>{supplier.phone || '-'}</td>
                                <td style={{ padding: '15px' }}>
                                    {new Date(supplier.createdAt).toLocaleDateString('ar-EG')}
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                    <button
                                        onClick={() => handleEdit(supplier)}
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
                                        onClick={() => handleDelete(supplier.id)}
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
                            {editingSupplier ? 'تعديل مورد' : 'إضافة مورد جديد'}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>اسم المورد *</label>
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
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>رقم الهاتف</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                                        backgroundColor: '#10b981',
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

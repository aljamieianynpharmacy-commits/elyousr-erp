import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Save } from 'lucide-react';

export default function UnitManagerModal({ isOpen, onClose, units, onUpdateUnits }) {
    const [editingIndex, setEditingIndex] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [newValue, setNewValue] = useState('');

    if (!isOpen) return null;

    const handleAdd = () => {
        const val = String(newValue || '').trim();
        if (!val) return;
        if (units.some(u => u.toLowerCase() === val.toLowerCase())) return;

        const nextUnits = [...units, val];
        onUpdateUnits(nextUnits);
        setNewValue('');
    };

    const handleSaveEdit = (index) => {
        const val = String(editValue || '').trim();
        if (!val) return;

        if (units.some((u, i) => i !== index && u.toLowerCase() === val.toLowerCase())) return;

        const nextUnits = [...units];
        nextUnits[index] = val;
        onUpdateUnits(nextUnits);
        setEditingIndex(null);
    };

    const handleDelete = (index) => {
        const nextUnits = units.filter((_, i) => i !== index);
        onUpdateUnits(nextUnits);
    };

    return (
        <div className="product-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            <div className="product-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="product-modal-header">
                    <div>
                        <h2>إدارة الوحدات</h2>
                        <p>إضافة، تعديل، وحذف الوحدات</p>
                    </div>
                    <button type="button" className="close-button" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="product-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="field-with-button">
                        <input
                            type="text"
                            className="form-input"
                            placeholder="اسم الوحدة الجديدة..."
                            value={newValue}
                            onChange={e => setNewValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        />
                        <button type="button" className="btn-save" onClick={handleAdd} style={{ width: 'auto' }}>
                            <Plus size={16} /> إضافة
                        </button>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                        {units.map((u, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderBottom: index < units.length - 1 ? '1px solid #e2e8f0' : 'none', backgroundColor: index % 2 === 0 ? '#fafafa' : '#fff' }}>
                                {editingIndex === index ? (
                                    <div className="field-with-button" style={{ flex: 1, marginRight: '8px' }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={editValue}
                                            onChange={e => setEditValue(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSaveEdit(index)}
                                            autoFocus
                                        />
                                        <button type="button" className="btn-icon" onClick={() => handleSaveEdit(index)} style={{ color: '#10b981' }}>
                                            <Save size={16} />
                                        </button>
                                        <button type="button" className="btn-icon" onClick={() => setEditingIndex(null)}>
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <span style={{ fontWeight: '500' }}>{u}</span>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button type="button" className="btn-icon" onClick={() => { setEditingIndex(index); setEditValue(u); }}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button type="button" className="btn-icon" onClick={() => handleDelete(index)} style={{ color: '#ef4444' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        {units.length === 0 && (
                            <div style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                                لا توجد وحدات
                            </div>
                        )}
                    </div>
                </div>

                <div className="product-modal-footer">
                    <button type="button" className="btn-cancel" onClick={onClose}>إغلاق</button>
                </div>
            </div>
        </div>
    );
}

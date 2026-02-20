import React, { useState } from 'react';
import { DEFAULT_CATEGORY } from '../../utils/productUtils';

export default function CategoryModal({ isOpen, onClose, categories, onSave, onDelete }) {
    const [categoryForm, setCategoryForm] = useState(DEFAULT_CATEGORY);

    if (!isOpen) return null;

    const handleSave = async () => {
        await onSave(categoryForm);
        setCategoryForm(DEFAULT_CATEGORY);
    };

    return (
        <div className="products-modal-backdrop" onClick={onClose}>
            <div className="products-modal" onClick={(e) => e.stopPropagation()}>
                <header>
                    <h2>إدارة الفئات</h2>
                    <button type="button" className="icon-btn" onClick={onClose}>✕</button>
                </header>

                <section className="products-modal-body">
                    <div className="form-grid two-cols">
                        <label>
                            اسم الفئة
                            <input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} />
                        </label>
                        <label>
                            الوصف
                            <input type="text" value={categoryForm.description} onChange={(e) => setCategoryForm((p) => ({ ...p, description: e.target.value }))} />
                        </label>
                        <label>
                            اللون
                            <input type="color" value={categoryForm.color} onChange={(e) => setCategoryForm((p) => ({ ...p, color: e.target.value }))} />
                        </label>
                        <label>
                            الأيقونة
                            <input type="text" value={categoryForm.icon} onChange={(e) => setCategoryForm((p) => ({ ...p, icon: e.target.value }))} />
                        </label>
                    </div>

                    <button type="button" className="products-btn products-btn-primary" onClick={handleSave}>➕ إضافة فئة</button>

                    <div className="category-list">
                        {categories.length === 0 ? (
                            <div className="products-empty">لا توجد فئات</div>
                        ) : categories.map((c) => (
                            <article className="category-row" key={c.id}>
                                <div><strong>{c.icon || '📦'} {c.name}</strong><small>{c.description || 'بدون وصف'}</small></div>
                                <button type="button" className="icon-btn danger" onClick={() => onDelete(c.id, c.name)}>🗑️</button>
                            </article>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

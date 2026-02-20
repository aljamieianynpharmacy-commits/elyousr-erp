import React, { useMemo } from 'react';
import { nText } from '../../utils/productUtils';
import { IMPORT_FIELD_OPTIONS } from '../../utils/importUtils';

/**
 * ImportModal — Presentational component.
 * State (session, mapping) is managed by the parent.
 */
export default function ImportModal({
    session,
    importing,
    onClose,
    onUpdateFieldMapping,
    onApplyAutoMapping,
    onStartImport
}) {
    if (!session) return null;

    const importColumnSamples = useMemo(() => {
        const sampleMap = new Map();
        if (!session?.headers?.length || !session?.rows?.length) return sampleMap;

        const previewRows = session.rows.slice(0, 120);
        session.headers.forEach((header) => {
            for (const row of previewRows) {
                const value = nText(row[header.index]);
                if (value) {
                    sampleMap.set(header.id, value.slice(0, 120));
                    break;
                }
            }
        });

        return sampleMap;
    }, [session]);

    return (
        <div className="products-modal-backdrop" onClick={onClose}>
            <div className="products-modal products-import-modal" onClick={(e) => e.stopPropagation()}>
                <header>
                    <div className="products-import-headline">
                        <h2>مطابقة أعمدة الاستيراد</h2>
                        <p>{session.fileName} | {session.rows.length} صف</p>
                    </div>
                    <button type="button" className="icon-btn" onClick={onClose} disabled={importing}>
                        ✕
                    </button>
                </header>

                <section className="products-modal-body">
                    <div className="import-mapping-meta">
                        <span>عدد الأعمدة: <strong>{session.headers.length}</strong></span>
                        <span>عدد الصفوف: <strong>{session.rows.length}</strong></span>
                    </div>
                    <p className="import-mapping-note">
                        اختَر لكل حقل العمود المناسب من ملف Excel. الحقول غير المطلوبة يمكنك تركها على "تجاهل هذا الحقل".
                    </p>

                    <div className="import-mapping-grid">
                        {IMPORT_FIELD_OPTIONS.map((field) => {
                            const selectedColumn = session.mapping?.[field.key] ?? '';
                            const sampleValue = selectedColumn ? importColumnSamples.get(selectedColumn) : '';

                            return (
                                <label key={field.key} className={`import-mapping-row ${field.required ? 'required' : ''}`}>
                                    <span className="import-mapping-label">
                                        {field.label}
                                        {field.required ? ' *' : ''}
                                    </span>
                                    <select
                                        value={selectedColumn}
                                        onChange={(e) => onUpdateFieldMapping(field.key, e.target.value)}
                                        disabled={importing}
                                    >
                                        <option value="">{field.required ? 'اختر عمودًا...' : 'تجاهل هذا الحقل'}</option>
                                        {session.headers.map((header) => (
                                            <option key={`${field.key}-${header.id}`} value={header.id}>
                                                {header.label}
                                            </option>
                                        ))}
                                    </select>
                                    <small className="import-mapping-sample">
                                        {sampleValue ? `مثال: ${sampleValue}` : 'بدون معاينة'}
                                    </small>
                                </label>
                            );
                        })}
                    </div>
                </section>

                <footer className="products-modal-footer">
                    <button type="button" className="products-btn products-btn-light" onClick={onApplyAutoMapping} disabled={importing}>
                        مطابقة تلقائية
                    </button>
                    <div className="products-modal-footer-actions">
                        <button type="button" className="products-btn products-btn-light" onClick={onClose} disabled={importing}>
                            إلغاء
                        </button>
                        <button type="button" className="products-btn products-btn-primary" onClick={onStartImport} disabled={importing}>
                            {importing ? 'جاري الاستيراد...' : 'بدء الاستيراد'}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}

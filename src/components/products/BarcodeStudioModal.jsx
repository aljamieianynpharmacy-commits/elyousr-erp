import React, { useMemo } from 'react';
import { nText } from '../../utils/productUtils';
import {
    BARCODE_FORMAT_OPTIONS,
    BARCODE_CODE_SOURCE_OPTIONS,
    BARCODE_LABEL_PRESETS,
    BARCODE_STUDIO_TABS,
    isMatrixBarcodeFormat
} from '../../utils/barcodeUtils';

/**
 * BarcodeStudioModal — Presentational component.
 * All state is managed by the parent (Products) and passed via props.
 */
export default function BarcodeStudioModal({
    barcodeStudioProducts,
    barcodeStudioRows,
    barcodeStudioSafeSettings,
    barcodeStudioTab,
    setBarcodeStudioTab,
    barcodePrinting,
    barcodePreview,
    barcodePreviewIsMatrix,
    matrixBarcodeEngineLoading,
    matrixBarcodeEngineError,
    // Template props
    barcodeTemplates,
    activeBarcodeTemplateId,
    activeBarcodeTemplate,
    barcodeTemplateName,
    setBarcodeTemplateName,
    barcodeTemplatePrinter,
    setBarcodeTemplatePrinter,
    // Handlers
    setBarcodeSetting,
    setBarcodeNumberSetting,
    applyBarcodePreset,
    applyBarcodeTemplate,
    saveNewBarcodeTemplate,
    updateBarcodeTemplate,
    deleteBarcodeTemplate,
    resetBarcodeStudioSettings,
    closeBarcodeStudio,
    executeBarcodeStudioPrint,
    executeBarcodeStudioPdfExport
}) {
    const activeBarcodeStudioTab = useMemo(
        () => BARCODE_STUDIO_TABS.find((tab) => tab.id === barcodeStudioTab) || BARCODE_STUDIO_TABS[0],
        [barcodeStudioTab]
    );

    return (
        <div className="products-modal-backdrop" onClick={closeBarcodeStudio}>
            <div className="products-modal products-barcode-studio-modal" onClick={(e) => e.stopPropagation()}>
                <header>
                    <div className="products-import-headline">
                        <h2>استوديو الباركود</h2>
                        <p>{barcodeStudioProducts.length} منتج | {barcodeStudioRows.length} ملصق أساسي قبل التكرار</p>
                    </div>
                    <button type="button" className="icon-btn" onClick={closeBarcodeStudio} disabled={barcodePrinting}>
                        ✕
                    </button>
                </header>

                <section className="products-modal-body barcode-studio-body">
                    <div className="barcode-studio-config">
                        <div className="barcode-studio-tabs-shell">
                            <div className="barcode-studio-tabs" role="tablist" aria-label="أقسام إعدادات الباركود">
                                {BARCODE_STUDIO_TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={barcodeStudioTab === tab.id}
                                        className={`barcode-studio-tab-btn ${barcodeStudioTab === tab.id ? 'active' : ''}`}
                                        onClick={() => setBarcodeStudioTab(tab.id)}
                                        disabled={barcodePrinting}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            <p className="barcode-studio-tab-hint">{activeBarcodeStudioTab.hint}</p>
                            <div className="barcode-studio-quick-stats">
                                <span>الصيغة: <strong>{barcodeStudioSafeSettings.format}</strong></span>
                                <span>المقاس: <strong>{barcodeStudioSafeSettings.labelWidthMm}×{barcodeStudioSafeSettings.labelHeightMm} مم</strong></span>
                                <span>الشبكة: <strong>{barcodeStudioSafeSettings.columns} عمود / {barcodeStudioSafeSettings.copiesPerItem} نسخة</strong></span>
                                <span>القالب: <strong>{activeBarcodeTemplate?.name || 'مخصص'}</strong></span>
                            </div>
                        </div>

                        {/* Templates tab */}
                        {barcodeStudioTab === 'templates' ? (
                            <div className="barcode-studio-section">
                                <h3>قوالب الطباعة المحفوظة</h3>
                                <div className="barcode-studio-grid two">
                                    <label>
                                        القالب المحفوظ
                                        <select
                                            value={activeBarcodeTemplateId}
                                            onChange={(e) => applyBarcodeTemplate(e.target.value)}
                                            disabled={barcodePrinting}
                                        >
                                            <option value="">بدون قالب محفوظ</option>
                                            {barcodeTemplates.map((template) => (
                                                <option key={template.id} value={template.id}>
                                                    {template.name}{template.printer ? ` | ${template.printer}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        اسم الطابعة
                                        <input
                                            type="text"
                                            maxLength={80}
                                            placeholder="مثال: Zebra ZD220"
                                            value={barcodeTemplatePrinter}
                                            onChange={(e) => setBarcodeTemplatePrinter(e.target.value)}
                                            disabled={barcodePrinting}
                                        />
                                    </label>
                                    <label className="barcode-template-name-field">
                                        اسم القالب
                                        <input
                                            type="text"
                                            maxLength={80}
                                            placeholder="مثال: 50x30 مخزن"
                                            value={barcodeTemplateName}
                                            onChange={(e) => setBarcodeTemplateName(e.target.value)}
                                            disabled={barcodePrinting}
                                        />
                                    </label>
                                </div>
                                <div className="barcode-template-actions">
                                    <button type="button" className="products-btn products-btn-light" onClick={saveNewBarcodeTemplate} disabled={barcodePrinting}>
                                        حفظ كقالب جديد
                                    </button>
                                    <button type="button" className="products-btn products-btn-light" onClick={updateBarcodeTemplate} disabled={barcodePrinting || !activeBarcodeTemplateId}>
                                        تحديث القالب الحالي
                                    </button>
                                    <button type="button" className="products-btn products-btn-light" onClick={deleteBarcodeTemplate} disabled={barcodePrinting || !activeBarcodeTemplateId}>
                                        حذف القالب
                                    </button>
                                </div>
                                {activeBarcodeTemplate ? (
                                    <p className="barcode-template-note">
                                        آخر تحديث: {new Date(activeBarcodeTemplate.updatedAt).toLocaleString('ar-EG')}
                                    </p>
                                ) : (
                                    <p className="barcode-template-note">
                                        احفظ الإعدادات الحالية كقالب لاستخدامها لاحقًا حسب المقاس والطابعة.
                                    </p>
                                )}
                            </div>
                        ) : null}

                        {/* Source tab */}
                        {barcodeStudioTab === 'source' ? (
                            <div className="barcode-studio-section">
                                <h3>نوع الكود ومصدره</h3>
                                <div className="barcode-studio-grid two">
                                    <label>
                                        نوع الباركود
                                        <select value={barcodeStudioSafeSettings.format} onChange={(e) => setBarcodeSetting('format', e.target.value)} disabled={barcodePrinting}>
                                            {BARCODE_FORMAT_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        مصدر الكود
                                        <select value={barcodeStudioSafeSettings.codeSource} onChange={(e) => setBarcodeSetting('codeSource', e.target.value)} disabled={barcodePrinting}>
                                            {BARCODE_CODE_SOURCE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            </div>
                        ) : null}

                        {/* Layout tab */}
                        {barcodeStudioTab === 'layout' ? (
                            <div className="barcode-studio-section">
                                <h3>مقاس الملصق والتخطيط</h3>
                                <div className="barcode-studio-grid three">
                                    <label>
                                        قالب المقاس
                                        <select value={barcodeStudioSafeSettings.presetId} onChange={(e) => applyBarcodePreset(e.target.value)} disabled={barcodePrinting}>
                                            {BARCODE_LABEL_PRESETS.map((preset) => (
                                                <option key={preset.id} value={preset.id}>{preset.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        عرض الملصق (مم)
                                        <input
                                            type="number" min="20" max="120" step="1"
                                            value={barcodeStudioSafeSettings.labelWidthMm}
                                            onChange={(e) => {
                                                setBarcodeSetting('presetId', 'custom');
                                                setBarcodeNumberSetting('labelWidthMm', e.target.value, 20, 120);
                                            }}
                                            disabled={barcodePrinting}
                                        />
                                    </label>
                                    <label>
                                        ارتفاع الملصق (مم)
                                        <input
                                            type="number" min="15" max="90" step="1"
                                            value={barcodeStudioSafeSettings.labelHeightMm}
                                            onChange={(e) => {
                                                setBarcodeSetting('presetId', 'custom');
                                                setBarcodeNumberSetting('labelHeightMm', e.target.value, 15, 90);
                                            }}
                                            disabled={barcodePrinting}
                                        />
                                    </label>
                                    <label>
                                        عدد الأعمدة
                                        <input type="number" min="1" max="8" step="1" value={barcodeStudioSafeSettings.columns} onChange={(e) => setBarcodeNumberSetting('columns', e.target.value, 1, 8)} disabled={barcodePrinting} />
                                    </label>
                                    <label>
                                        نسخ لكل ملصق
                                        <input type="number" min="1" max="50" step="1" value={barcodeStudioSafeSettings.copiesPerItem} onChange={(e) => setBarcodeNumberSetting('copiesPerItem', e.target.value, 1, 50)} disabled={barcodePrinting} />
                                    </label>
                                    <label>
                                        هامش الصفحة (مم)
                                        <input type="number" min="0" max="20" step="0.5" value={barcodeStudioSafeSettings.pageMarginMm} onChange={(e) => setBarcodeNumberSetting('pageMarginMm', e.target.value, 0, 20)} disabled={barcodePrinting} />
                                    </label>
                                </div>
                            </div>
                        ) : null}

                        {/* Design tab */}
                        {barcodeStudioTab === 'design' ? (
                            <div className="barcode-studio-section">
                                <h3>تصميم الباركود</h3>
                                <div className="barcode-studio-grid three">
                                    <label>
                                        ارتفاع الباركود (مم)
                                        <input type="number" min="6" max="40" step="0.5" value={barcodeStudioSafeSettings.barcodeHeightMm} onChange={(e) => setBarcodeNumberSetting('barcodeHeightMm', e.target.value, 6, 40)} disabled={barcodePrinting} />
                                    </label>
                                    <label>
                                        عرض الخط (px)
                                        <input type="number" min="1" max="6" step="0.1" value={barcodeStudioSafeSettings.barcodeWidthPx} onChange={(e) => setBarcodeNumberSetting('barcodeWidthPx', e.target.value, 1, 6)} disabled={barcodePrinting} />
                                    </label>
                                    <label>
                                        Padding داخلي (مم)
                                        <input type="number" min="0" max="10" step="0.5" value={barcodeStudioSafeSettings.paddingMm} onChange={(e) => setBarcodeNumberSetting('paddingMm', e.target.value, 0, 10)} disabled={barcodePrinting} />
                                    </label>
                                    <label>
                                        مسافة أفقية (مم)
                                        <input type="number" min="0" max="20" step="0.5" value={barcodeStudioSafeSettings.gapXMm} onChange={(e) => setBarcodeNumberSetting('gapXMm', e.target.value, 0, 20)} disabled={barcodePrinting} />
                                    </label>
                                    <label>
                                        مسافة رأسية (مم)
                                        <input type="number" min="0" max="20" step="0.5" value={barcodeStudioSafeSettings.gapYMm} onChange={(e) => setBarcodeNumberSetting('gapYMm', e.target.value, 0, 20)} disabled={barcodePrinting} />
                                    </label>
                                    <label>
                                        محاذاة النص
                                        <select value={barcodeStudioSafeSettings.textAlign} onChange={(e) => setBarcodeSetting('textAlign', e.target.value)} disabled={barcodePrinting}>
                                            <option value="center">وسط</option>
                                            <option value="right">يمين</option>
                                            <option value="left">يسار</option>
                                        </select>
                                    </label>
                                    <label>
                                        حجم اسم المنتج
                                        <input type="number" min="8" max="22" step="1" value={barcodeStudioSafeSettings.nameFontPx} onChange={(e) => setBarcodeNumberSetting('nameFontPx', e.target.value, 8, 22)} disabled={barcodePrinting} />
                                    </label>
                                    <label>
                                        حجم البيانات الصغيرة
                                        <input type="number" min="7" max="18" step="1" value={barcodeStudioSafeSettings.metaFontPx} onChange={(e) => setBarcodeNumberSetting('metaFontPx', e.target.value, 7, 18)} disabled={barcodePrinting} />
                                    </label>
                                    <label>
                                        حجم السعر
                                        <input type="number" min="8" max="22" step="1" value={barcodeStudioSafeSettings.priceFontPx} onChange={(e) => setBarcodeNumberSetting('priceFontPx', e.target.value, 8, 22)} disabled={barcodePrinting} />
                                    </label>
                                    <label>
                                        لون الباركود
                                        <input type="color" value={barcodeStudioSafeSettings.lineColor} onChange={(e) => setBarcodeSetting('lineColor', e.target.value)} disabled={barcodePrinting} />
                                    </label>
                                    <label>
                                        خلفية الملصق
                                        <input type="color" value={barcodeStudioSafeSettings.cardBackground} onChange={(e) => setBarcodeSetting('cardBackground', e.target.value)} disabled={barcodePrinting} />
                                    </label>
                                    <label>
                                        لون الإطار
                                        <input type="color" value={barcodeStudioSafeSettings.borderColor} onChange={(e) => setBarcodeSetting('borderColor', e.target.value)} disabled={barcodePrinting} />
                                    </label>
                                </div>

                                <div className="barcode-studio-toggles">
                                    <label><input type="checkbox" checked={barcodeStudioSafeSettings.showBorder} onChange={(e) => setBarcodeSetting('showBorder', e.target.checked)} disabled={barcodePrinting} /> إطار الملصق</label>
                                    <label><input type="checkbox" checked={barcodeStudioSafeSettings.showName} onChange={(e) => setBarcodeSetting('showName', e.target.checked)} disabled={barcodePrinting} /> اسم المنتج</label>
                                    <label><input type="checkbox" checked={barcodeStudioSafeSettings.showSku} onChange={(e) => setBarcodeSetting('showSku', e.target.checked)} disabled={barcodePrinting} /> SKU</label>
                                    <label><input type="checkbox" checked={barcodeStudioSafeSettings.showVariant} onChange={(e) => setBarcodeSetting('showVariant', e.target.checked)} disabled={barcodePrinting} /> بيانات المتغير</label>
                                    <label><input type="checkbox" checked={barcodeStudioSafeSettings.showPrice} onChange={(e) => setBarcodeSetting('showPrice', e.target.checked)} disabled={barcodePrinting} /> السعر</label>
                                    <label><input type="checkbox" checked={barcodeStudioSafeSettings.showCode} onChange={(e) => setBarcodeSetting('showCode', e.target.checked)} disabled={barcodePrinting} /> نص الكود</label>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Preview panel */}
                    <aside className="barcode-studio-preview">
                        <div className="barcode-preview-head">
                            <strong>معاينة مباشرة</strong>
                            <span>أول {barcodePreview.labels.length} ملصق</span>
                        </div>

                        {barcodePreviewIsMatrix && matrixBarcodeEngineLoading ? (
                            <p className="barcode-preview-note">جاري تحميل محرك QR/DataMatrix...</p>
                        ) : null}
                        {barcodePreviewIsMatrix && matrixBarcodeEngineError ? (
                            <p className="barcode-preview-engine-error">تعذر تحميل محرك QR/DataMatrix: {matrixBarcodeEngineError}</p>
                        ) : null}

                        {barcodePreview.labels.length === 0 ? (
                            <div className="barcode-preview-empty">
                                {barcodePreviewIsMatrix && matrixBarcodeEngineLoading
                                    ? 'انتظر اكتمال تحميل محرك الأكواد الثنائية لعرض المعاينة.'
                                    : 'لا توجد أكواد صالحة للمعاينة بالإعدادات الحالية.'}
                            </div>
                        ) : (
                            <div className="barcode-preview-grid">
                                {barcodePreview.labels.map((label, index) => {
                                    const size = nText(label.size);
                                    const color = nText(label.color);
                                    const variantText = [size && size !== 'موحد' ? size : '', color && color !== '-' ? color : ''].filter(Boolean).join(' / ');
                                    const hasVariant = Boolean(variantText);

                                    return (
                                        <article
                                            key={`${label.code}-${index}`}
                                            className="barcode-preview-card"
                                            style={{
                                                background: barcodeStudioSafeSettings.cardBackground,
                                                border: barcodeStudioSafeSettings.showBorder ? `1px solid ${barcodeStudioSafeSettings.borderColor}` : 'none',
                                                textAlign: barcodeStudioSafeSettings.textAlign
                                            }}
                                        >
                                            {barcodeStudioSafeSettings.showName ? <h4 style={{ fontSize: `${barcodeStudioSafeSettings.nameFontPx}px` }}>{label.name || 'منتج'}</h4> : null}
                                            {barcodeStudioSafeSettings.showSku ? <small style={{ fontSize: `${barcodeStudioSafeSettings.metaFontPx}px` }}>SKU: {label.sku || '-'}</small> : null}
                                            {barcodeStudioSafeSettings.showVariant && hasVariant ? <small style={{ fontSize: `${barcodeStudioSafeSettings.metaFontPx}px` }}>{variantText}</small> : null}
                                            <div className={`barcode-preview-svg ${barcodePreviewIsMatrix ? 'matrix' : 'linear'}`} dangerouslySetInnerHTML={{ __html: label.barcodeSvg }} />
                                            {barcodeStudioSafeSettings.showCode ? <div className="code" style={{ fontSize: `${barcodeStudioSafeSettings.metaFontPx}px` }}>{label.code}</div> : null}
                                            {barcodeStudioSafeSettings.showPrice ? <div className="price" style={{ fontSize: `${barcodeStudioSafeSettings.priceFontPx}px` }}>{Number(label.price || 0).toFixed(2)} ج.م</div> : null}
                                        </article>
                                    );
                                })}
                            </div>
                        )}

                        {barcodePreview.invalidRows.length && !(barcodePreviewIsMatrix && !matrixBarcodeEngineLoading) ? (
                            <p className="barcode-preview-warning">
                                {barcodePreview.invalidRows.length} عنصر غير صالح بالصيغة الحالية ولن يتم طباعته.
                            </p>
                        ) : null}
                    </aside>
                </section>

                <footer className="products-modal-footer">
                    <button type="button" className="products-btn products-btn-light" onClick={resetBarcodeStudioSettings} disabled={barcodePrinting}>
                        استرجاع الإعدادات الافتراضية
                    </button>
                    <div className="products-modal-footer-actions">
                        <button type="button" className="products-btn products-btn-light" onClick={closeBarcodeStudio} disabled={barcodePrinting}>
                            إغلاق
                        </button>
                        <button type="button" className="products-btn products-btn-light" onClick={executeBarcodeStudioPdfExport} disabled={barcodePrinting}>
                            {barcodePrinting ? 'جاري تجهيز الملف...' : 'تصدير PDF مباشر'}
                        </button>
                        <button type="button" className="products-btn products-btn-primary" onClick={executeBarcodeStudioPrint} disabled={barcodePrinting}>
                            {barcodePrinting ? 'جاري المعالجة...' : 'طباعة حسب الإعدادات'}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}

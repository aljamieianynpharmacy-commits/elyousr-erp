/**
 * Barcode utility functions — all barcode generation, validation, and HTML rendering.
 * Extracted from Products.jsx for cleanliness.
 */
import JsBarcode from 'jsbarcode';
import { nText, nNum, inRange } from './productUtils';

// ─── Constants ────────────────────────────────────────────────
export const MM_TO_PX = 3.7795275591;

export const BARCODE_FORMAT_OPTIONS = [
    { value: 'CODE128', label: 'CODE128 (يدعم نص/أرقام)' },
    { value: 'CODE128A', label: 'CODE128A (رموز وتحكم)' },
    { value: 'CODE128B', label: 'CODE128B (نص/حروف كبيرة وصغيرة)' },
    { value: 'CODE128C', label: 'CODE128C (أرقام زوجية فقط)' },
    { value: 'QRCODE', label: 'QR Code (ثنائي الأبعاد)' },
    { value: 'DATAMATRIX', label: 'DataMatrix (ثنائي الأبعاد)' },
    { value: 'CODE39', label: 'CODE39 (حروف كبيرة وأرقام)' },
    { value: 'CODE93', label: 'CODE93 (قياسي)' },
    { value: 'CODE93FullASCII', label: 'CODE93 Full ASCII' },
    { value: 'EAN13', label: 'EAN-13 (12/13 رقم)' },
    { value: 'EAN8', label: 'EAN-8 (7/8 رقم)' },
    { value: 'EAN5', label: 'EAN-5 (5 أرقام)' },
    { value: 'EAN2', label: 'EAN-2 (رقمان)' },
    { value: 'UPC', label: 'UPC-A (11/12 رقم)' },
    { value: 'UPCE', label: 'UPC-E (6/7/8 أرقام)' },
    { value: 'ITF14', label: 'ITF-14 (14 رقم)' },
    { value: 'ITF', label: 'ITF (أرقام زوجية الطول)' },
    { value: 'MSI', label: 'MSI (أرقام)' },
    { value: 'MSI10', label: 'MSI10 (Checksum Mod10)' },
    { value: 'MSI11', label: 'MSI11 (Checksum Mod11)' },
    { value: 'MSI1010', label: 'MSI1010 (Double Mod10)' },
    { value: 'MSI1110', label: 'MSI1110 (Mod11 + Mod10)' },
    { value: 'pharmacode', label: 'Pharmacode' },
    { value: 'codabar', label: 'Codabar' }
];

export const MATRIX_BARCODE_FORMATS = new Set(['QRCODE', 'DATAMATRIX']);
export const isMatrixBarcodeFormat = (format) => MATRIX_BARCODE_FORMATS.has(format);

export const BARCODE_CODE_SOURCE_OPTIONS = [
    { value: 'auto', label: 'تلقائي (متغير ثم منتج ثم SKU)' },
    { value: 'variant', label: 'باركود المتغير فقط' },
    { value: 'product', label: 'باركود المنتج فقط' },
    { value: 'sku', label: 'SKU فقط' }
];

export const BARCODE_LABEL_PRESETS = [
    { id: 'small', label: 'صغير 38×25 مم', widthMm: 38, heightMm: 25 },
    { id: 'medium', label: 'متوسط 50×30 مم', widthMm: 50, heightMm: 30 },
    { id: 'large', label: 'كبير 58×40 مم', widthMm: 58, heightMm: 40 },
    { id: 'custom', label: 'مخصص', widthMm: null, heightMm: null }
];

export const BARCODE_STUDIO_TABS = [
    { id: 'templates', label: 'القوالب', hint: 'حفظ واسترجاع إعدادات الطباعة حسب الطابعة والمقاس.' },
    { id: 'source', label: 'النوع والمصدر', hint: 'اختيار نوع الباركود ومن أين يُقرأ الكود.' },
    { id: 'layout', label: 'المقاس والتخطيط', hint: 'التحكم في أبعاد الملصق، الأعمدة، والهوامش.' },
    { id: 'design', label: 'التصميم', hint: 'ألوان الملصق، أحجام الخطوط، وعناصر العرض.' }
];

export const DEFAULT_BARCODE_STUDIO = {
    format: 'CODE128',
    codeSource: 'auto',
    presetId: 'medium',
    labelWidthMm: 50,
    labelHeightMm: 30,
    columns: 4,
    copiesPerItem: 1,
    pageMarginMm: 6,
    gapXMm: 4,
    gapYMm: 4,
    paddingMm: 2,
    barcodeHeightMm: 12,
    barcodeWidthPx: 1.8,
    nameFontPx: 12,
    metaFontPx: 10,
    priceFontPx: 12,
    textAlign: 'center',
    lineColor: '#0f172a',
    cardBackground: '#ffffff',
    borderColor: '#cbd5e1',
    showBorder: true,
    showName: true,
    showSku: true,
    showVariant: true,
    showPrice: true,
    showCode: true
};

export const BARCODE_STUDIO_STORAGE_KEY = 'products.barcodeStudio.v1';
export const BARCODE_TEMPLATE_STORAGE_KEY = 'products.barcodeTemplates.v1';

// ─── Sanitize / validate ──────────────────────────────────────

export const sanitizeBarcodeStudioSettings = (raw = {}) => {
    const presetIds = new Set(BARCODE_LABEL_PRESETS.map((preset) => preset.id));
    const allowedFormats = new Set(BARCODE_FORMAT_OPTIONS.map((option) => option.value));
    const allowedSources = new Set(BARCODE_CODE_SOURCE_OPTIONS.map((option) => option.value));
    const allowedAlign = new Set(['center', 'right', 'left']);

    return {
        format: allowedFormats.has(raw.format) ? raw.format : DEFAULT_BARCODE_STUDIO.format,
        codeSource: allowedSources.has(raw.codeSource) ? raw.codeSource : DEFAULT_BARCODE_STUDIO.codeSource,
        presetId: presetIds.has(raw.presetId) ? raw.presetId : DEFAULT_BARCODE_STUDIO.presetId,
        labelWidthMm: inRange(raw.labelWidthMm, DEFAULT_BARCODE_STUDIO.labelWidthMm, 20, 120),
        labelHeightMm: inRange(raw.labelHeightMm, DEFAULT_BARCODE_STUDIO.labelHeightMm, 15, 90),
        columns: Math.round(inRange(raw.columns, DEFAULT_BARCODE_STUDIO.columns, 1, 8)),
        copiesPerItem: Math.round(inRange(raw.copiesPerItem, DEFAULT_BARCODE_STUDIO.copiesPerItem, 1, 50)),
        pageMarginMm: inRange(raw.pageMarginMm, DEFAULT_BARCODE_STUDIO.pageMarginMm, 0, 20),
        gapXMm: inRange(raw.gapXMm, DEFAULT_BARCODE_STUDIO.gapXMm, 0, 20),
        gapYMm: inRange(raw.gapYMm, DEFAULT_BARCODE_STUDIO.gapYMm, 0, 20),
        paddingMm: inRange(raw.paddingMm, DEFAULT_BARCODE_STUDIO.paddingMm, 0, 10),
        barcodeHeightMm: inRange(raw.barcodeHeightMm, DEFAULT_BARCODE_STUDIO.barcodeHeightMm, 6, 40),
        barcodeWidthPx: inRange(raw.barcodeWidthPx, DEFAULT_BARCODE_STUDIO.barcodeWidthPx, 1, 6),
        nameFontPx: Math.round(inRange(raw.nameFontPx, DEFAULT_BARCODE_STUDIO.nameFontPx, 8, 22)),
        metaFontPx: Math.round(inRange(raw.metaFontPx, DEFAULT_BARCODE_STUDIO.metaFontPx, 7, 18)),
        priceFontPx: Math.round(inRange(raw.priceFontPx, DEFAULT_BARCODE_STUDIO.priceFontPx, 8, 22)),
        textAlign: allowedAlign.has(raw.textAlign) ? raw.textAlign : DEFAULT_BARCODE_STUDIO.textAlign,
        lineColor: nText(raw.lineColor) || DEFAULT_BARCODE_STUDIO.lineColor,
        cardBackground: nText(raw.cardBackground) || DEFAULT_BARCODE_STUDIO.cardBackground,
        borderColor: nText(raw.borderColor) || DEFAULT_BARCODE_STUDIO.borderColor,
        showBorder: raw.showBorder !== false,
        showName: raw.showName !== false,
        showSku: raw.showSku !== false,
        showVariant: raw.showVariant !== false,
        showPrice: raw.showPrice !== false,
        showCode: raw.showCode !== false
    };
};

export const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const mmToPx = (value, fallback = 10) =>
    Math.max(1, Math.round(inRange(value, fallback, 0.1, 200) * MM_TO_PX));

// ─── Templates ────────────────────────────────────────────────

export const normalizeTemplateValue = (value, maxLength = 64) =>
    nText(value).slice(0, maxLength);

export const sanitizeBarcodeTemplate = (template, fallbackIndex = 1) => {
    const now = Date.now();
    const createdAt = Number.isFinite(Number(template?.createdAt)) ? Number(template.createdAt) : now;
    const updatedAt = Number.isFinite(Number(template?.updatedAt)) ? Number(template.updatedAt) : createdAt;

    return {
        id: nText(template?.id) || `barcode-template-${createdAt}-${fallbackIndex}`,
        name: normalizeTemplateValue(template?.name, 80) || `قالب ${fallbackIndex}`,
        printer: normalizeTemplateValue(template?.printer, 80),
        settings: sanitizeBarcodeStudioSettings(template?.settings),
        createdAt,
        updatedAt
    };
};

export const parseBarcodeTemplates = (rawValue) => {
    if (!rawValue) return [];

    try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) return [];

        const uniqueIds = new Set();
        const sanitized = [];

        parsed.forEach((item, index) => {
            const template = sanitizeBarcodeTemplate(item, index + 1);
            if (uniqueIds.has(template.id)) return;
            uniqueIds.add(template.id);
            sanitized.push(template);
        });

        return sanitized.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (err) {
        return [];
    }
};

// ─── Barcode value / normalization ────────────────────────────

export const barcodeValueFromSource = (row, source) => {
    const variantBarcode = nText(row.variantBarcode);
    const productBarcode = nText(row.productBarcode);
    const skuValue = nText(row.sku);

    switch (source) {
        case 'variant':
            return variantBarcode;
        case 'product':
            return productBarcode;
        case 'sku':
            return skuValue;
        case 'auto':
        default:
            return variantBarcode || productBarcode || skuValue || nText(row.code);
    }
};

export const normalizeBarcodeByFormat = (value, format) => {
    const text = nText(value);
    if (!text) return null;
    if (
        format === 'CODE128'
        || format === 'CODE128A'
        || format === 'CODE128B'
        || format === 'CODE93FullASCII'
        || format === 'QRCODE'
        || format === 'DATAMATRIX'
    ) return text;

    const digits = text.replace(/\D/g, '');
    const upperText = text.toUpperCase();

    switch (format) {
        case 'CODE128C':
            if (!digits || digits.length % 2 !== 0) return null;
            return digits;
        case 'CODE39': {
            const cleaned = upperText.replace(/\s+/g, ' ');
            return /^[0-9A-Z\-\. $\/\+%]+$/.test(cleaned) ? cleaned : null;
        }
        case 'CODE93': {
            const cleaned = upperText.replace(/\s+/g, ' ');
            return /^[0-9A-Z\-\. $\/\+%]+$/.test(cleaned) ? cleaned : null;
        }
        case 'EAN13':
            if (!digits) return null;
            if (digits.length >= 13) return digits.slice(0, 13);
            if (digits.length === 12) return digits;
            return null;
        case 'EAN8':
            if (!digits) return null;
            if (digits.length >= 8) return digits.slice(0, 8);
            if (digits.length === 7) return digits;
            return null;
        case 'EAN5':
            if (!digits) return null;
            if (digits.length >= 5) return digits.slice(0, 5);
            return null;
        case 'EAN2':
            if (!digits) return null;
            if (digits.length >= 2) return digits.slice(0, 2);
            return null;
        case 'UPC':
            if (!digits) return null;
            if (digits.length >= 12) return digits.slice(0, 12);
            if (digits.length === 11) return digits;
            return null;
        case 'UPCE':
            if (!digits) return null;
            if (digits.length >= 8) return digits.slice(0, 8);
            if (digits.length === 6 || digits.length === 7) return digits;
            return null;
        case 'ITF14':
            if (!digits) return null;
            if (digits.length >= 14) return digits.slice(0, 14);
            return null;
        case 'ITF':
            if (!digits || digits.length % 2 !== 0) return null;
            return digits;
        case 'MSI':
        case 'MSI10':
        case 'MSI11':
        case 'MSI1010':
        case 'MSI1110':
        case 'pharmacode':
            return digits || null;
        case 'codabar': {
            const cleaned = upperText.replace(/\s+/g, '');
            if (!/^[0-9A-D\-\$:\/\.\+]+$/.test(cleaned)) return null;
            const startsWithGuard = /^[A-D]/.test(cleaned);
            const endsWithGuard = /[A-D]$/.test(cleaned);
            if (startsWithGuard && endsWithGuard) return cleaned;
            return `A${cleaned}A`;
        }
        default:
            return text;
    }
};

// ─── SVG generation ───────────────────────────────────────────

export const buildBarcodeSvg = (value, settings, bwipLibrary = null) => {
    if (typeof document === 'undefined') return '';

    if (isMatrixBarcodeFormat(settings.format)) {
        if (!bwipLibrary || typeof bwipLibrary.toSVG !== 'function') {
            return '';
        }

        const bcid = settings.format === 'QRCODE' ? 'qrcode' : 'datamatrix';

        try {
            const svg = bwipLibrary.toSVG({
                bcid,
                text: value,
                scale: Math.max(1, Math.round(inRange(settings.barcodeWidthPx, 2, 1, 6))),
                width: inRange(settings.barcodeHeightMm, DEFAULT_BARCODE_STUDIO.barcodeHeightMm, 6, 80),
                height: inRange(settings.barcodeHeightMm, DEFAULT_BARCODE_STUDIO.barcodeHeightMm, 6, 80),
                padding: 0,
                includetext: false,
                barcolor: settings.lineColor
            });
            return typeof svg === 'string' ? svg : '';
        } catch (err) {
            return '';
        }
    }

    try {
        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        let isValid = true;

        JsBarcode(svgNode, value, {
            format: settings.format,
            width: settings.barcodeWidthPx,
            height: mmToPx(settings.barcodeHeightMm, DEFAULT_BARCODE_STUDIO.barcodeHeightMm),
            margin: 0,
            lineColor: settings.lineColor,
            displayValue: false,
            background: 'transparent',
            valid: (valid) => { isValid = valid; }
        });

        return isValid ? svgNode.outerHTML : '';
    } catch (err) {
        return '';
    }
};

export const buildBarcodeLabels = (rows, settings, limit = Number.POSITIVE_INFINITY, bwipLibrary = null) => {
    const labels = [];
    const invalidRows = [];
    const copies = Math.max(1, Math.round(inRange(settings.copiesPerItem, 1, 1, 50)));

    for (const row of rows) {
        const rawCode = barcodeValueFromSource(row, settings.codeSource);
        const normalizedCode = normalizeBarcodeByFormat(rawCode, settings.format);
        if (!normalizedCode) {
            invalidRows.push({ row, reason: 'invalid-format' });
            continue;
        }

        const svg = buildBarcodeSvg(normalizedCode, settings, bwipLibrary);
        if (!svg) {
            invalidRows.push({ row, reason: 'render-failed' });
            continue;
        }

        const base = {
            ...row,
            code: normalizedCode,
            barcodeSvg: svg
        };

        for (let idx = 0; idx < copies; idx += 1) {
            labels.push(base);
            if (labels.length >= limit) {
                return { labels, invalidRows };
            }
        }
    }

    return { labels, invalidRows };
};

// ─── Full-page HTML for print ─────────────────────────────────

export const barcodeStudioHtml = (labels, settings) => {
    const safe = sanitizeBarcodeStudioSettings(settings);
    const textAlign = safe.textAlign === 'left' ? 'left' : safe.textAlign === 'right' ? 'right' : 'center';
    const isMatrixFormat = isMatrixBarcodeFormat(safe.format);
    const cards = labels.map((label) => {
        const size = nText(label.size);
        const color = nText(label.color);
        const hasVariant = (size && size !== 'موحد') || (color && color !== '-');
        const variantText = [size && size !== 'موحد' ? size : '', color && color !== '-' ? color : ''].filter(Boolean).join(' / ');

        return `
      <article class="label">
        ${safe.showName ? `<div class="name">${escapeHtml(label.name || 'منتج')}</div>` : ''}
        ${safe.showSku ? `<div class="meta">SKU: ${escapeHtml(label.sku || '-')}</div>` : ''}
        ${safe.showVariant && hasVariant ? `<div class="meta">${escapeHtml(variantText)}</div>` : ''}
        <div class="barcode ${isMatrixFormat ? 'matrix' : 'linear'}">${label.barcodeSvg}</div>
        ${safe.showCode ? `<div class="code">${escapeHtml(label.code || '')}</div>` : ''}
        ${safe.showPrice ? `<div class="price">${Number(label.price || 0).toFixed(2)} ج.م</div>` : ''}
      </article>
    `;
    }).join('');

    return `<!doctype html>
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>ملصقات باركود المنتجات</title>
      <style>
        @page { margin: ${safe.pageMarginMm}mm; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: ${safe.pageMarginMm}mm;
          font-family: Tahoma, "Segoe UI", sans-serif;
          background: #f8fafc;
        }
        .sheet {
          display: grid;
          grid-template-columns: repeat(${safe.columns}, ${safe.labelWidthMm}mm);
          justify-content: center;
          column-gap: ${safe.gapXMm}mm;
          row-gap: ${safe.gapYMm}mm;
        }
        .label {
          width: ${safe.labelWidthMm}mm;
          min-height: ${safe.labelHeightMm}mm;
          background: ${safe.cardBackground};
          border: ${safe.showBorder ? `1px solid ${safe.borderColor}` : 'none'};
          border-radius: 3mm;
          padding: ${safe.paddingMm}mm;
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: ${textAlign};
          break-inside: avoid;
          gap: 1.1mm;
        }
        .name {
          font-size: ${safe.nameFontPx}px;
          font-weight: 700;
          line-height: 1.25;
          color: #0f172a;
        }
        .meta {
          font-size: ${safe.metaFontPx}px;
          color: #334155;
          line-height: 1.2;
        }
        .barcode {
          width: 100%;
          min-height: ${safe.barcodeHeightMm}mm;
          display: grid;
          place-items: center;
        }
        .barcode.linear svg {
          width: 100%;
          height: ${safe.barcodeHeightMm}mm;
          display: block;
        }
        .barcode.matrix svg {
          width: auto;
          max-width: 100%;
          height: ${safe.barcodeHeightMm}mm;
          display: block;
        }
        .code {
          font-size: ${safe.metaFontPx}px;
          font-weight: 700;
          letter-spacing: 0.3px;
          color: #111827;
        }
        .price {
          font-size: ${safe.priceFontPx}px;
          font-weight: 700;
          color: #065f46;
          line-height: 1.2;
        }
      </style>
    </head>
    <body>
      <section class="sheet">${cards}</section>
    </body>
  </html>`;
};

// ─── Barcode row preparation ──────────────────────────────────

export const barcodeRows = (products, salePriceOfFn) => {
    const rows = [];
    products.forEach((p) => {
        const sku = nText(p.sku) || `P${p.id}`;
        const vars = p.variants || [];
        const mainUnit = (() => {
            const units = Array.isArray(p.productUnits) ? p.productUnits : [];
            if (!units.length) return null;
            return units.find((u) => (parseFloat(String(u.conversionFactor ?? 1)) || 1) === 1) || units[0];
        })();
        const productBarcode = nText(mainUnit?.barcode) || nText(p.barcode);

        if (!vars.length) {
            rows.push({
                productId: p.id,
                name: p.name || 'منتج',
                sku,
                size: 'موحد',
                color: '-',
                price: salePriceOfFn(p),
                productBarcode,
                variantBarcode: '',
                code: productBarcode || `${sku}-STD`
            });
            return;
        }

        vars.forEach((v, idx) => rows.push({
            productId: p.id,
            name: p.name || 'منتج',
            sku,
            size: v.productSize || 'موحد',
            color: v.color || '-',
            price: Number(v.price || p.basePrice || 0),
            productBarcode,
            variantBarcode: nText(v.barcode),
            code: nText(v.barcode) || productBarcode || `${sku}-${v.productSize || 'S'}-${v.color || idx + 1}`
        }));
    });
    return rows;
};

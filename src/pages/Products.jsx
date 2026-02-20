import React, { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import JsBarcode from 'jsbarcode';
import { FixedSizeList as List } from 'react-window';
import { safeAlert } from '../utils/safeAlert';
import { safeConfirm } from '../utils/safeConfirm';
import { safePrint } from '../printing/safePrint';
import './Products.css';

const loadProductModal = () => import('../components/products/ProductModal');
const ProductModal = lazy(loadProductModal);

const PRODUCT_FETCH_CHUNK = 10000;
const PRODUCT_SEARCH_LIMIT = 120;
const PRODUCT_SEARCH_DEBOUNCE_MS = 120;
const COLUMN_STORAGE_KEY = 'products.visibleColumns.v1';
const BARCODE_STUDIO_STORAGE_KEY = 'products.barcodeStudio.v1';
const BARCODE_TEMPLATE_STORAGE_KEY = 'products.barcodeTemplates.v1';
const DEFAULT_UNIT = 'قطعة';

const GRID_COLUMNS = [
  { key: 'select', label: '', width: '52px', required: true, minWidth: '52px' },
  { key: 'code', label: 'الكود', width: 'minmax(100px, 1fr)', minWidth: '100px' },
  { key: 'name', label: 'اسم الصنف', width: 'minmax(200px, 2fr)', minWidth: '200px' },
  { key: 'warehouse', label: 'المخزن', width: 'minmax(80px, 1fr)', minWidth: '80px' },
  { key: 'unit', label: 'الوحدة', width: 'minmax(70px, 1fr)', minWidth: '70px' },
  { key: 'quantity', label: 'الكمية', width: 'minmax(80px, 1fr)', minWidth: '80px' },
  { key: 'salePrice', label: 'سعر البيع', width: 'minmax(100px, 1fr)', minWidth: '100px' },
  { key: 'costPrice', label: 'سعر التكلفة', width: 'minmax(100px, 1fr)', minWidth: '100px' },
  { key: 'wholesalePrice', label: 'سعر الجملة', width: 'minmax(100px, 1fr)', minWidth: '100px' },
  { key: 'saleLimit', label: 'حد البيع', width: 'minmax(80px, 1fr)', minWidth: '80px' },
  { key: 'notes', label: 'الملاحظات', width: 'minmax(150px, 1.5fr)', minWidth: '150px' },
  { key: 'category', label: 'الفئة', width: 'minmax(150px, 1.5fr)', minWidth: '150px' },
  { key: 'variants', label: 'المتغيرات', width: 'minmax(80px, 1fr)', minWidth: '80px' },
  { key: 'stockState', label: 'حالة المخزون', width: 'minmax(130px, 1fr)', minWidth: '130px' },
  { key: 'updatedAt', label: 'آخر تحديث', width: 'minmax(100px, 1fr)', minWidth: '100px' },
  { key: 'actions', label: 'إجراءات', width: '180px', required: true, minWidth: '180px' }
];

const DEFAULT_VISIBLE_COLUMN_KEYS = GRID_COLUMNS.filter((col) => !col.required).map((col) => col.key);

const getGridHeight = () => {
  if (typeof window === 'undefined') return 460;
  const reserved = window.innerWidth < 900 ? 380 : 280;
  return Math.max(260, window.innerHeight - reserved);
};

const SORT_PRESETS = [
  { id: 'latest', label: 'الأحدث', sortCol: 'createdAt', sortDir: 'desc' },
  { id: 'oldest', label: 'الأقدم', sortCol: 'createdAt', sortDir: 'asc' },
  { id: 'name_asc', label: 'الاسم (أ - ي)', sortCol: 'name', sortDir: 'asc' },
  { id: 'name_desc', label: 'الاسم (ي - أ)', sortCol: 'name', sortDir: 'desc' },
  { id: 'price_desc', label: 'السعر الأعلى', sortCol: 'basePrice', sortDir: 'desc' },
  { id: 'price_asc', label: 'السعر الأقل', sortCol: 'basePrice', sortDir: 'asc' }
];

const DEFAULT_CATEGORY = { name: '', description: '', color: '#0f766e', icon: '🧵' };
const MM_TO_PX = 3.7795275591;

const BARCODE_FORMAT_OPTIONS = [
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

const MATRIX_BARCODE_FORMATS = new Set(['QRCODE', 'DATAMATRIX']);
const isMatrixBarcodeFormat = (format) => MATRIX_BARCODE_FORMATS.has(format);

const BARCODE_CODE_SOURCE_OPTIONS = [
  { value: 'auto', label: 'تلقائي (متغير ثم منتج ثم SKU)' },
  { value: 'variant', label: 'باركود المتغير فقط' },
  { value: 'product', label: 'باركود المنتج فقط' },
  { value: 'sku', label: 'SKU فقط' }
];

const BARCODE_LABEL_PRESETS = [
  { id: 'small', label: 'صغير 38×25 مم', widthMm: 38, heightMm: 25 },
  { id: 'medium', label: 'متوسط 50×30 مم', widthMm: 50, heightMm: 30 },
  { id: 'large', label: 'كبير 58×40 مم', widthMm: 58, heightMm: 40 },
  { id: 'custom', label: 'مخصص', widthMm: null, heightMm: null }
];

const BARCODE_STUDIO_TABS = [
  { id: 'templates', label: 'القوالب', hint: 'حفظ واسترجاع إعدادات الطباعة حسب الطابعة والمقاس.' },
  { id: 'source', label: 'النوع والمصدر', hint: 'اختيار نوع الباركود ومن أين يُقرأ الكود.' },
  { id: 'layout', label: 'المقاس والتخطيط', hint: 'التحكم في أبعاد الملصق، الأعمدة، والهوامش.' },
  { id: 'design', label: 'التصميم', hint: 'ألوان الملصق، أحجام الخطوط، وعناصر العرض.' }
];

const DEFAULT_BARCODE_STUDIO = {
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

const inRange = (value, fallback, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
};

const sanitizeBarcodeStudioSettings = (raw = {}) => {
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

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const mmToPx = (value, fallback = 10) => Math.max(1, Math.round(inRange(value, fallback, 0.1, 200) * MM_TO_PX));

const barcodeValueFromSource = (row, source) => {
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

const normalizeBarcodeByFormat = (value, format) => {
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

const buildBarcodeSvg = (value, settings, bwipLibrary = null) => {
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

const buildBarcodeLabels = (rows, settings, limit = Number.POSITIVE_INFINITY, bwipLibrary = null) => {
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

const barcodeStudioHtml = (labels, settings) => {
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

const nText = (v) => String(v ?? '').trim();
const nKey = (v) => nText(v).toLowerCase().replace(/[\s_-]+/g, '');
const nInt = (v, f = 0) => {
  const x = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(x) ? x : f;
};
const nNum = (v, f = 0) => {
  const x = parseFloat(String(v ?? '').replace(/[^0-9.,-]/g, '').replace(/,/g, '.'));
  return Number.isFinite(x) ? x : f;
};
const money = (v) => {
  const num = Number(v || 0);
  // إذا كان الرقم عدد صحيح، عرضه بدون كسور عشرية
  if (Number.isInteger(num)) {
    return num.toLocaleString('ar-EG');
  }
  // إذا كان عدد عشري، عرضه بحد أقصى منزلتين عشريتين وإزالة الأصفار الزائدة
  return num.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};
const csv = (v) => {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
};

const normalizeTemplateValue = (value, maxLength = 64) => nText(value).slice(0, maxLength);

const sanitizeBarcodeTemplate = (template, fallbackIndex = 1) => {
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

const parseBarcodeTemplates = (rawValue) => {
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

const stock = (p) => {
  const variantsTotal = (p.variants || []).reduce((s, v) => s + nInt(v.quantity), 0);
  const total = nInt(p.inventory?.totalQuantity, variantsTotal);
  const min = nInt(p.inventory?.minStock, 5);
  if (total <= 0) return { key: 'out', label: 'نافد', tone: 'danger', total, min };
  if (total <= min) return { key: 'low', label: 'منخفض', tone: 'warning', total, min };
  return { key: 'ok', label: 'متاح', tone: 'success', total, min };
};

const unitsOf = (product) => (Array.isArray(product?.productUnits) ? product.productUnits : []);
const mainUnitOf = (product) => {
  const units = unitsOf(product);
  if (!units.length) return null;
  return units.find((unit) => nNum(unit.conversionFactor, 1) === 1) || units[0];
};
const salePriceOf = (product) => nNum(mainUnitOf(product)?.salePrice, nNum(product?.basePrice, 0));
const costPriceOf = (product) => nNum(mainUnitOf(product)?.purchasePrice, nNum(product?.cost, 0));

const wholesale = (product) => {
  const mainUnit = mainUnitOf(product);
  if (mainUnit) {
    return nNum(mainUnit.wholesalePrice, nNum(mainUnit.salePrice, nNum(product?.basePrice, 0)));
  }
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (variants.length > 0) {
    const prices = variants.map((variant) => nNum(variant.price, nNum(product.basePrice, 0)));
    return Math.min(...prices);
  }
  return nNum(product?.basePrice, 0);
};

const useDebouncedValue = (value, delayMs) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};

const parseLine = (line, delim) => {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    const n = line[i + 1];
    if (c === '"') {
      if (q && n === '"') {
        cur += '"';
        i += 1;
      } else q = !q;
      continue;
    }
    if (c === delim && !q) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
};

const delimiter = (header) => {
  const c = header.split(',').length;
  const s = header.split(';').length;
  const t = header.split('\t').length;
  if (t >= c && t >= s) return '\t';
  if (s > c) return ';';
  return ',';
};

const IMPORT_FIELD_OPTIONS = [
  { key: 'name', label: 'اسم المنتج', required: true, aliases: ['name', 'productname', 'اسم المنتج', 'اسم الصنف', 'الصنف'] },
  { key: 'category', label: 'الفئة', aliases: ['category', 'categoryname', 'الفئة', 'التصنيف'] },
  { key: 'brand', label: 'الماركة', aliases: ['brand', 'الماركة', 'العلامة التجارية'] },
  { key: 'sku', label: 'SKU / كود', aliases: ['sku', 'code', 'productcode', 'كود', 'كود الصنف'] },
  { key: 'barcode', label: 'باركود المنتج', aliases: ['barcode', 'productbarcode', 'باركود', 'باركود المنتج'] },
  { key: 'description', label: 'الوصف', aliases: ['description', 'الوصف', 'desc'] },
  { key: 'salePrice', label: 'سعر البيع', aliases: ['saleprice', 'price', 'sellingprice', 'سعر البيع', 'سعر'] },
  { key: 'costPrice', label: 'سعر التكلفة', aliases: ['costprice', 'purchaseprice', 'cost', 'التكلفة', 'سعر التكلفة'] },
  { key: 'image', label: 'صورة', aliases: ['image', 'photo', 'صورة', 'رابط الصورة'] },
  { key: 'warehouseQty', label: 'كمية المخزن', aliases: ['warehouseqty', 'warehouse', 'مخزن', 'كمية المخزن'] },
  { key: 'displayQty', label: 'كمية العرض', aliases: ['displayqty', 'display', 'عرض', 'كمية العرض'] },
  { key: 'minStock', label: 'الحد الأدنى', aliases: ['minstock', 'minimumstock', 'الحد الأدنى', 'حد البيع'] },
  { key: 'notes', label: 'ملاحظات', aliases: ['notes', 'note', 'ملاحظات'] },
  { key: 'size', label: 'المقاس', aliases: ['size', 'productsize', 'المقاس'] },
  { key: 'color', label: 'اللون', aliases: ['color', 'colour', 'اللون'] },
  { key: 'variantBarcode', label: 'باركود المتغير', aliases: ['variantbarcode', 'barcodesizecolor', 'باركود المتغير'] },
  { key: 'variantPrice', label: 'سعر المتغير', aliases: ['variantprice', 'pricevariant', 'سعر المتغير'] },
  { key: 'variantCost', label: 'تكلفة المتغير', aliases: ['variantcost', 'costvariant', 'تكلفة المتغير'] },
  { key: 'variantQty', label: 'كمية المتغير', aliases: ['variantqty', 'variantquantity', 'quantity', 'qty', 'كمية المتغير', 'الكمية'] }
];

const toImportHeaders = (headers) => (
  headers.map((label, index) => {
    const cleanLabel = nText(label) || `عمود ${index + 1}`;
    return {
      id: String(index),
      index,
      label: cleanLabel,
      key: nKey(cleanLabel) || `column${index + 1}`
    };
  })
);

const buildImportFieldAutoMapping = (headers = []) => {
  const mapping = Object.fromEntries(IMPORT_FIELD_OPTIONS.map((field) => [field.key, '']));
  const usedHeaders = new Set();

  IMPORT_FIELD_OPTIONS.forEach((field) => {
    const aliasKeys = (field.aliases || []).map((alias) => nKey(alias)).filter(Boolean);
    if (!aliasKeys.length) return;

    let match = headers.find((header) => (
      !usedHeaders.has(header.id)
      && aliasKeys.some((alias) => header.key === alias)
    ));

    if (!match) {
      match = headers.find((header) => (
        !usedHeaders.has(header.id)
        && aliasKeys.some((alias) => (
          header.key.includes(alias)
          || alias.includes(header.key)
        ))
      ));
    }

    if (match) {
      mapping[field.key] = match.id;
      usedHeaders.add(match.id);
    }
  });

  return mapping;
};

const mapRowsWithImportMapping = (rows, mapping) => (
  rows.map((values) => {
    const mappedRow = {};

    IMPORT_FIELD_OPTIONS.forEach((field) => {
      const columnId = mapping?.[field.key];
      if (columnId === undefined || columnId === null || columnId === '') {
        mappedRow[field.key] = '';
        return;
      }

      const columnIndex = Number(columnId);
      mappedRow[field.key] = nText(values[columnIndex] ?? '');
    });

    return mappedRow;
  })
);

const barcodeRows = (products) => {
  const rows = [];
  products.forEach((p) => {
    const sku = nText(p.sku) || `P${p.id}`;
    const vars = p.variants || [];
    const mainUnit = mainUnitOf(p);
    const productBarcode = nText(mainUnit?.barcode) || nText(p.barcode);

    if (!vars.length) {
      rows.push({
        productId: p.id,
        name: p.name || 'منتج',
        sku,
        size: 'موحد',
        color: '-',
        price: salePriceOf(p),
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

const importGroups = (rows) => {
  const groups = [];
  let currentGroup = null;

  for (const row of rows) {
    const name = nText(row.name);
    const isMain = Boolean(name);

    if (isMain) {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = {
        product: {
          name,
          category: nText(row.category),
          brand: nText(row.brand),
          sku: nText(row.sku),
          barcode: nText(row.barcode),
          description: nText(row.description),
          basePrice: nNum(row.salePrice || row.variantPrice, 0),
          cost: nNum(row.costPrice || row.variantCost, 0),
          image: nText(row.image)
        },
        inventory: {
          warehouseQty: nInt(row.warehouseQty, 0),
          displayQty: nInt(row.displayQty, 0),
          minStock: nInt(row.minStock, 5),
          maxStock: 100,
          notes: nText(row.notes)
        },
        variants: []
      };
    }

    if (currentGroup) {
      const size = nText(row.size);
      const color = nText(row.color);
      const vBarcode = nText(row.variantBarcode);
      const price = nNum(row.variantPrice, nNum(row.salePrice, 0));
      const cost = nNum(row.variantCost, nNum(row.costPrice, 0));
      const qty = nInt(row.variantQty, 0);

      if (size || color || qty > 0 || vBarcode) {
        currentGroup.variants.push({ size, color, barcode: vBarcode, price, cost, quantity: qty });
      }
    }
  }
  if (currentGroup) groups.push(currentGroup);
  return groups;
};

const ProductGridRow = React.memo(({ index, style, data }) => {
  const {
    visibleProducts,
    activeColumns,
    selectedIds,
    categoryMap,
    productMetaMap,
    toggleId,
    openEdit,
    duplicateProduct,
    printBarcodes,
    deleteProduct,
    showVariantsSummary,
    gridTemplateColumns
  } = data;

  const product = visibleProducts[index];
  const [imageError, setImageError] = React.useState(false);

  if (!product) return null;

  const status = productMetaMap.get(product.id)?.status || stock(product);
  const category = categoryMap.get(product.categoryId);
  const productCode = nText(product.sku) || nText(product.barcode) || `#${product.id}`;

  const renderCell = (columnKey) => {
    switch (columnKey) {
      case 'select':
        return (
          <input
            type="checkbox"
            checked={selectedIds.has(product.id)}
            onChange={() => toggleId(product.id)}
            aria-label={`تحديد ${product.name}`}
          />
        );
      case 'code':
        return <span className="grid-code">{productCode}</span>;
      case 'name': {
        const imageUrl = product.image ? (product.image.startsWith('http') || product.image.startsWith('data:') ? product.image : `file://${product.image}`) : null;
        return (
          <div className="grid-name-cell">
            <div className="product-avatar">
              {imageUrl && !imageError ? (
                <img
                  src={imageUrl}
                  alt={product.name}
                  onError={() => setImageError(true)}
                  title={product.name}
                />
              ) : (
                <div className="avatar-fallback">
                  📦
                </div>
              )}
            </div>
            <div>
              <strong>{product.name}</strong>
            </div>
          </div>
        );
      }
      case 'warehouse':
        return <span>{nInt(product?.inventory?.warehouseQty, 0)}</span>;
      case 'unit':
        return <span>{nText(mainUnitOf(product)?.unitName) || DEFAULT_UNIT}</span>;
      case 'quantity':
        return <strong>{status.total}</strong>;
      case 'salePrice':
        return <span className="price-sale">{money(salePriceOf(product))}</span>;
      case 'costPrice':
        return <span>{money(costPriceOf(product))}</span>;
      case 'wholesalePrice':
        return <span>{money(wholesale(product))}</span>;
      case 'saleLimit':
        return <span>{status.min}</span>;
      case 'notes': {
        const notesText = nText(product?.inventory?.notes) || '-';
        return <span className="grid-notes" title={notesText}>{notesText}</span>;
      }
      case 'category':
        return (
          <span
            className="category-chip"
            style={{
              backgroundColor: `${category?.color || '#64748b'}1f`,
              color: category?.color || '#334155',
              borderColor: `${category?.color || '#64748b'}66`
            }}
          >
            {category?.icon || '📦'} {category?.name || 'غير مصنف'}
          </span>
        );
      case 'variants':
        return (
          <button type="button" className="link-btn" onClick={() => showVariantsSummary(product)}>
            {(product.variants || []).length} متغير
          </button>
        );
      case 'stockState':
        return (
          <div className="stock-cell">
            <span className={`stock-chip ${status.tone}`}>{status.label}</span>
            <small>مخزن {nInt(product?.inventory?.warehouseQty, 0)} | عرض {nInt(product?.inventory?.displayQty, 0)}</small>
          </div>
        );
      case 'updatedAt':
        return <span>{new Date(product.updatedAt || product.createdAt || Date.now()).toLocaleDateString('ar-EG')}</span>;
      case 'actions':
        return (
          <div className="row-actions">
            <button type="button" className="icon-btn-solid edit" title="تعديل" onClick={() => openEdit(product)}>✏️</button>
            <button type="button" className="icon-btn-solid orange" title="نسخ" onClick={() => duplicateProduct(product)}>📋</button>
            <button type="button" className="icon-btn-solid blue" title="طباعة باركود" onClick={() => printBarcodes([product])}>🏷️</button>
            <button type="button" className="icon-btn-solid danger" title="حذف" onClick={() => deleteProduct(product)}>🗑️</button>
          </div>
        );
      default:
        return '-';
    }
  };

  return (
    <div
      className={`products-grid-row ${index % 2 === 0 ? 'even' : 'odd'}`}
      style={{ ...style, display: 'grid', gridTemplateColumns }}
    >
      {activeColumns.map((column) => (
        <div key={`${product.id}-${column.key}`} className={`products-grid-cell cell-${column.key}`}>
          {renderCell(column.key)}
        </div>
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.index !== nextProps.index) return false;
  if (prevProps.style !== nextProps.style) return false;
  if (prevProps.data.gridTemplateColumns !== nextProps.data.gridTemplateColumns) return false;

  const prevProductId = prevProps.data.visibleProducts[prevProps.index]?.id;
  const nextProductId = nextProps.data.visibleProducts[nextProps.index]?.id;
  if (prevProductId !== nextProductId) return false;

  const prevSelected = prevProductId != null && prevProps.data.selectedIds?.has(prevProductId);
  const nextSelected = nextProductId != null && nextProps.data.selectedIds?.has(nextProductId);

  return prevSelected === nextSelected;
});

export default function Products() {
  const [products, setProducts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchResultsTotal, setSearchResultsTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm, PRODUCT_SEARCH_DEBOUNCE_MS);
  const deferredSearchTerm = useDeferredValue(debouncedSearchTerm);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortPreset, setSortPreset] = useState('latest');

  const [totalItems, setTotalItems] = useState(0);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showSearchRow, setShowSearchRow] = useState(false);
  const [columnSearches, setColumnSearches] = useState({});
  const debouncedColumnSearches = useDebouncedValue(columnSearches, 80);
  const [gridHeight, setGridHeight] = useState(getGridHeight);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_VISIBLE_COLUMN_KEYS;
    try {
      const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY);
      if (!raw) return DEFAULT_VISIBLE_COLUMN_KEYS;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return DEFAULT_VISIBLE_COLUMN_KEYS;
      const valid = parsed.filter((key) => GRID_COLUMNS.some((col) => col.key === key && !col.required));
      return valid.length ? valid : DEFAULT_VISIBLE_COLUMN_KEYS;
    } catch (err) {
      return DEFAULT_VISIBLE_COLUMN_KEYS;
    }
  });

  const [showProductModal, setShowProductModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingProduct, setEditingProduct] = useState(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState(DEFAULT_CATEGORY);
  const [importSession, setImportSession] = useState(null);
  const [showBarcodeStudio, setShowBarcodeStudio] = useState(false);
  const [barcodeStudioProducts, setBarcodeStudioProducts] = useState([]);
  const [barcodePrinting, setBarcodePrinting] = useState(false);
  const [barcodeStudioSettings, setBarcodeStudioSettings] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_BARCODE_STUDIO;
    try {
      const raw = window.localStorage.getItem(BARCODE_STUDIO_STORAGE_KEY);
      if (!raw) return DEFAULT_BARCODE_STUDIO;
      return sanitizeBarcodeStudioSettings(JSON.parse(raw));
    } catch (err) {
      return DEFAULT_BARCODE_STUDIO;
    }
  });
  const [barcodeTemplates, setBarcodeTemplates] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      return parseBarcodeTemplates(window.localStorage.getItem(BARCODE_TEMPLATE_STORAGE_KEY));
    } catch (err) {
      return [];
    }
  });
  const [activeBarcodeTemplateId, setActiveBarcodeTemplateId] = useState('');
  const [barcodeTemplateName, setBarcodeTemplateName] = useState('');
  const [barcodeTemplatePrinter, setBarcodeTemplatePrinter] = useState('');
  const [barcodeStudioTab, setBarcodeStudioTab] = useState('templates');
  const [matrixBarcodeLibrary, setMatrixBarcodeLibrary] = useState(null);
  const [matrixBarcodeEngineLoading, setMatrixBarcodeEngineLoading] = useState(false);
  const [matrixBarcodeEngineError, setMatrixBarcodeEngineError] = useState('');

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const importRef = useRef(null);
  const columnsMenuRef = useRef(null);
  const gridViewportRef = useRef(null);
  const gridHeaderRef = useRef(null);
  const hasLoadedProductsRef = useRef(false);
  const latestProductsRequestRef = useRef(0);
  const latestSearchRequestRef = useRef(0);
  const matrixBarcodeLoaderRef = useRef(null);

  const activeSort = useMemo(() => SORT_PRESETS.find((s) => s.id === sortPreset) || SORT_PRESETS[0], [sortPreset]);
  const importColumnSamples = useMemo(() => {
    if (!importSession) return new Map();

    const samples = new Map();
    const previewRows = importSession.rows.slice(0, 120);
    for (const header of importSession.headers) {
      for (const row of previewRows) {
        const value = nText(row[header.index]);
        if (value) {
          samples.set(header.id, value);
          break;
        }
      }
    }

    return samples;
  }, [importSession]);
  const barcodeStudioRows = useMemo(() => barcodeRows(barcodeStudioProducts), [barcodeStudioProducts]);
  const barcodeStudioSafeSettings = useMemo(
    () => sanitizeBarcodeStudioSettings(barcodeStudioSettings),
    [barcodeStudioSettings]
  );
  const activeBarcodeTemplate = useMemo(
    () => barcodeTemplates.find((template) => template.id === activeBarcodeTemplateId) || null,
    [barcodeTemplates, activeBarcodeTemplateId]
  );
  const activeBarcodeStudioTab = useMemo(
    () => BARCODE_STUDIO_TABS.find((tab) => tab.id === barcodeStudioTab) || BARCODE_STUDIO_TABS[0],
    [barcodeStudioTab]
  );
  const barcodePreviewIsMatrix = isMatrixBarcodeFormat(barcodeStudioSafeSettings.format);
  const barcodePreview = useMemo(() => {
    if (barcodePreviewIsMatrix && !matrixBarcodeLibrary) {
      return { labels: [], invalidRows: [] };
    }
    return buildBarcodeLabels(barcodeStudioRows, barcodeStudioSafeSettings, 10, matrixBarcodeLibrary);
  }, [barcodeStudioRows, barcodeStudioSafeSettings, barcodePreviewIsMatrix, matrixBarcodeLibrary]);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const ensureMatrixBarcodeLibrary = useCallback(async () => {
    if (matrixBarcodeLibrary && typeof matrixBarcodeLibrary.toSVG === 'function') {
      return matrixBarcodeLibrary;
    }
    if (matrixBarcodeLoaderRef.current) {
      return matrixBarcodeLoaderRef.current;
    }

    setMatrixBarcodeEngineLoading(true);
    setMatrixBarcodeEngineError('');

    matrixBarcodeLoaderRef.current = import('bwip-js')
      .then((module) => {
        const loaded = module?.default && typeof module.default.toSVG === 'function'
          ? module.default
          : module;

        if (!loaded || typeof loaded.toSVG !== 'function') {
          throw new Error('تعذر تحميل محرك QR/DataMatrix');
        }

        setMatrixBarcodeLibrary(loaded);
        return loaded;
      })
      .catch((err) => {
        const message = err?.message || 'تعذر تحميل محرك QR/DataMatrix';
        setMatrixBarcodeEngineError(message);
        throw err;
      })
      .finally(() => {
        setMatrixBarcodeEngineLoading(false);
        matrixBarcodeLoaderRef.current = null;
      });

    return matrixBarcodeLoaderRef.current;
  }, [matrixBarcodeLibrary]);

  const recalculateGridHeight = useCallback(() => {
    const viewportHeight = gridViewportRef.current?.clientHeight || 0;
    const headerHeight = gridHeaderRef.current?.offsetHeight || 0;
    const nextHeight = viewportHeight > 0
      ? Math.max(220, viewportHeight - headerHeight)
      : getGridHeight();

    setGridHeight((prev) => (Math.abs(prev - nextHeight) > 1 ? nextHeight : prev));
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumnKeys));
  }, [visibleColumnKeys]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BARCODE_STUDIO_STORAGE_KEY, JSON.stringify(sanitizeBarcodeStudioSettings(barcodeStudioSettings)));
  }, [barcodeStudioSettings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BARCODE_TEMPLATE_STORAGE_KEY, JSON.stringify(barcodeTemplates));
  }, [barcodeTemplates]);

  useEffect(() => {
    if (!showBarcodeStudio || !barcodePreviewIsMatrix) return;
    ensureMatrixBarcodeLibrary().catch(() => { });
  }, [showBarcodeStudio, barcodePreviewIsMatrix, ensureMatrixBarcodeLibrary]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => window.requestAnimationFrame(recalculateGridHeight);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [recalculateGridHeight]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      recalculateGridHeight();
      return undefined;
    }

    const observer = new ResizeObserver(() => recalculateGridHeight());
    if (gridViewportRef.current) observer.observe(gridViewportRef.current);
    if (gridHeaderRef.current) observer.observe(gridHeaderRef.current);
    recalculateGridHeight();

    return () => observer.disconnect();
  }, [recalculateGridHeight]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!columnsMenuRef.current) return;
      if (!columnsMenuRef.current.contains(event.target)) {
        setShowColumnMenu(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const loadCategories = useCallback(async () => {
    const res = await window.api.getCategories();
    if (!res?.error) setCategories(Array.isArray(res) ? res : []);
  }, []);

  const loadProducts = useCallback(async (options = false) => {
    const silent = typeof options === 'boolean' ? options : Boolean(options?.silent);
    const requestId = latestProductsRequestRef.current + 1;
    latestProductsRequestRef.current = requestId;

    const shouldBlockUi = !hasLoadedProductsRef.current && !silent;
    if (shouldBlockUi) setLoading(true);
    else setRefreshing(true);

    try {
      const allRows = [];
      let page = 1;
      let totalPages = 1;

      do {
        const res = await window.api.getProducts({
          page,
          pageSize: PRODUCT_FETCH_CHUNK,
          searchTerm: '',
          categoryId: categoryFilter || null,
          sortCol: activeSort.sortCol,
          sortDir: activeSort.sortDir,
          includeImage: false
        });

        if (res?.error) throw new Error(res.error);
        if (requestId !== latestProductsRequestRef.current) return;

        const rows = Array.isArray(res?.data) ? res.data : [];
        allRows.push(...rows);
        totalPages = Math.max(1, nInt(res?.totalPages, 1));
        page += 1;
      } while (page <= totalPages);

      setProducts(allRows);
      setTotalItems(allRows.length);

      setSelectedIds((prev) => {
        const valid = new Set(allRows.map((p) => p.id));
        const next = new Set();
        prev.forEach((id) => {
          if (valid.has(id)) next.add(id);
        });
        return next;
      });
    } catch (err) {
      if (requestId !== latestProductsRequestRef.current) return;
      await safeAlert(err.message || 'فشل تحميل البيانات', null, { type: 'error', title: 'المنتجات' });
    } finally {
      if (requestId !== latestProductsRequestRef.current) return;
      hasLoadedProductsRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeSort.sortCol, activeSort.sortDir, categoryFilter]);

  const loadSearchProducts = useCallback(async (rawTerm, options = false) => {
    const term = nText(rawTerm);
    const silent = typeof options === 'boolean' ? options : Boolean(options?.silent);
    const requestId = latestSearchRequestRef.current + 1;
    latestSearchRequestRef.current = requestId;

    if (!term) {
      setSearchResults([]);
      setSearchResultsTotal(0);
      setSearchLoading(false);
      return;
    }

    if (!silent) setSearchLoading(true);

    try {
      const allRows = [];
      let page = 1;
      let totalPages = 1;
      let total = 0;
      const pageSize = stockFilter === 'all' ? PRODUCT_SEARCH_LIMIT : PRODUCT_FETCH_CHUNK;

      do {
        const res = await window.api.getProducts({
          page,
          pageSize,
          searchTerm: term,
          categoryId: categoryFilter || null,
          sortCol: activeSort.sortCol,
          sortDir: activeSort.sortDir,
          includeImage: false
        });

        if (res?.error) throw new Error(res.error);
        if (requestId !== latestSearchRequestRef.current) return;

        const rows = Array.isArray(res?.data) ? res.data : [];
        allRows.push(...rows);
        total = nInt(res?.total, allRows.length);
        totalPages = Math.max(1, nInt(res?.totalPages, 1));
        page += 1;

        if (stockFilter === 'all' && allRows.length >= PRODUCT_SEARCH_LIMIT) break;
      } while (page <= totalPages);

      setSearchResults(stockFilter === 'all' ? allRows.slice(0, PRODUCT_SEARCH_LIMIT) : allRows);
      setSearchResultsTotal(total);
    } catch (err) {
      if (requestId !== latestSearchRequestRef.current) return;
      notify(err.message || 'تعذر تنفيذ البحث', 'error');
      setSearchResults([]);
      setSearchResultsTotal(0);
    } finally {
      if (requestId !== latestSearchRequestRef.current) return;
      setSearchLoading(false);
    }
  }, [activeSort.sortCol, activeSort.sortDir, categoryFilter, notify, stockFilter]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (nText(deferredSearchTerm)) return;
    loadProducts();
  }, [deferredSearchTerm, loadProducts]);

  useEffect(() => {
    const term = nText(deferredSearchTerm);
    if (!term) {
      latestSearchRequestRef.current += 1;
      setSearchResults([]);
      setSearchResultsTotal(0);
      setSearchLoading(false);
      return;
    }
    loadSearchProducts(term);
  }, [deferredSearchTerm, loadSearchProducts]);

  const refreshVisibleProducts = useCallback(async () => {
    const term = nText(deferredSearchTerm);
    if (term) {
      await Promise.all([loadProducts(true), loadSearchProducts(term, true)]);
      return;
    }
    await loadProducts(true);
  }, [deferredSearchTerm, loadProducts, loadSearchProducts]);

  const handleRefresh = useCallback(() => {
    const term = nText(deferredSearchTerm);
    if (term) {
      loadSearchProducts(term);
      return;
    }
    loadProducts(true);
  }, [deferredSearchTerm, loadProducts, loadSearchProducts]);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  const isSearchMode = nText(deferredSearchTerm).length > 0;
  const activeProducts = isSearchMode ? searchResults : products;

  const preparedProducts = useMemo(() => (
    activeProducts.map((product) => ({
      product,
      status: stock(product)
    }))
  ), [activeProducts]);

  const productMetaMap = useMemo(() => {
    const map = new Map();
    preparedProducts.forEach((entry) => {
      map.set(entry.product.id, entry);
    });
    return map;
  }, [preparedProducts]);

  const filteredProductResult = useMemo(() => {
    const usesServerLimitedSet = isSearchMode && stockFilter === 'all';
    const out = [];
    let totalMatches = usesServerLimitedSet ? searchResultsTotal : 0;

    for (const entry of preparedProducts) {
      if (stockFilter === 'available' && entry.status.key !== 'ok') continue;
      if (stockFilter === 'low' && entry.status.key !== 'low') continue;
      if (stockFilter === 'out' && entry.status.key !== 'out') continue;
      if (!usesServerLimitedSet) totalMatches += 1;
      out.push(entry.product);
    }

    return {
      rows: out,
      totalMatches,
      isLimited: usesServerLimitedSet && searchResultsTotal > out.length
    };
  }, [isSearchMode, preparedProducts, searchResultsTotal, stockFilter]);

  const visibleProducts = filteredProductResult.rows;
  const filteredTotal = filteredProductResult.totalMatches;
  const isSearchLimited = filteredProductResult.isLimited;
  const isSearchTyping = nText(searchTerm) !== nText(debouncedSearchTerm);
  const isSearchBusy = isSearchMode && searchLoading;
  const tableLoading = loading || isSearchBusy;

  // بحث في الأعمدة
  const columnFilteredProducts = useMemo(() => {
    if (Object.keys(debouncedColumnSearches).length === 0) return visibleProducts;

    return visibleProducts.filter((product) => {
      for (const [columnKey, searchValue] of Object.entries(debouncedColumnSearches)) {
        const trimmed = nText(searchValue);
        if (!trimmed) continue;

        let cellValue = '';
        switch (columnKey) {
          case 'name':
            cellValue = nText(product.name);
            break;
          case 'code':
            cellValue = nText(product.sku) || nText(product.barcode) || `#${product.id}`;
            break;
          case 'category':
            cellValue = nText(categoryMap.get(product.categoryId)?.name);
            break;
          case 'warehouse':
            cellValue = String(nInt(product?.inventory?.warehouseQty, 0));
            break;
          case 'unit':
            cellValue = nText(mainUnitOf(product)?.unitName) || DEFAULT_UNIT;
            break;
          case 'quantity':
            cellValue = String(productMetaMap.get(product.id)?.status?.total || 0);
            break;
          case 'salePrice':
            cellValue = String(salePriceOf(product));
            break;
          case 'costPrice':
            cellValue = String(costPriceOf(product));
            break;
          case 'wholesalePrice':
            cellValue = String(wholesale(product));
            break;
          case 'brand':
            cellValue = nText(product.brand);
            break;
          case 'barcode':
            cellValue = nText(product.barcode);
            break;
          default:
            cellValue = '';
        }

        if (!cellValue.toLowerCase().includes(trimmed.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [visibleProducts, debouncedColumnSearches, categoryMap, productMetaMap]);

  const handleColumnSearchChange = (columnKey, value) => {
    setColumnSearches((prev) => ({
      ...prev,
      [columnKey]: value
    }));
  };

  const displayedProducts = columnFilteredProducts;

  const metrics = useMemo(() => {
    let variantsCount = 0;
    let stockTotal = 0;
    let lowStockCount = 0;

    preparedProducts.forEach(({ product, status }) => {
      variantsCount += product.variants?.length || 0;
      stockTotal += status.total;
      if (status.key !== 'ok') lowStockCount += 1;
    });

    return {
      productsCount: totalItems,
      variantsCount,
      stockTotal,
      lowStockCount
    };
  }, [preparedProducts, totalItems]);

  const allVisibleSelected = useMemo(() => (
    displayedProducts.length > 0 && displayedProducts.every((p) => selectedIds.has(p.id))
  ), [selectedIds, displayedProducts]);

  const activeColumns = useMemo(() => {
    const optionalSet = new Set(visibleColumnKeys);
    return GRID_COLUMNS.filter((column) => column.required || optionalSet.has(column.key));
  }, [visibleColumnKeys]);

  const gridTemplateColumns = useMemo(
    () => {
      // تجميع widths بحيث تتقلص الأعمدة تلقائياً عند إضافة أعمدة جديدة
      return activeColumns.map((column) => column.width).join(' ');
    },
    [activeColumns]
  );

  const gridContentWidth = useMemo(
    () => '100%',
    []
  );

  const fetchProductDetails = useCallback(async (productId) => {
    const res = await window.api.getProduct(productId);
    if (res?.error) throw new Error(res.error);
    if (!res?.id) throw new Error('تعذر تحميل بيانات المنتج');
    return res;
  }, []);

  const openCreate = useCallback(() => {
    void loadProductModal();
    setModalMode('create');
    setEditingProduct(null);
    setShowProductModal(true);
  }, []);

  const openEdit = useCallback(async (product) => {
    void loadProductModal();
    try {
      const detailedProduct = await fetchProductDetails(product.id);
      setModalMode('edit');
      setEditingProduct(detailedProduct);
      setShowProductModal(true);
    } catch (err) {
      await safeAlert(err.message || 'تعذر تحميل بيانات المنتج', null, { type: 'error', title: 'تعديل منتج' });
    }
  }, [fetchProductDetails]);

  const closeProductModal = useCallback(() => {
    setShowProductModal(false);
    setEditingProduct(null);
  }, []);

  const handleSaveProduct = async (productData) => {
    setSaving(true);
    try {
      const editingId = modalMode === 'edit' ? editingProduct?.id : null;
      const rawUnits = Array.isArray(productData.units) ? productData.units : [];
      const normalizedUnits = rawUnits
        .map((unit, index) => {
          const salePrice = Math.max(0, nNum(unit?.salePrice, 0));
          const purchasePrice = Math.max(0, nNum(unit?.purchasePrice, 0));
          const wholesalePrice = Math.min(salePrice, Math.max(0, nNum(unit?.wholesalePrice, salePrice)));
          const minSalePrice = Math.min(salePrice, Math.max(0, nNum(unit?.minSalePrice, wholesalePrice)));

          return {
            unitName: nText(unit?.unitName) || (index === 0 ? DEFAULT_UNIT : ''),
            conversionFactor: index === 0 ? 1 : Math.max(0.0001, nNum(unit?.conversionFactor, 1)),
            salePrice,
            wholesalePrice,
            minSalePrice,
            purchasePrice,
            barcode: nText(unit?.barcode) || null
          };
        })
        .filter((unit, index) => index === 0 || unit.unitName || unit.barcode || unit.salePrice || unit.purchasePrice);

      if (!normalizedUnits.length || !nText(normalizedUnits[0].unitName)) {
        throw new Error('يجب إدخال وحدة أساسية واحدة على الأقل.');
      }

      const unitBarcodeValues = normalizedUnits.map((unit) => nText(unit.barcode).toLowerCase()).filter(Boolean);
      if (new Set(unitBarcodeValues).size !== unitBarcodeValues.length) {
        throw new Error('يوجد باركود مكرر بين الوحدات.');
      }

      const normalizedVariants = (productData.hasVariants ? (Array.isArray(productData.variants) ? productData.variants : []) : [])
        .map((variant) => ({
          id: variant?.id ? nInt(variant.id, null) : null,
          tempId: nText(variant?.tempId) || null,
          size: nText(variant?.size) || 'موحد',
          color: nText(variant?.color) || 'افتراضي',
          price: Math.max(0, nNum(variant?.price, normalizedUnits[0]?.salePrice || 0)),
          cost: Math.max(0, nNum(variant?.cost, normalizedUnits[0]?.purchasePrice || 0)),
          quantity: Math.max(0, nInt(variant?.quantity, 0)),
          barcode: nText(variant?.barcode) || null
        }))
        .filter((variant) => variant.size || variant.color || variant.price || variant.cost || variant.quantity || variant.barcode);

      if (productData.hasVariants && normalizedVariants.length === 0) {
        throw new Error('يجب إضافة متغير واحد على الأقل عند تفعيل الألوان/المقاسات.');
      }

      const variantBarcodeValues = normalizedVariants.map((variant) => nText(variant.barcode).toLowerCase()).filter(Boolean);
      if (new Set(variantBarcodeValues).size !== variantBarcodeValues.length) {
        throw new Error('يوجد باركود مكرر بين المتغيرات.');
      }

      const allInternalBarcodes = [
        ...unitBarcodeValues,
        ...variantBarcodeValues,
        nText(productData.barcode).toLowerCase()
      ].filter(Boolean);
      if (new Set(allInternalBarcodes).size !== allInternalBarcodes.length) {
        throw new Error('يوجد تعارض باركود داخل نفس المنتج.');
      }

      const mainUnit = normalizedUnits[0];
      const sku = nText(productData.sku || productData.code);
      const barcode = nText(productData.barcode) || nText(mainUnit.barcode);

      if (sku && products.some((product) => product.id !== editingId && nText(product.sku).toLowerCase() === sku.toLowerCase())) {
        throw new Error('كود الصنف (SKU) مستخدم بالفعل.');
      }
      if (barcode && products.some((product) => product.id !== editingId && nText(product.barcode).toLowerCase() === barcode.toLowerCase())) {
        throw new Error('باركود المنتج مستخدم بالفعل.');
      }
      if (variantBarcodeValues.some((variantBarcode) => (
        products.some((product) => (
          product.id !== editingId
          && Array.isArray(product.variants)
          && product.variants.some((variant) => nText(variant.barcode).toLowerCase() === variantBarcode)
        ))
      ))) {
        throw new Error('يوجد باركود متغير مستخدم في منتج آخر.');
      }

      const payload = {
        name: nText(productData.name),
        categoryId: productData.categoryId ? nInt(productData.categoryId, null) : null,
        brand: nText(productData.brand) || null,
        description: nText(productData.description) || null,
        sku: sku || null,
        barcode: barcode || null,
        image: nText(productData.image) || null,
        isActive: productData.isActive !== false,
        type: nText(productData.type) || 'store',
        basePrice: nNum(productData.basePrice, mainUnit.salePrice),
        cost: nNum(productData.cost, mainUnit.purchasePrice),
        openingQty: Math.max(0, nInt(productData.openingQty, 0)),
        displayQty: Math.max(0, nInt(productData.displayQty, 0)),
        minStock: Math.max(0, nInt(productData.minStock, 5)),
        maxStock: Math.max(0, nInt(productData.maxStock, 100)),
        notes: nText(productData.notes) || null,
        units: normalizedUnits,
        hasVariants: Boolean(productData.hasVariants),
        variants: normalizedVariants
      };

      if (!payload.name) throw new Error('اسم الصنف مطلوب.');
      payload.maxStock = Math.max(payload.maxStock, payload.minStock);

      const res = modalMode === 'create'
        ? await window.api.addProduct(payload)
        : await window.api.updateProduct(editingProduct.id, payload);

      if (res?.error) throw new Error(res.error);

      const productId = modalMode === 'create' ? res?.id : editingProduct?.id;
      if (productId) {
        let finalVariants = [];
        if (payload.hasVariants) {
          if (modalMode === 'create') {
            for (const variant of payload.variants) {
              const addVariantRes = await window.api.addVariant({
                productId,
                size: variant.size,
                color: variant.color,
                price: variant.price,
                cost: variant.cost,
                quantity: variant.quantity,
                barcode: variant.barcode
              });
              if (addVariantRes?.error) throw new Error(addVariantRes.error);
              finalVariants.push(addVariantRes);
            }
          } else {
            const existingVariants = Array.isArray(editingProduct?.variants) ? editingProduct.variants : [];
            const existingById = new Map(existingVariants.map((variant) => [variant.id, variant]));
            const keepIds = new Set();

            for (const variant of payload.variants) {
              if (variant.id && existingById.has(variant.id)) {
                const updateVariantRes = await window.api.updateVariant(variant.id, {
                  size: variant.size,
                  color: variant.color,
                  price: variant.price,
                  cost: variant.cost,
                  quantity: variant.quantity,
                  barcode: variant.barcode
                });
                if (updateVariantRes?.error) throw new Error(updateVariantRes.error);
                keepIds.add(variant.id);
                finalVariants.push(updateVariantRes);
              } else {
                const addVariantRes = await window.api.addVariant({
                  productId,
                  size: variant.size,
                  color: variant.color,
                  price: variant.price,
                  cost: variant.cost,
                  quantity: variant.quantity,
                  barcode: variant.barcode
                });
                if (addVariantRes?.error) throw new Error(addVariantRes.error);
                if (addVariantRes?.id) keepIds.add(addVariantRes.id);
                finalVariants.push(addVariantRes);
              }
            }

            const toDelete = existingVariants.filter((variant) => !keepIds.has(variant.id));
            for (const variant of toDelete) {
              const deleteVariantRes = await window.api.deleteVariant(variant.id);
              if (deleteVariantRes?.error) throw new Error(deleteVariantRes.error);
            }
          }
        } else if (modalMode === 'edit') {
          const existingVariants = Array.isArray(editingProduct?.variants) ? editingProduct.variants : [];
          for (const variant of existingVariants) {
            const deleteVariantRes = await window.api.deleteVariant(variant.id);
            if (deleteVariantRes?.error) throw new Error(deleteVariantRes.error);
          }
        }

        const previousInventory = modalMode === 'edit' ? (editingProduct?.inventory || {}) : {};
        const warehouseQty = Math.max(0, nInt(payload.openingQty, nInt(previousInventory?.warehouseQty, 0)));
        const displayQty = Math.max(0, nInt(payload.displayQty, nInt(previousInventory?.displayQty, 0)));
        const variantsTotal = payload.hasVariants
          ? finalVariants.reduce((sum, variant) => sum + nInt(variant.quantity, 0), 0)
          : 0;

        const inventoryPayload = {
          minStock: Math.max(0, nInt(payload.minStock, nInt(previousInventory?.minStock, 5))),
          maxStock: Math.max(0, nInt(payload.maxStock, nInt(previousInventory?.maxStock, 100))),
          warehouseQty,
          displayQty,
          totalQuantity: Math.max(warehouseQty + displayQty, variantsTotal),
          notes: payload.notes || null,
          lastRestock: warehouseQty + displayQty > 0 ? new Date().toISOString() : null
        };
        inventoryPayload.maxStock = Math.max(inventoryPayload.maxStock, inventoryPayload.minStock);

        const inventoryRes = await window.api.updateInventory(productId, inventoryPayload);
        if (inventoryRes?.error) throw new Error(inventoryRes.error);
      }

      closeProductModal();
      await Promise.all([refreshVisibleProducts(), loadCategories()]);
      notify(modalMode === 'create' ? 'تم إنشاء المنتج بنجاح' : 'تم تحديث المنتج بنجاح', 'success');
    } catch (err) {
      await safeAlert(err.message || 'فشل حفظ المنتج', null, { type: 'error', title: 'المنتجات' });
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = useCallback(async (product) => {
    const ok = await safeConfirm(`سيتم حذف المنتج "${product.name}". هل تريد المتابعة؟`, { title: 'حذف منتج' });
    if (!ok) return;

    const res = await window.api.deleteProduct(product.id);
    if (res?.error) {
      await safeAlert(res.error, null, { type: 'error', title: 'تعذر الحذف' });
      return;
    }

    await refreshVisibleProducts();
    notify('تم حذف المنتج', 'success');
  }, [notify, refreshVisibleProducts]);

  const duplicateProduct = useCallback(async (product) => {
    try {
      const sourceProduct = await fetchProductDetails(product.id);

      const copiedUnits = unitsOf(sourceProduct).map((unit, index) => ({
        unitName: nText(unit?.unitName) || (index === 0 ? DEFAULT_UNIT : ''),
        conversionFactor: index === 0 ? 1 : Math.max(0.0001, nNum(unit?.conversionFactor, 1)),
        salePrice: Math.max(0, nNum(unit?.salePrice, salePriceOf(sourceProduct))),
        wholesalePrice: Math.max(0, nNum(unit?.wholesalePrice, salePriceOf(sourceProduct))),
        minSalePrice: Math.max(0, nNum(unit?.minSalePrice, salePriceOf(sourceProduct))),
        purchasePrice: Math.max(0, nNum(unit?.purchasePrice, costPriceOf(sourceProduct))),
        barcode: null
      }));

      const res = await window.api.addProduct({
        name: `${sourceProduct.name} - نسخة`,
        description: sourceProduct.description || null,
        categoryId: sourceProduct.categoryId || null,
        brand: sourceProduct.brand || null,
        sku: null,
        barcode: null,
        image: sourceProduct.image || null,
        basePrice: salePriceOf(sourceProduct),
        cost: costPriceOf(sourceProduct),
        isActive: sourceProduct.isActive ?? true,
        type: sourceProduct.type || 'store',
        openingQty: nInt(sourceProduct?.inventory?.warehouseQty, 0),
        units: copiedUnits.length ? copiedUnits : undefined
      });
      if (res?.error) throw new Error(res.error);

      const newId = res.id;
      for (const variant of (sourceProduct.variants || [])) {
        const add = await window.api.addVariant({
          productId: newId,
          size: variant.productSize || 'M',
          color: variant.color || 'افتراضي',
          price: Number(variant.price || salePriceOf(sourceProduct) || 0),
          cost: Number(variant.cost || costPriceOf(sourceProduct) || 0),
          quantity: nInt(variant.quantity, 0),
          barcode: null
        });
        if (add?.error) throw new Error(add.error);
      }

      const inv = await window.api.updateInventory(newId, {
        minStock: nInt(sourceProduct?.inventory?.minStock, 5),
        maxStock: nInt(sourceProduct?.inventory?.maxStock, 100),
        warehouseQty: nInt(sourceProduct?.inventory?.warehouseQty, 0),
        displayQty: nInt(sourceProduct?.inventory?.displayQty, 0),
        totalQuantity: nInt(sourceProduct?.inventory?.totalQuantity, 0),
        notes: nText(sourceProduct?.inventory?.notes) || null,
        lastRestock: new Date().toISOString()
      });
      if (inv?.error) throw new Error(inv.error);

      await refreshVisibleProducts();
      notify('تم إنشاء نسخة من المنتج', 'success');
    } catch (err) {
      await safeAlert(err.message || 'فشل نسخ المنتج', null, { type: 'error', title: 'نسخ منتج' });
    }
  }, [fetchProductDetails, notify, refreshVisibleProducts]);

  const toggleId = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) displayedProducts.forEach((p) => next.delete(p.id));
      else displayedProducts.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const toggleColumnVisibility = (columnKey) => {
    const column = GRID_COLUMNS.find((item) => item.key === columnKey);
    if (!column || column.required) return;

    setVisibleColumnKeys((prev) => {
      if (prev.includes(columnKey)) {
        return prev.filter((item) => item !== columnKey);
      }
      return [...prev, columnKey];
    });
  };

  const showVariantsSummary = useCallback(async (product) => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (!variants.length) {
      await safeAlert('لا توجد متغيرات مسجلة لهذا الصنف', null, { title: 'المتغيرات', type: 'info' });
      return;
    }

    const lines = variants.slice(0, 40).map((variant, idx) => (
      `${idx + 1}) ${variant.productSize || '-'} / ${variant.color || '-'} | كمية ${nInt(variant.quantity, 0)} | بيع ${money(variant.price)}`
    ));
    const overflowText = variants.length > 40 ? `\n... +${variants.length - 40} متغير إضافي` : '';
    await safeAlert(`${lines.join('\n')}${overflowText}`, null, { title: `متغيرات: ${product.name}` });
  }, []);

  const setBarcodeSetting = useCallback((key, value) => {
    setBarcodeStudioSettings((prev) => {
      const next = { ...prev, [key]: value };

      if (key === 'format' && isMatrixBarcodeFormat(value)) {
        next.barcodeHeightMm = Math.max(inRange(prev.barcodeHeightMm, DEFAULT_BARCODE_STUDIO.barcodeHeightMm, 6, 80), 16);
        next.barcodeWidthPx = Math.max(inRange(prev.barcodeWidthPx, DEFAULT_BARCODE_STUDIO.barcodeWidthPx, 1, 6), 2);
      }

      return next;
    });
  }, []);

  const setBarcodeNumberSetting = useCallback((key, rawValue, min, max) => {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) return;
    setBarcodeStudioSettings((prev) => ({ ...prev, [key]: Math.min(max, Math.max(min, num)) }));
  }, []);

  const applyBarcodePreset = useCallback((presetId) => {
    const preset = BARCODE_LABEL_PRESETS.find((item) => item.id === presetId) || BARCODE_LABEL_PRESETS[0];
    setBarcodeStudioSettings((prev) => {
      if (preset.id === 'custom') {
        return { ...prev, presetId: 'custom' };
      }
      return {
        ...prev,
        presetId: preset.id,
        labelWidthMm: preset.widthMm,
        labelHeightMm: preset.heightMm
      };
    });
  }, []);

  const applyBarcodeTemplate = useCallback((templateId) => {
    setActiveBarcodeTemplateId(templateId);
    if (!templateId) return;

    const template = barcodeTemplates.find((item) => item.id === templateId);
    if (!template) return;

    setBarcodeStudioSettings(sanitizeBarcodeStudioSettings(template.settings));
    setBarcodeTemplateName(template.name);
    setBarcodeTemplatePrinter(template.printer || '');
  }, [barcodeTemplates]);

  const saveNewBarcodeTemplate = useCallback(async () => {
    const name = normalizeTemplateValue(barcodeTemplateName, 80);
    if (!name) {
      await safeAlert('اكتب اسم القالب قبل الحفظ', null, { type: 'warning', title: 'قوالب الطباعة' });
      return;
    }

    const now = Date.now();
    const template = {
      id: `barcode-template-${now}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      printer: normalizeTemplateValue(barcodeTemplatePrinter, 80),
      settings: sanitizeBarcodeStudioSettings(barcodeStudioSettings),
      createdAt: now,
      updatedAt: now
    };

    setBarcodeTemplates((prev) => [template, ...prev].sort((a, b) => b.updatedAt - a.updatedAt));
    setActiveBarcodeTemplateId(template.id);
    notify(`تم حفظ القالب "${name}"`, 'success');
  }, [barcodeTemplateName, barcodeTemplatePrinter, barcodeStudioSettings, notify]);

  const updateBarcodeTemplate = useCallback(async () => {
    if (!activeBarcodeTemplate) {
      await safeAlert('اختر قالبًا محفوظًا أولاً', null, { type: 'warning', title: 'قوالب الطباعة' });
      return;
    }

    const nextName = normalizeTemplateValue(barcodeTemplateName || activeBarcodeTemplate.name, 80);
    if (!nextName) {
      await safeAlert('اسم القالب لا يمكن أن يكون فارغًا', null, { type: 'warning', title: 'قوالب الطباعة' });
      return;
    }

    const nextPrinter = normalizeTemplateValue(barcodeTemplatePrinter, 80);
    const now = Date.now();

    setBarcodeTemplates((prev) => (
      prev
        .map((item) => {
          if (item.id !== activeBarcodeTemplate.id) return item;
          return {
            ...item,
            name: nextName,
            printer: nextPrinter,
            settings: sanitizeBarcodeStudioSettings(barcodeStudioSettings),
            updatedAt: now
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt)
    ));

    setBarcodeTemplateName(nextName);
    setBarcodeTemplatePrinter(nextPrinter);
    notify(`تم تحديث القالب "${nextName}"`, 'success');
  }, [activeBarcodeTemplate, barcodeTemplateName, barcodeTemplatePrinter, barcodeStudioSettings, notify]);

  const deleteBarcodeTemplate = useCallback(async () => {
    if (!activeBarcodeTemplate) {
      await safeAlert('اختر قالبًا لحذفه', null, { type: 'warning', title: 'قوالب الطباعة' });
      return;
    }

    const confirmed = await safeConfirm(`حذف القالب "${activeBarcodeTemplate.name}"؟`, { title: 'قوالب الطباعة' });
    if (!confirmed) return;

    setBarcodeTemplates((prev) => prev.filter((item) => item.id !== activeBarcodeTemplate.id));
    setActiveBarcodeTemplateId('');
    setBarcodeTemplateName('');
    setBarcodeTemplatePrinter('');
    notify('تم حذف القالب', 'warning');
  }, [activeBarcodeTemplate, notify]);

  const buildStudioLabels = useCallback(async (safeSettings) => {
    let matrixLibrary = matrixBarcodeLibrary;
    if (isMatrixBarcodeFormat(safeSettings.format)) {
      matrixLibrary = await ensureMatrixBarcodeLibrary();
    }
    return buildBarcodeLabels(barcodeStudioRows, safeSettings, Number.POSITIVE_INFINITY, matrixLibrary);
  }, [barcodeStudioRows, matrixBarcodeLibrary, ensureMatrixBarcodeLibrary]);

  const resetBarcodeStudioSettings = useCallback(() => {
    setBarcodeStudioSettings(DEFAULT_BARCODE_STUDIO);
  }, []);

  const closeBarcodeStudio = useCallback(() => {
    if (barcodePrinting) return;
    setShowBarcodeStudio(false);
    setBarcodeStudioProducts([]);
  }, [barcodePrinting]);

  const openBarcodeStudio = useCallback(async (targetProducts) => {
    const rows = barcodeRows(Array.isArray(targetProducts) ? targetProducts : []);
    if (!rows.length) {
      await safeAlert('لا توجد عناصر صالحة للطباعة', null, { type: 'warning', title: 'طباعة باركود' });
      return;
    }

    setBarcodeStudioProducts(targetProducts);
    setBarcodeStudioTab('templates');
    setShowBarcodeStudio(true);
  }, []);

  const executeBarcodeStudioPrint = async () => {
    if (barcodePrinting || !barcodeStudioRows.length) return;

    const safeSettings = sanitizeBarcodeStudioSettings(barcodeStudioSettings);
    let labelsResult = { labels: [], invalidRows: [] };

    try {
      labelsResult = await buildStudioLabels(safeSettings);
    } catch (err) {
      await safeAlert(err.message || 'تعذر تحميل محرك الباركود الثنائي الأبعاد', null, { type: 'error', title: 'طباعة باركود' });
      return;
    }

    const { labels, invalidRows } = labelsResult;

    if (!labels.length) {
      const details = invalidRows.slice(0, 6).map((item, idx) => `${idx + 1}) ${nText(item?.row?.name) || 'بدون اسم'} | ${nText(item?.row?.code) || '-'}`);
      const helpText = details.length ? `\n\nأمثلة:\n${details.join('\n')}` : '';
      await safeAlert(`لا توجد أكواد صالحة للطباعة بصيغة ${safeSettings.format}.${helpText}`, null, { type: 'error', title: 'طباعة باركود' });
      return;
    }

    setBarcodePrinting(true);
    try {
      const html = barcodeStudioHtml(labels, safeSettings);
      const result = await safePrint(html, { title: `ملصقات باركود المنتجات (${labels.length})` });
      if (result?.error) throw new Error(result.error);

      notify(
        `تم فتح معاينة ${labels.length} ملصق${invalidRows.length ? `، وتم تجاهل ${invalidRows.length} كود غير صالح` : ''}`,
        invalidRows.length ? 'warning' : 'success'
      );
    } catch (err) {
      await safeAlert(err.message || 'فشل طباعة الباركود', null, { type: 'error', title: 'طباعة باركود' });
    } finally {
      setBarcodePrinting(false);
    }
  };

  const executeBarcodeStudioPdfExport = async () => {
    if (barcodePrinting || !barcodeStudioRows.length) return;

    if (typeof window === 'undefined' || !window.api?.exportPDF) {
      await safeAlert('تصدير PDF متاح داخل تطبيق سطح المكتب فقط', null, { type: 'warning', title: 'تصدير PDF' });
      return;
    }

    const safeSettings = sanitizeBarcodeStudioSettings(barcodeStudioSettings);
    let labelsResult = { labels: [], invalidRows: [] };

    try {
      labelsResult = await buildStudioLabels(safeSettings);
    } catch (err) {
      await safeAlert(err.message || 'تعذر تحميل محرك الباركود الثنائي الأبعاد', null, { type: 'error', title: 'تصدير PDF' });
      return;
    }

    const { labels, invalidRows } = labelsResult;
    if (!labels.length) {
      const details = invalidRows.slice(0, 6).map((item, idx) => `${idx + 1}) ${nText(item?.row?.name) || 'بدون اسم'} | ${nText(item?.row?.code) || '-'}`);
      const helpText = details.length ? `\n\nأمثلة:\n${details.join('\n')}` : '';
      await safeAlert(`لا توجد أكواد صالحة للتصدير بصيغة ${safeSettings.format}.${helpText}`, null, { type: 'error', title: 'تصدير PDF' });
      return;
    }

    setBarcodePrinting(true);
    try {
      const html = barcodeStudioHtml(labels, safeSettings);
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const result = await window.api.exportPDF({
        html,
        title: `ملصقات باركود المنتجات (${labels.length})`,
        suggestedName: `barcode-labels-${stamp}.pdf`
      });

      if (result?.error) throw new Error(result.error);
      if (result?.canceled) {
        notify('تم إلغاء تصدير PDF', 'warning');
        return;
      }

      notify(
        `تم حفظ ملف PDF${invalidRows.length ? `، وتم تجاهل ${invalidRows.length} كود غير صالح` : ''}`,
        invalidRows.length ? 'warning' : 'success'
      );
    } catch (err) {
      await safeAlert(err.message || 'فشل تصدير ملف PDF', null, { type: 'error', title: 'تصدير PDF' });
    } finally {
      setBarcodePrinting(false);
    }
  };

  const printBarcodes = useCallback(async (targetProducts) => {
    await openBarcodeStudio(targetProducts);
  }, [openBarcodeStudio]);

  const printSelected = async () => {
    const selected = visibleProducts.filter((p) => selectedIds.has(p.id));
    if (!selected.length) {
      await safeAlert('اختر منتجًا واحدًا على الأقل', null, { type: 'warning', title: 'طباعة باركود' });
      return;
    }
    await printBarcodes(selected);
  };

  const exportCsv = () => {
    if (!visibleProducts.length) {
      notify('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = [
      'اسم المنتج', 'الفئة', 'الماركة', 'SKU', 'باركود المنتج', 'الوصف',
      'المقاس', 'اللون', 'سعر البيع', 'التكلفة', 'الكمية', 'باركود المتغير',
      'مخزن', 'عرض', 'الحد الأدنى'
    ];

    const rows = [];
    visibleProducts.forEach((p) => {
      const cat = categories.find((c) => c.id === p.categoryId)?.name || '';
      const variants = p.variants || [];
      if (!variants.length) {
        rows.push([
          p.name || '', cat, p.brand || '', p.sku || '', p.barcode || '', p.description || '',
          '', '', salePriceOf(p).toFixed(2), costPriceOf(p).toFixed(2), '', '',
          nInt(p.inventory?.warehouseQty, 0), nInt(p.inventory?.displayQty, 0), nInt(p.inventory?.minStock, 5)
        ]);
      } else {
        variants.forEach((v, i) => {
          rows.push([
            p.name || '', cat, p.brand || '', p.sku || '', p.barcode || '', i === 0 ? p.description || '' : '',
            v.productSize || '', v.color || '', Number(v.price || p.basePrice || 0).toFixed(2), Number(v.cost || p.cost || 0).toFixed(2),
            nInt(v.quantity, 0), v.barcode || '',
            i === 0 ? nInt(p.inventory?.warehouseQty, 0) : '',
            i === 0 ? nInt(p.inventory?.displayQty, 0) : '',
            i === 0 ? nInt(p.inventory?.minStock, 5) : ''
          ]);
        });
      }
    });

    const text = [headers, ...rows].map((r) => r.map(csv).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${text}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    link.href = url;
    link.download = `products-export-${stamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    notify('تم تصدير CSV متوافق مع Excel', 'success');
  };

  const ensureCategory = useCallback(async (name, map) => {
    const key = nText(name).toLowerCase();
    if (!key) return null;
    if (map.has(key)) return map.get(key).id;

    const add = await window.api.addCategory({ name: nText(name), description: null, color: '#0f766e', icon: '🧵' });
    if (add?.error) throw new Error(add.error);
    map.set(key, add);
    return add.id;
  }, []);

  const closeImportSession = useCallback(() => {
    if (importing) return;
    setImportSession(null);
  }, [importing]);

  const updateImportFieldMapping = useCallback((fieldKey, columnId) => {
    setImportSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        mapping: {
          ...prev.mapping,
          [fieldKey]: columnId
        }
      };
    });
  }, []);

  const applyAutoImportMapping = useCallback(() => {
    setImportSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        mapping: buildImportFieldAutoMapping(prev.headers)
      };
    });
  }, []);

  const importGroupsIntoDatabase = useCallback(async (groups) => {
    const allRes = await window.api.getProducts({
      page: 1,
      pageSize: 5000,
      includeTotal: false,
      includeDescription: false,
      includeImage: false,
      includeCategory: false,
      includeInventory: false,
      includeProductUnits: false,
      includeVariants: true
    });
    if (allRes?.error) throw new Error(allRes.error);
    const all = Array.isArray(allRes?.data) ? allRes.data : [];
    const bySku = new Map();
    all.forEach((p) => {
      const key = nText(p.sku).toLowerCase();
      if (key) bySku.set(key, p);
    });

    const catMap = new Map();
    categories.forEach((c) => catMap.set(nText(c.name).toLowerCase(), c));

    let created = 0;
    let updated = 0;
    let addV = 0;
    let updV = 0;
    let failed = 0;

    for (const g of groups) {
      try {
        const categoryId = await ensureCategory(g.product.category, catMap);
        const payload = {
          name: g.product.name,
          description: g.product.description || null,
          categoryId,
          brand: g.product.brand || null,
          sku: g.product.sku || null,
          barcode: g.product.barcode || null,
          image: g.product.image || null,
          basePrice: nNum(g.product.basePrice, 0),
          cost: nNum(g.product.cost, 0)
        };

        const skuKey = nText(payload.sku).toLowerCase();
        const current = skuKey ? bySku.get(skuKey) : null;
        let productId = current?.id || 0;
        const known = current?.variants || [];

        if (current) {
          const up = await window.api.updateProduct(current.id, payload);
          if (up?.error) throw new Error(up.error);
          updated += 1;
        } else {
          const add = await window.api.addProduct(payload);
          if (add?.error) throw new Error(add.error);
          productId = add.id;
          created += 1;
          if (skuKey) bySku.set(skuKey, { ...add, variants: [] });
        }

        for (const v of g.variants) {
          const b = nText(v.barcode).toLowerCase();
          const found = known.find((item) => {
            if (b && nText(item.barcode).toLowerCase() === b) return true;
            return nText(item.productSize).toLowerCase() === nText(v.size).toLowerCase()
              && nText(item.color).toLowerCase() === nText(v.color).toLowerCase();
          });

          const data = {
            productId,
            size: v.size,
            color: v.color,
            price: nNum(v.price, payload.basePrice),
            cost: nNum(v.cost, payload.cost),
            quantity: nInt(v.quantity, 0),
            barcode: nText(v.barcode) || null
          };

          if (found) {
            const up = await window.api.updateVariant(found.id, data);
            if (up?.error) throw new Error(up.error);
            updV += 1;
          } else {
            const add = await window.api.addVariant(data);
            if (add?.error) throw new Error(add.error);
            addV += 1;
          }
        }

        const vTotal = g.variants.reduce((s, v) => s + nInt(v.quantity, 0), 0);
        const w = nInt(g.inventory.warehouseQty, 0);
        const dis = nInt(g.inventory.displayQty, 0);
        const inv = await window.api.updateInventory(productId, {
          minStock: nInt(g.inventory.minStock, 5),
          maxStock: nInt(g.inventory.maxStock, 100),
          warehouseQty: w,
          displayQty: dis,
          totalQuantity: Math.max(w + dis, vTotal),
          notes: g.inventory.notes || null,
          lastRestock: new Date().toISOString()
        });
        if (inv?.error) throw new Error(inv.error);
      } catch (err) {
        failed += 1;
        console.error('import failed', err);
      }
    }

    await Promise.all([loadCategories(), refreshVisibleProducts()]);
    notify(`تم الاستيراد: ${created} جديد، ${updated} تحديث، ${addV} متغير مضاف، ${updV} متغير محدث${failed ? `، ${failed} فشل` : ''}`, failed ? 'warning' : 'success');
  }, [categories, ensureCategory, loadCategories, notify, refreshVisibleProducts]);

  const startMappedImport = async () => {
    if (!importSession || importing) return;

    if (!nText(importSession.mapping?.name)) {
      await safeAlert('اختَر عمود "اسم المنتج" قبل بدء الاستيراد', null, { type: 'warning', title: 'مطابقة الأعمدة' });
      return;
    }

    setImporting(true);
    try {
      const mappedRows = mapRowsWithImportMapping(importSession.rows, importSession.mapping)
        .filter((row) => Object.values(row).some((value) => nText(value) !== ''));

      const groups = importGroups(mappedRows);
      if (!groups.length) throw new Error('لم يتم العثور على صفوف صالحة بعد تطبيق المطابقة');

      await importGroupsIntoDatabase(groups);
      setImportSession(null);
    } catch (err) {
      await safeAlert(err.message || 'فشل الاستيراد', null, { type: 'error', title: 'استيراد Excel' });
    } finally {
      setImporting(false);
    }
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const fileName = nText(file.name).toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        throw new Error('الملف بصيغة XLSX/XLS غير مدعوم حاليًا. احفظه من Excel كـ CSV ثم أعد الاستيراد.');
      }

      const content = await file.text();
      const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error('الملف لا يحتوي على بيانات كافية');

      const d = delimiter(lines[0]);
      const headers = toImportHeaders(parseLine(lines[0], d));
      const rows = lines.slice(1).map((line) => parseLine(line, d));

      if (!headers.length) throw new Error('تعذر قراءة الأعمدة من الملف');
      if (!rows.length) throw new Error('الملف لا يحتوي على صفوف بيانات');

      setImportSession({
        fileName: file.name,
        headers,
        rows,
        mapping: buildImportFieldAutoMapping(headers)
      });
    } catch (err) {
      await safeAlert(err.message || 'فشل قراءة الملف', null, { type: 'error', title: 'استيراد Excel' });
    }
  };

  const saveCategory = async () => {
    const name = nText(categoryForm.name);
    if (!name) {
      await safeAlert('اسم الفئة مطلوب', null, { type: 'warning', title: 'بيانات ناقصة' });
      return;
    }

    const res = await window.api.addCategory({
      name,
      description: nText(categoryForm.description) || null,
      color: nText(categoryForm.color) || '#0f766e',
      icon: nText(categoryForm.icon) || '🧵'
    });

    if (res?.error) {
      await safeAlert(res.error, null, { type: 'error', title: 'الفئات' });
      return;
    }

    setCategoryForm(DEFAULT_CATEGORY);
    await loadCategories();
    notify('تم إضافة الفئة', 'success');
  };

  const deleteCategory = async (id, name) => {
    const ok = await safeConfirm(`سيتم حذف الفئة "${name}". هل تريد المتابعة؟`, { title: 'حذف فئة' });
    if (!ok) return;

    const res = await window.api.deleteCategory(id);
    if (res?.error) {
      await safeAlert(res.error, null, { type: 'error', title: 'الفئات' });
      return;
    }

    await Promise.all([loadCategories(), refreshVisibleProducts()]);
    notify('تم حذف الفئة', 'success');
  };


  const itemData = useMemo(() => ({
    visibleProducts: displayedProducts,
    activeColumns,
    selectedIds,
    categoryMap,
    productMetaMap,
    toggleId,
    openEdit,
    duplicateProduct,
    printBarcodes,
    deleteProduct,
    showVariantsSummary,
    gridTemplateColumns
  }), [
    displayedProducts,
    activeColumns,
    selectedIds,
    categoryMap,
    productMetaMap,
    toggleId,
    openEdit,
    duplicateProduct,
    printBarcodes,
    deleteProduct,
    showVariantsSummary,
    gridTemplateColumns
  ]);

  return (
    <div className="products-page">
      <header className="products-header">
        <div>
          <h1>إدارة المنتجات</h1>
        </div>

        <div className="products-header-actions">
          <button type="button" className="products-btn products-btn-light" onClick={() => setShowCategoryModal(true)}>
            📑 إدارة الفئات
          </button>
          <button type="button" className="products-btn products-btn-light" onClick={exportCsv}>
            📥 تصدير Excel
          </button>
          <button type="button" className="products-btn products-btn-light" onClick={() => importRef.current?.click()} disabled={importing}>
            📤 {importing ? 'جاري الاستيراد...' : 'استيراد Excel'}
          </button>
          <button type="button" className="products-btn products-btn-dark" onClick={printSelected}>
            ⚙️ استوديو باركود المحدد
          </button>
          <button type="button" className="products-btn products-btn-primary" onClick={openCreate}>
            ➕ منتج جديد
          </button>
        </div>
      </header>

      <input ref={importRef} type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={importFile} />

      <section className="products-metrics">
        <article className="products-metric-card tone-main"><div className="icon-wrap">📦</div><div><h3>إجمالي الأصناف</h3><strong>{metrics.productsCount}</strong></div></article>
        <article className="products-metric-card tone-blue"><div className="icon-wrap">🧩</div><div><h3>متغيرات الصفحة</h3><strong>{metrics.variantsCount}</strong></div></article>
        <article className="products-metric-card tone-green"><div className="icon-wrap">🏪</div><div><h3>إجمالي المخزون</h3><strong>{metrics.stockTotal}</strong></div></article>
        <article className="products-metric-card tone-amber"><div className="icon-wrap">⚠️</div><div><h3>منخفض/نافد</h3><strong>{metrics.lowStockCount}</strong></div></article>
      </section>

      <section className="products-filters">
        <label className="products-search">
          <span className="products-search-emoji">🔍</span>
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="ابحث بالاسم أو الكود أو الباركود" />
          {searchTerm ? (
            <button
              type="button"
              className="products-search-clear"
              onClick={() => setSearchTerm('')}
              aria-label="مسح البحث"
            >
              ✕
            </button>
          ) : null}
        </label>

        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">كل الفئات</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.icon || '📦'} {c.name}</option>)}
        </select>

        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
          <option value="all">كل الحالات</option>
          <option value="available">متاح</option>
          <option value="low">منخفض</option>
          <option value="out">نافد</option>
        </select>

        <select value={sortPreset} onChange={(e) => setSortPreset(e.target.value)}>
          {SORT_PRESETS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        <button type="button" className="products-btn products-btn-light" onClick={handleRefresh} disabled={refreshing || searchLoading}>
          <span className={refreshing || searchLoading ? 'spin' : ''}>🔄</span> تحديث
        </button>
      </section>

      {/* <div className="products-search-meta">
        {isSearchTyping || isSearchBusy ? <span className="pill searching">جاري البحث...</span> : null}
        <span className="pill count">نتائج البحث: {filteredTotal}</span>
        {isSearchLimited ? <span className="pill limited">تم عرض أول {PRODUCT_SEARCH_LIMIT} نتيجة لتسريع العرض</span> : null}
      </div> */}

      <section className="products-table-card">
        <div className="products-table-tools">
          <label className="check-control"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} /> تحديد الكل</label>
          <span>الظاهر: {displayedProducts.length}</span>
          <span>المحدد: {selectedIds.size}</span>
          <div className="columns-control" ref={columnsMenuRef}>
            <button type="button" className="products-btn products-btn-light columns-trigger" onClick={() => setShowColumnMenu((prev) => !prev)}>
              <span>الأعمدة</span>
              <span>▼</span>
            </button>
            {showColumnMenu ? (
              <div className="columns-menu">
                <label className="column-option">
                  <input
                    type="checkbox"
                    checked={showSearchRow}
                    onChange={() => {
                      setShowSearchRow((prev) => !prev);
                      setShowColumnMenu(false);
                    }}
                  />
                  <span style={{ marginRight: '2px' }}>🔍</span>
                  <span>بحث متقدم</span>
                </label>
                <div className="columns-menu-divider" />
                {GRID_COLUMNS.filter((column) => !column.required).map((column) => (
                  <label key={column.key} className="column-option">
                    <input
                      type="checkbox"
                      checked={visibleColumnKeys.includes(column.key)}
                      onChange={() => toggleColumnVisibility(column.key)}
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="products-grid-viewport" ref={gridViewportRef}>
          <div className="products-grid-scroll">
            <div
              ref={gridHeaderRef}
              className="products-grid-header"
              style={{ display: 'grid', gridTemplateColumns }}
            >
              {activeColumns.map((column) => (
                <div key={column.key} className={`products-grid-head-cell head-${column.key}`}>
                  {column.label}
                </div>
              ))}
            </div>

            {showSearchRow && (
              <div
                className="products-grid-search-row"
                style={{ display: 'grid', gridTemplateColumns }}
              >
                {activeColumns.map((column) => (
                  <div key={`search-${column.key}`} className="products-grid-search-cell">
                    {column.key !== 'select' && column.key !== 'actions' ? (
                      <input
                        type="text"
                        placeholder={`بحث في ${column.label}...`}
                        className="column-search-input"
                        value={columnSearches[column.key] || ''}
                        onChange={(e) => handleColumnSearchChange(column.key, e.target.value)}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {tableLoading ? (
              <div className="products-loading">
                <span className="spin">🔄</span>
                <span>{isSearchBusy ? 'جاري البحث...' : 'جاري تحميل المنتجات...'}</span>
              </div>
            ) : displayedProducts.length === 0 ? (
              <div className="products-empty grid-empty">لا توجد منتجات مطابقة</div>
            ) : (
              <List
                className="products-grid-list"
                width="100%"
                height={gridHeight}
                itemCount={displayedProducts.length}
                itemSize={60}
                itemData={itemData}
                overscanCount={5}
                direction="rtl"
                itemKey={(index) => displayedProducts[index]?.id || index}
              >
                {ProductGridRow}
              </List>
            )}
          </div>
        </div>
      </section>

      {showProductModal ? (
        <Suspense fallback={null}>
          <ProductModal
            isOpen={showProductModal}
            onClose={closeProductModal}
            onSave={handleSaveProduct}
            initialData={editingProduct}
            categories={categories}
            isSaving={saving}
          />
        </Suspense>
      ) : null}

      {showBarcodeStudio ? (
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
                          type="number"
                          min="20"
                          max="120"
                          step="1"
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
                          type="number"
                          min="15"
                          max="90"
                          step="1"
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

                {barcodePreview.invalidRows.length && !(barcodePreviewIsMatrix && !matrixBarcodeLibrary) ? (
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
      ) : null}

      {importSession ? (
        <div className="products-modal-backdrop" onClick={closeImportSession}>
          <div className="products-modal products-import-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <div className="products-import-headline">
                <h2>مطابقة أعمدة الاستيراد</h2>
                <p>{importSession.fileName} | {importSession.rows.length} صف</p>
              </div>
              <button type="button" className="icon-btn" onClick={closeImportSession} disabled={importing}>
                ✕
              </button>
            </header>

            <section className="products-modal-body">
              <div className="import-mapping-meta">
                <span>عدد الأعمدة: <strong>{importSession.headers.length}</strong></span>
                <span>عدد الصفوف: <strong>{importSession.rows.length}</strong></span>
              </div>
              <p className="import-mapping-note">
                اختَر لكل حقل العمود المناسب من ملف Excel. الحقول غير المطلوبة يمكنك تركها على "تجاهل هذا الحقل".
              </p>

              <div className="import-mapping-grid">
                {IMPORT_FIELD_OPTIONS.map((field) => {
                  const selectedColumn = importSession.mapping?.[field.key] ?? '';
                  const sampleValue = selectedColumn ? importColumnSamples.get(selectedColumn) : '';

                  return (
                    <label key={field.key} className={`import-mapping-row ${field.required ? 'required' : ''}`}>
                      <span className="import-mapping-label">
                        {field.label}
                        {field.required ? ' *' : ''}
                      </span>
                      <select
                        value={selectedColumn}
                        onChange={(e) => updateImportFieldMapping(field.key, e.target.value)}
                        disabled={importing}
                      >
                        <option value="">{field.required ? 'اختر عمودًا...' : 'تجاهل هذا الحقل'}</option>
                        {importSession.headers.map((header) => (
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
              <button type="button" className="products-btn products-btn-light" onClick={applyAutoImportMapping} disabled={importing}>
                مطابقة تلقائية
              </button>
              <div className="products-modal-footer-actions">
                <button type="button" className="products-btn products-btn-light" onClick={closeImportSession} disabled={importing}>
                  إلغاء
                </button>
                <button type="button" className="products-btn products-btn-primary" onClick={startMappedImport} disabled={importing}>
                  {importing ? 'جاري الاستيراد...' : 'بدء الاستيراد'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {showCategoryModal ? (
        <div className="products-modal-backdrop" onClick={() => setShowCategoryModal(false)}>
          <div className="products-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>إدارة الفئات</h2>
              <button type="button" className="icon-btn" onClick={() => setShowCategoryModal(false)}>✕</button>
            </header>

            <section className="products-modal-body">
              <div className="form-grid two-cols">
                <label>اسم الفئة<input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} /></label>
                <label>الوصف<input type="text" value={categoryForm.description} onChange={(e) => setCategoryForm((p) => ({ ...p, description: e.target.value }))} /></label>
                <label>اللون<input type="color" value={categoryForm.color} onChange={(e) => setCategoryForm((p) => ({ ...p, color: e.target.value }))} /></label>
                <label>الأيقونة<input type="text" value={categoryForm.icon} onChange={(e) => setCategoryForm((p) => ({ ...p, icon: e.target.value }))} /></label>
              </div>

              <button type="button" className="products-btn products-btn-primary" onClick={saveCategory}>➕ إضافة فئة</button>

              <div className="category-list">
                {categories.length === 0 ? <div className="products-empty">لا توجد فئات</div> : categories.map((c) => (
                  <article className="category-row" key={c.id}>
                    <div><strong>{c.icon || '📦'} {c.name}</strong><small>{c.description || 'بدون وصف'}</small></div>
                    <button type="button" className="icon-btn danger" onClick={() => deleteCategory(c.id, c.name)}>🗑️</button>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {toast ? <div className={`products-toast ${toast.type || 'success'}`}>{toast.message}</div> : null}
    </div>
  );
}


import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  Boxes,
  ChevronDown,
  Copy,
  Download,
  Layers,
  Package,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Warehouse,
  X
} from 'lucide-react';
import { FixedSizeList as List } from 'react-window';
import { safeAlert } from '../utils/safeAlert';
import { safeConfirm } from '../utils/safeConfirm';
import { safePrint } from '../printing/safePrint';
import ProductModal from '../components/products/ProductModal';
import './Products.css';

const PRODUCT_FETCH_CHUNK = 10000;
const PRODUCT_SEARCH_LIMIT = 120;
const PRODUCT_SEARCH_DEBOUNCE_MS = 120;
const COLUMN_STORAGE_KEY = 'products.visibleColumns.v1';
const DEFAULT_UNIT = 'قطعة';

const GRID_COLUMNS = [
  { key: 'select', label: '', width: '52px', required: true },
  { key: 'code', label: 'الكود', width: '130px' },
  { key: 'name', label: 'اسم الصنف', width: 'minmax(280px, 2fr)' },
  { key: 'warehouse', label: 'المخزن', width: '100px' },
  { key: 'unit', label: 'الوحدة', width: '90px' },
  { key: 'quantity', label: 'الكمية', width: '100px' },
  { key: 'salePrice', label: 'سعر البيع', width: '130px' },
  { key: 'costPrice', label: 'سعر التكلفة', width: '130px' },
  { key: 'wholesalePrice', label: 'سعر الجملة', width: '130px' },
  { key: 'saleLimit', label: 'حد البيع', width: '100px' },
  { key: 'notes', label: 'الملاحظات', width: 'minmax(220px, 1.5fr)' },
  { key: 'category', label: 'الفئة', width: '140px' },
  { key: 'variants', label: 'المتغيرات', width: '100px' },
  { key: 'stockState', label: 'حالة المخزون', width: '160px' },
  { key: 'updatedAt', label: 'آخر تحديث', width: '120px' },
  { key: 'actions', label: 'إجراءات', width: '180px', required: true }
];

const DEFAULT_VISIBLE_COLUMN_KEYS = GRID_COLUMNS.filter((col) => !col.required).map((col) => col.key);

const getGridHeight = () => {
  if (typeof window === 'undefined') return 420;
  const reserved = window.innerWidth < 900 ? 500 : 420;
  return Math.max(260, Math.min(620, window.innerHeight - reserved));
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
const money = (v) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(Number(v || 0));
const csv = (v) => {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
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

const rowVal = (row, keys) => {
  for (const key of keys) {
    const val = row[nKey(key)];
    if (val !== undefined && nText(val) !== '') return nText(val);
  }
  return '';
};

const barcodeRows = (products) => {
  const rows = [];
  products.forEach((p) => {
    const sku = nText(p.sku) || `P${p.id}`;
    const vars = p.variants || [];
    if (!vars.length) {
      const mainUnit = mainUnitOf(p);
      rows.push({
        name: p.name || 'منتج',
        sku,
        size: 'موحد',
        color: '-',
        price: salePriceOf(p),
        code: nText(mainUnit?.barcode) || nText(p.barcode) || `${sku}-STD`
      });
      return;
    }
    vars.forEach((v, idx) => rows.push({
      name: p.name || 'منتج',
      sku,
      size: v.productSize || 'موحد',
      color: v.color || '-',
      price: Number(v.price || p.basePrice || 0),
      code: nText(v.barcode) || nText(p.barcode) || `${sku}-${v.productSize || 'S'}-${v.color || idx + 1}`
    }));
  });
  return rows;
};

const barcodeHtml = (rows) => {
  const cards = rows.map((r, i) => `
    <article class="card">
      <div class="head"><span>${i + 1}</span><h4>${String(r.name || '').replace(/[<>]/g, '')}</h4></div>
      <div class="meta">SKU: ${String(r.sku || '').replace(/[<>]/g, '')}</div>
      <div class="meta">${String(r.size || '').replace(/[<>]/g, '')} / ${String(r.color || '').replace(/[<>]/g, '')}</div>
      <div class="bar">*${String(r.code || '').replace(/[<>]/g, '')}*</div>
      <div class="code">${String(r.code || '').replace(/[<>]/g, '')}</div>
      <div class="price">${Number(r.price || 0).toFixed(2)} ج.م</div>
    </article>
  `).join('');

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><style>
  body{font-family:Tahoma,sans-serif;background:#f8fafc;padding:20px;margin:0}h1{margin:0 0 8px;color:#0f766e}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
  .card{background:#fff;border:1px dashed #94a3b8;border-radius:10px;padding:10px;break-inside:avoid}.head{display:flex;gap:8px;align-items:center}.head span{background:#0f766e;color:#fff;border-radius:999px;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:11px}
  .head h4{margin:0;font-size:13px}.meta{font-size:11px;color:#334155}.bar{text-align:center;font-size:40px;line-height:1;font-family:monospace;letter-spacing:2px;margin-top:6px}.code{text-align:center;font-size:12px;font-weight:700}.price{text-align:center;color:#065f46;font-size:12px;font-weight:700;margin-top:4px}
  </style></head><body><h1>ملصقات باركود المنتجات</h1><div class="grid">${cards}</div></body></html>`;
};

const importGroups = (rows) => {
  const groups = [];
  let currentGroup = null;

  for (const row of rows) {
    const name = nText(row.name || row['اسم المنتج']);
    const isMain = Boolean(name);

    if (isMain) {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = {
        product: {
          name,
          category: nText(row.category || row['الفئة']),
          brand: nText(row.brand || row['الماركة']),
          sku: nText(row.sku || row['SKU'] || row['كود']),
          barcode: nText(row.barcode || row['باركود المنتج']),
          description: nText(row.description || row['الوصف']),
          basePrice: nNum(row.salePrice || row['سعر البيع'], 0),
          cost: nNum(row.costPrice || row['التكلفة'], 0),
          image: nText(row.image || row['صورة'])
        },
        inventory: {
          warehouseQty: nInt(row.warehouseQty || row['مخزن'], 0),
          displayQty: nInt(row.displayQty || row['عرض'], 0),
          minStock: nInt(row.minStock || row['الحد الأدنى'], 5),
          maxStock: 100,
          notes: nText(row.notes || row['ملاحظات'])
        },
        variants: []
      };
    }

    if (currentGroup) {
      const size = nText(row.size || row['المقاس']);
      const color = nText(row.color || row['اللون']);
      const vBarcode = nText(row.variantBarcode || row['باركود المتغير']);
      const price = nNum(row.variantPrice || row['سعر المتغير'], 0);
      const cost = nNum(row.variantCost || row['تكلفة المتغير'], 0);
      const qty = nInt(row.variantQty || row['كمية المتغير'], 0);

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
    gridContentWidth,
    gridTemplateColumns
  } = data;

  const product = visibleProducts[index];
  if (!product) return null;

  const renderGridCell = (product, columnKey) => {
    const status = productMetaMap.get(product.id)?.status || stock(product);
    const category = categoryMap.get(product.categoryId);
    const productCode = nText(product.sku) || nText(product.barcode) || `#${product.id}`;

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
      case 'name':
        return (
          <div className="grid-name-cell">
            <div className="product-avatar">{product.image ? <img src={product.image} alt={product.name} /> : <Package size={16} />}</div>
            <div>
              <strong>{product.name}</strong>
              <div className="product-meta">
                {product.brand ? <span>{product.brand}</span> : null}
                {product.barcode ? <span>BAR: {product.barcode}</span> : null}
              </div>
            </div>
          </div>
        );
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
      case 'notes':
        return (
          <span className="grid-notes" title={nText(product?.inventory?.notes) || '-'}>
            {nText(product?.inventory?.notes) || '-'}
          </span>
        );
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
            <button type="button" className="icon-btn-solid edit" title="تعديل" onClick={() => openEdit(product)}><Pencil size={16} color="#fff" /></button>
            <button type="button" className="icon-btn-solid orange" title="نسخ" onClick={() => duplicateProduct(product)}><Copy size={16} color="#fff" /></button>
            <button type="button" className="icon-btn-solid blue" title="طباعة باركود" onClick={() => printBarcodes([product])}><Barcode size={16} color="#fff" /></button>
            <button type="button" className="icon-btn-solid danger" title="حذف" onClick={() => deleteProduct(product)}><Trash2 size={16} color="#fff" /></button>
          </div>
        );
      default:
        return '-';
    }
  };

  return (
    <div
      className={`products-grid-row ${index % 2 === 0 ? 'even' : 'odd'}`}
      style={{ ...style, display: 'grid', gridTemplateColumns, minWidth: gridContentWidth }}
    >
      {activeColumns.map((column) => (
        <div key={`${product.id}-${column.key}`} className={`products-grid-cell cell-${column.key}`}>
          {renderGridCell(product, column.key)}
        </div>
      ))}
    </div>
  );
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

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const importRef = useRef(null);
  const columnsMenuRef = useRef(null);
  const hasLoadedProductsRef = useRef(false);
  const latestProductsRequestRef = useRef(0);
  const latestSearchRequestRef = useRef(0);

  const activeSort = useMemo(() => SORT_PRESETS.find((s) => s.id === sortPreset) || SORT_PRESETS[0], [sortPreset]);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumnKeys));
  }, [visibleColumnKeys]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setGridHeight(getGridHeight());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
          sortDir: activeSort.sortDir
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
          sortDir: activeSort.sortDir
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
    visibleProducts.length > 0 && visibleProducts.every((p) => selectedIds.has(p.id))
  ), [selectedIds, visibleProducts]);

  const activeColumns = useMemo(() => {
    const optionalSet = new Set(visibleColumnKeys);
    return GRID_COLUMNS.filter((column) => column.required || optionalSet.has(column.key));
  }, [visibleColumnKeys]);

  const gridTemplateColumns = useMemo(
    () => activeColumns.map((column) => column.width).join(' '),
    [activeColumns]
  );

  const gridContentWidth = useMemo(
    () => '100%',
    []
  );

  const openCreate = () => {
    setModalMode('create');
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const openEdit = (product) => {
    setModalMode('edit');
    setEditingProduct(product);
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProduct(null);
  };

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

  const deleteProduct = async (product) => {
    const ok = await safeConfirm(`سيتم حذف المنتج "${product.name}". هل تريد المتابعة؟`, { title: 'حذف منتج' });
    if (!ok) return;

    const res = await window.api.deleteProduct(product.id);
    if (res?.error) {
      await safeAlert(res.error, null, { type: 'error', title: 'تعذر الحذف' });
      return;
    }

    await refreshVisibleProducts();
    notify('تم حذف المنتج', 'success');
  };

  const duplicateProduct = async (product) => {
    try {
      const copiedUnits = unitsOf(product).map((unit, index) => ({
        unitName: nText(unit?.unitName) || (index === 0 ? DEFAULT_UNIT : ''),
        conversionFactor: index === 0 ? 1 : Math.max(0.0001, nNum(unit?.conversionFactor, 1)),
        salePrice: Math.max(0, nNum(unit?.salePrice, salePriceOf(product))),
        wholesalePrice: Math.max(0, nNum(unit?.wholesalePrice, salePriceOf(product))),
        minSalePrice: Math.max(0, nNum(unit?.minSalePrice, salePriceOf(product))),
        purchasePrice: Math.max(0, nNum(unit?.purchasePrice, costPriceOf(product))),
        barcode: null
      }));

      const res = await window.api.addProduct({
        name: `${product.name} - نسخة`,
        description: product.description || null,
        categoryId: product.categoryId || null,
        brand: product.brand || null,
        sku: null,
        barcode: null,
        image: product.image || null,
        basePrice: salePriceOf(product),
        cost: costPriceOf(product),
        isActive: product.isActive ?? true,
        type: product.type || 'store',
        openingQty: nInt(product?.inventory?.warehouseQty, 0),
        units: copiedUnits.length ? copiedUnits : undefined
      });
      if (res?.error) throw new Error(res.error);

      const newId = res.id;
      for (const variant of (product.variants || [])) {
        const add = await window.api.addVariant({
          productId: newId,
          size: variant.productSize || 'M',
          color: variant.color || 'افتراضي',
          price: Number(variant.price || salePriceOf(product) || 0),
          cost: Number(variant.cost || costPriceOf(product) || 0),
          quantity: nInt(variant.quantity, 0),
          barcode: null
        });
        if (add?.error) throw new Error(add.error);
      }

      const inv = await window.api.updateInventory(newId, {
        minStock: nInt(product?.inventory?.minStock, 5),
        maxStock: nInt(product?.inventory?.maxStock, 100),
        warehouseQty: nInt(product?.inventory?.warehouseQty, 0),
        displayQty: nInt(product?.inventory?.displayQty, 0),
        totalQuantity: nInt(product?.inventory?.totalQuantity, 0),
        notes: nText(product?.inventory?.notes) || null,
        lastRestock: new Date().toISOString()
      });
      if (inv?.error) throw new Error(inv.error);

      await refreshVisibleProducts();
      notify('تم إنشاء نسخة من المنتج', 'success');
    } catch (err) {
      await safeAlert(err.message || 'فشل نسخ المنتج', null, { type: 'error', title: 'نسخ منتج' });
    }
  };

  const toggleId = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleProducts.forEach((p) => next.delete(p.id));
      else visibleProducts.forEach((p) => next.add(p.id));
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

  const showVariantsSummary = async (product) => {
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
  };

  const printBarcodes = async (targetProducts) => {
    const rows = barcodeRows(targetProducts);
    if (!rows.length) {
      await safeAlert('لا توجد عناصر صالحة للطباعة', null, { type: 'warning', title: 'طباعة باركود' });
      return;
    }
    const result = await safePrint(barcodeHtml(rows), { title: 'ملصقات باركود المنتجات' });
    if (result?.error) {
      await safeAlert(result.error, null, { type: 'error', title: 'طباعة باركود' });
      return;
    }
    notify(`تم فتح معاينة طباعة ${rows.length} باركود`, 'success');
  };

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

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const content = await file.text();
      const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error('الملف لا يحتوي على بيانات كافية');

      const d = delimiter(lines[0]);
      const headers = parseLine(lines[0], d).map((h) => nKey(h));
      const rows = lines.slice(1).map((line) => {
        const vals = parseLine(line, d);
        const row = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
        return row;
      });

      const groups = importGroups(rows);
      if (!groups.length) throw new Error('لم يتم العثور على صفوف صالحة (تأكد من عمود اسم المنتج)');

      const allRes = await window.api.getProducts({ page: 1, pageSize: 5000 });
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
    } catch (err) {
      await safeAlert(err.message || 'فشل الاستيراد', null, { type: 'error', title: 'استيراد Excel' });
    } finally {
      setImporting(false);
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
    gridContentWidth,
    gridTemplateColumns
  }), [
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
    gridContentWidth,
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
            <Layers size={16} />
            إدارة الفئات
          </button>
          <button type="button" className="products-btn products-btn-light" onClick={exportCsv}>
            <Download size={16} />
            تصدير Excel
          </button>
          <button type="button" className="products-btn products-btn-light" onClick={() => importRef.current?.click()} disabled={importing}>
            <Upload size={16} />
            {importing ? 'جاري الاستيراد...' : 'استيراد Excel'}
          </button>
          <button type="button" className="products-btn products-btn-dark" onClick={printSelected}>
            <Printer size={16} />
            طباعة باركود المحدد
          </button>
          <button type="button" className="products-btn products-btn-primary" onClick={openCreate}>
            <Plus size={16} />
            منتج جديد
          </button>
        </div>
      </header>

      <input ref={importRef} type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={importFile} />

      <section className="products-metrics">
        <article className="products-metric-card tone-main"><div className="icon-wrap"><Package size={20} /></div><div><h3>إجمالي الأصناف</h3><strong>{metrics.productsCount}</strong></div></article>
        <article className="products-metric-card tone-blue"><div className="icon-wrap"><Boxes size={20} /></div><div><h3>متغيرات الصفحة</h3><strong>{metrics.variantsCount}</strong></div></article>
        <article className="products-metric-card tone-green"><div className="icon-wrap"><Warehouse size={20} /></div><div><h3>إجمالي المخزون</h3><strong>{metrics.stockTotal}</strong></div></article>
        <article className="products-metric-card tone-amber"><div className="icon-wrap"><AlertTriangle size={20} /></div><div><h3>منخفض/نافد</h3><strong>{metrics.lowStockCount}</strong></div></article>
      </section>

      <section className="products-filters">
        <label className="products-search">
          <Search size={16} />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="ابحث بالاسم أو الكود أو الباركود" />
          {searchTerm ? (
            <button
              type="button"
              className="products-search-clear"
              onClick={() => setSearchTerm('')}
              aria-label="مسح البحث"
            >
              <X size={14} />
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
          <RefreshCw size={16} className={refreshing || searchLoading ? 'spin' : ''} />
          تحديث
        </button>
      </section>

      <div className="products-search-meta">
        {isSearchTyping || isSearchBusy ? <span className="pill searching">جاري البحث...</span> : null}
        <span className="pill count">نتائج البحث: {filteredTotal}</span>
        {isSearchLimited ? <span className="pill limited">تم عرض أول {PRODUCT_SEARCH_LIMIT} نتيجة لتسريع العرض</span> : null}
      </div>

      <section className="products-table-card">
        <div className="products-table-tools">
          <label className="check-control"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} /> تحديد الكل</label>
          <span>الظاهر: {visibleProducts.length}</span>
          <span>المحدد: {selectedIds.size}</span>
          <div className="columns-control" ref={columnsMenuRef}>
            <button type="button" className="products-btn products-btn-light columns-trigger" onClick={() => setShowColumnMenu((prev) => !prev)}>
              <span>الأعمدة</span>
              <ChevronDown size={15} />
            </button>
            {showColumnMenu ? (
              <div className="columns-menu">
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

        <div className="products-grid-viewport">
          <div className="products-grid-scroll">
            <div className="products-grid-header" style={{ display: 'grid', gridTemplateColumns, minWidth: gridContentWidth }}>
              {activeColumns.map((column) => (
                <div key={column.key} className={`products-grid-head-cell head-${column.key}`}>
                  {column.label}
                </div>
              ))}
            </div>

            {tableLoading ? (
              <div className="products-loading">
                <RefreshCw size={18} className="spin" />
                <span>{isSearchBusy ? 'جاري البحث...' : 'جاري تحميل المنتجات...'}</span>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="products-empty grid-empty">لا توجد منتجات مطابقة</div>
            ) : (
              <List
                className="products-grid-list"
                width="100%"
                height={gridHeight}
                itemCount={visibleProducts.length}
                itemSize={60}
                itemData={itemData}
                overscanCount={5}
                direction="rtl"
                itemKey={(index) => visibleProducts[index]?.id || index}
              >
                {ProductGridRow}
              </List>
            )}
          </div>
        </div>
      </section>

      <ProductModal
        isOpen={showProductModal}
        onClose={closeProductModal}
        onSave={handleSaveProduct}
        initialData={editingProduct}
        categories={categories}
        isSaving={saving}
      />

      {showCategoryModal ? (
        <div className="products-modal-backdrop" onClick={() => setShowCategoryModal(false)}>
          <div className="products-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>إدارة الفئات</h2>
              <button type="button" className="icon-btn" onClick={() => setShowCategoryModal(false)}><X size={16} /></button>
            </header>

            <section className="products-modal-body">
              <div className="form-grid two-cols">
                <label>اسم الفئة<input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} /></label>
                <label>الوصف<input type="text" value={categoryForm.description} onChange={(e) => setCategoryForm((p) => ({ ...p, description: e.target.value }))} /></label>
                <label>اللون<input type="color" value={categoryForm.color} onChange={(e) => setCategoryForm((p) => ({ ...p, color: e.target.value }))} /></label>
                <label>الأيقونة<input type="text" value={categoryForm.icon} onChange={(e) => setCategoryForm((p) => ({ ...p, icon: e.target.value }))} /></label>
              </div>

              <button type="button" className="products-btn products-btn-primary" onClick={saveCategory}><Plus size={14} />إضافة فئة</button>

              <div className="category-list">
                {categories.length === 0 ? <div className="products-empty">لا توجد فئات</div> : categories.map((c) => (
                  <article className="category-row" key={c.id}>
                    <div><strong>{c.icon || '📦'} {c.name}</strong><small>{c.description || 'بدون وصف'}</small></div>
                    <button type="button" className="icon-btn danger" onClick={() => deleteCategory(c.id, c.name)}><Trash2 size={14} /></button>
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

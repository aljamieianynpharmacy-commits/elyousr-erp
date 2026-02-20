import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import JsBarcode from 'jsbarcode';
import { FixedSizeList as List } from 'react-window';
import { safeAlert } from '../utils/safeAlert';
import { safeConfirm } from '../utils/safeConfirm';
import { safePrint } from '../printing/safePrint';
import './Products.css';

// Extracted components
import ProductsMetrics from '../components/products/ProductsMetrics';
import ProductsFilters from '../components/products/ProductsFilters';
import ProductsTableTools from '../components/products/ProductsTableTools';
import CategoryModal from '../components/products/CategoryModal';
import ImportModal from '../components/products/ImportModal';
import BarcodeStudioModal from '../components/products/BarcodeStudioModal';
import {
  getGridHeight, nText, nKey, nInt, nNum, money, csv,
  stock, unitsOf, mainUnitOf, salePriceOf, costPriceOf, wholesale,
  DEFAULT_UNIT, DEFAULT_CATEGORY, GRID_COLUMNS, SORT_PRESETS,
  DEFAULT_VISIBLE_COLUMN_KEYS
} from '../utils/productUtils';
import {
  BARCODE_FORMAT_OPTIONS, BARCODE_CODE_SOURCE_OPTIONS, BARCODE_LABEL_PRESETS,
  BARCODE_STUDIO_TABS, DEFAULT_BARCODE_STUDIO,
  sanitizeBarcodeStudioSettings, barcodeValueFromSource, normalizeBarcodeByFormat,
  buildBarcodeLabels, barcodeStudioHtml, barcodeRows,
  isMatrixBarcodeFormat,
  BARCODE_STUDIO_STORAGE_KEY,
  BARCODE_TEMPLATE_STORAGE_KEY,
  sanitizeBarcodeTemplate,
  parseBarcodeTemplates
} from '../utils/barcodeUtils';
import {
  IMPORT_FIELD_OPTIONS, parseLine, delimiter, toImportHeaders,
  buildImportFieldAutoMapping, mapRowsWithImportMapping, importGroups
} from '../utils/importUtils';

const loadProductModal = () => import('../components/products/ProductModal');
const ProductModal = lazy(loadProductModal);

const PRODUCT_FETCH_CHUNK = 10000;
const PRODUCT_SEARCH_LIMIT = 120;
const PRODUCT_SEARCH_DEBOUNCE_MS = 200;
const COLUMN_STORAGE_KEY = 'products.visibleColumns.v1';












const useDebouncedValue = (value, delayMs) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
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
          stockFilter: stockFilter || 'all',
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
  }, [activeSort.sortCol, activeSort.sortDir, categoryFilter, stockFilter]);

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

      do {
        const res = await window.api.getProducts({
          page,
          pageSize: PRODUCT_SEARCH_LIMIT,
          searchTerm: term,
          categoryId: categoryFilter || null,
          stockFilter: stockFilter || 'all',
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

        if (allRows.length >= PRODUCT_SEARCH_LIMIT) break;
      } while (page <= totalPages);

      setSearchResults(allRows.slice(0, PRODUCT_SEARCH_LIMIT));
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
    if (nText(debouncedSearchTerm)) return;
    loadProducts();
  }, [debouncedSearchTerm, loadProducts]);

  useEffect(() => {
    const term = nText(debouncedSearchTerm);
    if (!term) {
      latestSearchRequestRef.current += 1;
      setSearchResults([]);
      setSearchResultsTotal(0);
      setSearchLoading(false);
      return;
    }
    loadSearchProducts(term);
  }, [debouncedSearchTerm, loadSearchProducts]);

  const refreshVisibleProducts = useCallback(async () => {
    const term = nText(debouncedSearchTerm);
    if (term) {
      await Promise.all([loadProducts(true), loadSearchProducts(term, true)]);
      return;
    }
    await loadProducts(true);
  }, [debouncedSearchTerm, loadProducts, loadSearchProducts]);

  const handleRefresh = useCallback(() => {
    const term = nText(debouncedSearchTerm);
    if (term) {
      loadSearchProducts(term);
      return;
    }
    loadProducts(true);
  }, [debouncedSearchTerm, loadProducts, loadSearchProducts]);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  const isSearchMode = nText(debouncedSearchTerm).length > 0;
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

  const saveCategory = async (categoryData) => {
    const name = nText(categoryData.name);
    if (!name) {
      await safeAlert('اسم الفئة مطلوب', null, { type: 'warning', title: 'بيانات ناقصة' });
      return;
    }

    const res = await window.api.addCategory({
      name,
      description: nText(categoryData.description) || null,
      color: nText(categoryData.color) || '#0f766e',
      icon: nText(categoryData.icon) || '🧵'
    });

    if (res?.error) {
      await safeAlert(res.error, null, { type: 'error', title: 'الفئات' });
      return;
    }

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

      <ProductsMetrics metrics={metrics} />

      <ProductsFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        categories={categories}
        stockFilter={stockFilter}
        setStockFilter={setStockFilter}
        sortPreset={sortPreset}
        setSortPreset={setSortPreset}
        handleRefresh={handleRefresh}
        refreshing={refreshing}
        searchLoading={searchLoading}
      />

      {/* <div className="products-search-meta">
        {isSearchTyping || isSearchBusy ? <span className="pill searching">جاري البحث...</span> : null}
        <span className="pill count">نتائج البحث: {filteredTotal}</span>
        {isSearchLimited ? <span className="pill limited">تم عرض أول {PRODUCT_SEARCH_LIMIT} نتيجة لتسريع العرض</span> : null}
      </div> */}

      <section className="products-table-card">
        <ProductsTableTools
          allVisibleSelected={allVisibleSelected}
          toggleVisible={toggleVisible}
          displayedCount={displayedProducts.length}
          selectedCount={selectedIds.size}
          visibleColumnKeys={visibleColumnKeys}
          toggleColumnVisibility={toggleColumnVisibility}
          showSearchRow={showSearchRow}
          setShowSearchRow={setShowSearchRow}
        />




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
      </section >

      {
        showProductModal ? (
          <Suspense fallback={null} >
            <ProductModal
              isOpen={showProductModal}
              onClose={closeProductModal}
              onSave={handleSaveProduct}
              initialData={editingProduct}
              categories={categories}
              isSaving={saving}
            />
          </Suspense>
        ) : null
      }

      {showBarcodeStudio ? (
        <BarcodeStudioModal
          barcodeStudioProducts={barcodeStudioProducts}
          barcodeStudioRows={barcodeStudioRows}
          barcodeStudioSafeSettings={barcodeStudioSafeSettings}
          barcodeStudioTab={barcodeStudioTab}
          setBarcodeStudioTab={setBarcodeStudioTab}
          barcodePrinting={barcodePrinting}
          barcodePreview={barcodePreview}
          barcodePreviewIsMatrix={barcodePreviewIsMatrix}
          matrixBarcodeEngineLoading={matrixBarcodeEngineLoading}
          matrixBarcodeEngineError={matrixBarcodeEngineError}
          barcodeTemplates={barcodeTemplates}
          activeBarcodeTemplateId={activeBarcodeTemplateId}
          activeBarcodeTemplate={activeBarcodeTemplate}
          barcodeTemplateName={barcodeTemplateName}
          setBarcodeTemplateName={setBarcodeTemplateName}
          barcodeTemplatePrinter={barcodeTemplatePrinter}
          setBarcodeTemplatePrinter={setBarcodeTemplatePrinter}
          setBarcodeSetting={setBarcodeSetting}
          setBarcodeNumberSetting={setBarcodeNumberSetting}
          applyBarcodePreset={applyBarcodePreset}
          applyBarcodeTemplate={applyBarcodeTemplate}
          saveNewBarcodeTemplate={saveNewBarcodeTemplate}
          updateBarcodeTemplate={updateBarcodeTemplate}
          deleteBarcodeTemplate={deleteBarcodeTemplate}
          resetBarcodeStudioSettings={resetBarcodeStudioSettings}
          closeBarcodeStudio={closeBarcodeStudio}
          executeBarcodeStudioPrint={executeBarcodeStudioPrint}
          executeBarcodeStudioPdfExport={executeBarcodeStudioPdfExport}
        />
      ) : null}

      <ImportModal
        session={importSession}
        importing={importing}
        onClose={closeImportSession}
        onUpdateFieldMapping={updateImportFieldMapping}
        onApplyAutoMapping={applyAutoImportMapping}
        onStartImport={startMappedImport}
      />

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        categories={categories}
        onSave={saveCategory}
        onDelete={deleteCategory}
      />

      {toast ? <div className={`products-toast ${toast.type || 'success'}`}>{toast.message}</div> : null}
    </div>
  );
}


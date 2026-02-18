import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  Boxes,
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
import { safeAlert } from '../utils/safeAlert';
import { safeConfirm } from '../utils/safeConfirm';
import { safePrint } from '../printing/safePrint';
import './Products.css';

const PAGE_SIZE = 24;

const SORT_PRESETS = [
  { id: 'latest', label: 'الأحدث', sortCol: 'createdAt', sortDir: 'desc' },
  { id: 'oldest', label: 'الأقدم', sortCol: 'createdAt', sortDir: 'asc' },
  { id: 'name_asc', label: 'الاسم (أ - ي)', sortCol: 'name', sortDir: 'asc' },
  { id: 'name_desc', label: 'الاسم (ي - أ)', sortCol: 'name', sortDir: 'desc' },
  { id: 'price_desc', label: 'السعر الأعلى', sortCol: 'basePrice', sortDir: 'desc' },
  { id: 'price_asc', label: 'السعر الأقل', sortCol: 'basePrice', sortDir: 'asc' }
];

const DEFAULT_CATEGORY = { name: '', description: '', color: '#0f766e', icon: '🧵' };

const defaultVariant = () => ({
  tempId: `v-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  id: null,
  size: 'M',
  color: 'أسود',
  price: 0,
  cost: 0,
  quantity: 0,
  barcode: ''
});

const defaultForm = () => ({
  name: '',
  description: '',
  categoryId: '',
  brand: '',
  sku: '',
  barcode: '',
  image: '',
  basePrice: 0,
  cost: 0,
  inventory: { minStock: 5, maxStock: 100, warehouseQty: 0, displayQty: 0, notes: '' },
  variants: [defaultVariant()],
  genSizes: 'S, M, L, XL',
  genColors: 'أسود, أبيض'
});

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
      rows.push({
        name: p.name || 'منتج',
        sku,
        size: 'موحد',
        color: '-',
        price: Number(p.basePrice || 0),
        code: nText(p.barcode) || `${sku}-STD`
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
  const map = new Map();
  rows.forEach((row) => {
    const name = rowVal(row, ['name', 'اسم المنتج', 'product']);
    if (!name) return;
    const brand = rowVal(row, ['brand', 'الماركة']);
    const sku = rowVal(row, ['sku', 'كود الصنف']);
    const category = rowVal(row, ['category', 'الفئة', 'التصنيف']);
    const pBarcode = rowVal(row, ['barcode', 'باركود المنتج', 'productbarcode']);
    const key = sku ? sku.toLowerCase() : `${name.toLowerCase()}|${brand.toLowerCase()}`;

    if (!map.has(key)) {
      map.set(key, {
        product: {
          name,
          description: rowVal(row, ['description', 'الوصف']),
          brand,
          sku,
          category,
          barcode: pBarcode,
          image: rowVal(row, ['image', 'الصورة']),
          basePrice: nNum(rowVal(row, ['baseprice', 'price', 'سعر البيع']), 0),
          cost: nNum(rowVal(row, ['cost', 'التكلفة']), 0)
        },
        inventory: {
          minStock: nInt(rowVal(row, ['minstock', 'الحد الأدنى']), 5),
          maxStock: nInt(rowVal(row, ['maxstock', 'الحد الأعلى']), 100),
          warehouseQty: nInt(rowVal(row, ['warehouseqty', 'مخزن']), 0),
          displayQty: nInt(rowVal(row, ['displayqty', 'عرض']), 0),
          notes: rowVal(row, ['notes', 'ملاحظات'])
        },
        variants: []
      });
    }

    const size = rowVal(row, ['size', 'المقاس']);
    const color = rowVal(row, ['color', 'اللون']);
    const vBarcode = rowVal(row, ['variantbarcode', 'barcodevariant', 'باركود المتغير']);
    if (size || color || vBarcode) {
      const g = map.get(key);
      g.variants.push({
        size: size || 'موحد',
        color: color || 'افتراضي',
        price: nNum(rowVal(row, ['variantprice', 'سعر المتغير', 'price']), g.product.basePrice),
        cost: nNum(rowVal(row, ['variantcost', 'تكلفة المتغير', 'cost']), g.product.cost),
        quantity: nInt(rowVal(row, ['quantity', 'qty', 'الكمية']), 0),
        barcode: vBarcode
      });
    }
  });
  return [...map.values()];
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortPreset, setSortPreset] = useState('latest');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);

  const [showProductModal, setShowProductModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletedVariantIds, setDeletedVariantIds] = useState([]);
  const [form, setForm] = useState(defaultForm());

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState(DEFAULT_CATEGORY);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const importRef = useRef(null);

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
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const loadCategories = useCallback(async () => {
    const res = await window.api.getCategories();
    if (!res?.error) setCategories(Array.isArray(res) ? res : []);
  }, []);

  const loadProducts = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await window.api.getProducts({
        page: currentPage,
        pageSize: PAGE_SIZE,
        searchTerm: debouncedSearch,
        categoryId: categoryFilter || null,
        sortCol: activeSort.sortCol,
        sortDir: activeSort.sortDir
      });

      if (res?.error) throw new Error(res.error);
      const list = Array.isArray(res?.data) ? res.data : [];
      setProducts(list);
      setTotalItems(nInt(res?.total, 0));
      setTotalPages(nInt(res?.totalPages, 1));

      setSelectedIds((prev) => {
        const valid = new Set(list.map((p) => p.id));
        const next = new Set();
        prev.forEach((id) => {
          if (valid.has(id)) next.add(id);
        });
        return next;
      });
    } catch (err) {
      await safeAlert(err.message || 'فشل تحميل البيانات', null, { type: 'error', title: 'المنتجات' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeSort.sortCol, activeSort.sortDir, categoryFilter, currentPage, debouncedSearch]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, sortPreset]);

  const visibleProducts = useMemo(() => {
    if (stockFilter === 'all') return products;
    return products.filter((p) => {
      const s = stock(p);
      if (stockFilter === 'available') return s.key === 'ok';
      if (stockFilter === 'low') return s.key === 'low';
      if (stockFilter === 'out') return s.key === 'out';
      return true;
    });
  }, [products, stockFilter]);

  const metrics = useMemo(() => ({
    productsCount: totalItems,
    variantsCount: products.reduce((s, p) => s + (p.variants?.length || 0), 0),
    stockTotal: products.reduce((s, p) => s + stock(p).total, 0),
    lowStockCount: products.filter((p) => stock(p).key !== 'ok').length
  }), [products, totalItems]);

  const allVisibleSelected = useMemo(() => (
    visibleProducts.length > 0 && visibleProducts.every((p) => selectedIds.has(p.id))
  ), [selectedIds, visibleProducts]);

  const openCreate = () => {
    setModalMode('create');
    setEditingProduct(null);
    setDeletedVariantIds([]);
    setForm(defaultForm());
    setShowProductModal(true);
  };

  const openEdit = (product) => {
    const vars = (product.variants || []).length
      ? product.variants.map((v) => ({
          tempId: `v-${v.id}`,
          id: v.id,
          size: v.productSize || '',
          color: v.color || '',
          price: Number(v.price || 0),
          cost: Number(v.cost || 0),
          quantity: nInt(v.quantity, 0),
          barcode: v.barcode || ''
        }))
      : [defaultVariant()];

    setModalMode('edit');
    setEditingProduct(product);
    setDeletedVariantIds([]);
    setForm({
      name: product.name || '',
      description: product.description || '',
      categoryId: product.categoryId ? String(product.categoryId) : '',
      brand: product.brand || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      image: product.image || '',
      basePrice: Number(product.basePrice || 0),
      cost: Number(product.cost || 0),
      inventory: {
        minStock: nInt(product.inventory?.minStock, 5),
        maxStock: nInt(product.inventory?.maxStock, 100),
        warehouseQty: nInt(product.inventory?.warehouseQty, 0),
        displayQty: nInt(product.inventory?.displayQty, 0),
        notes: product.inventory?.notes || ''
      },
      variants: vars,
      genSizes: 'S, M, L, XL',
      genColors: 'أسود, أبيض'
    });
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setDeletedVariantIds([]);
    setForm(defaultForm());
  };

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setInv = (k, v) => setForm((p) => ({ ...p, inventory: { ...p.inventory, [k]: v } }));

  const addVariant = () => setForm((p) => ({ ...p, variants: [...p.variants, defaultVariant()] }));

  const removeVariant = (variant) => {
    setForm((p) => ({ ...p, variants: p.variants.filter((v) => v.tempId !== variant.tempId) }));
    if (variant.id) setDeletedVariantIds((p) => [...p, variant.id]);
  };

  const setVariant = (tempId, k, v) => {
    setForm((p) => ({
      ...p,
      variants: p.variants.map((item) => (item.tempId === tempId ? { ...item, [k]: v } : item))
    }));
  };

  const syncFromVariants = () => {
    const qty = form.variants.reduce((s, v) => s + nInt(v.quantity, 0), 0);
    setForm((p) => ({ ...p, inventory: { ...p.inventory, warehouseQty: qty, displayQty: 0 } }));
    notify('تمت مزامنة المخزون مع المتغيرات', 'info');
  };

  const generateVariants = () => {
    const sizes = form.genSizes.split(',').map((x) => x.trim()).filter(Boolean);
    const colors = form.genColors.split(',').map((x) => x.trim()).filter(Boolean);
    if (!sizes.length || !colors.length) {
      notify('اكتب المقاسات والألوان مفصولة بفاصلة', 'warning');
      return;
    }

    const exists = new Set(form.variants.map((v) => `${v.size.toLowerCase()}|${v.color.toLowerCase()}`));
    const out = [];
    sizes.forEach((size) => {
      colors.forEach((color) => {
        const key = `${size.toLowerCase()}|${color.toLowerCase()}`;
        if (!exists.has(key)) {
          out.push({ ...defaultVariant(), size, color, price: nNum(form.basePrice), cost: nNum(form.cost) });
        }
      });
    });

    if (!out.length) {
      notify('كل التركيبات موجودة', 'info');
      return;
    }

    setForm((p) => ({ ...p, variants: [...p.variants, ...out] }));
    notify(`تم توليد ${out.length} متغير`, 'success');
  };

  const saveProduct = async () => {
    const name = nText(form.name);
    if (!name) {
      await safeAlert('اسم المنتج مطلوب', null, { type: 'warning', title: 'بيانات ناقصة' });
      return;
    }

    const variants = form.variants
      .map((v) => ({ ...v, size: nText(v.size), color: nText(v.color) }))
      .filter((v) => v.size && v.color);

    if (!variants.length) {
      const ok = await safeConfirm('لا توجد متغيرات صالحة. هل تريد الحفظ بدون متغيرات؟');
      if (!ok) return;
    }

    setSaving(true);

    try {
      const payload = {
        name,
        description: nText(form.description) || null,
        categoryId: form.categoryId ? nInt(form.categoryId, null) : null,
        brand: nText(form.brand) || null,
        sku: nText(form.sku) || null,
        barcode: nText(form.barcode) || null,
        image: nText(form.image) || null,
        basePrice: nNum(form.basePrice, 0),
        cost: nNum(form.cost, 0)
      };

      const productRes = modalMode === 'create'
        ? await window.api.addProduct(payload)
        : await window.api.updateProduct(editingProduct.id, payload);
      if (productRes?.error) throw new Error(productRes.error);

      const productId = nInt(productRes?.id || editingProduct?.id, 0);

      for (const variantId of deletedVariantIds) {
        const del = await window.api.deleteVariant(variantId);
        if (del?.error) console.warn('delete variant warning', del.error);
      }

      for (const variant of variants) {
        const data = {
          productId,
          size: variant.size,
          color: variant.color,
          price: nNum(variant.price, payload.basePrice),
          cost: nNum(variant.cost, payload.cost),
          quantity: nInt(variant.quantity, 0),
          barcode: nText(variant.barcode) || null
        };

        const res = variant.id ? await window.api.updateVariant(variant.id, data) : await window.api.addVariant(data);
        if (res?.error) throw new Error(`خطأ حفظ المتغير ${variant.size}/${variant.color}: ${res.error}`);
      }

      const varTotal = variants.reduce((s, v) => s + nInt(v.quantity, 0), 0);
      const w = nInt(form.inventory.warehouseQty, 0);
      const d = nInt(form.inventory.displayQty, 0);
      const invRes = await window.api.updateInventory(productId, {
        minStock: nInt(form.inventory.minStock, 5),
        maxStock: nInt(form.inventory.maxStock, 100),
        warehouseQty: w,
        displayQty: d,
        totalQuantity: Math.max(w + d, varTotal),
        notes: nText(form.inventory.notes) || null,
        lastRestock: new Date().toISOString()
      });
      if (invRes?.error) throw new Error(invRes.error);

      closeProductModal();
      await Promise.all([loadProducts(true), loadCategories()]);
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

    await loadProducts(true);
    notify('تم حذف المنتج', 'success');
  };

  const duplicateProduct = async (product) => {
    try {
      const res = await window.api.addProduct({
        name: `${product.name} - نسخة`,
        description: product.description || null,
        categoryId: product.categoryId || null,
        brand: product.brand || null,
        sku: null,
        barcode: null,
        image: product.image || null,
        basePrice: Number(product.basePrice || 0),
        cost: Number(product.cost || 0)
      });
      if (res?.error) throw new Error(res.error);

      const newId = res.id;
      for (const variant of (product.variants || [])) {
        const add = await window.api.addVariant({
          productId: newId,
          size: variant.productSize || 'M',
          color: variant.color || 'افتراضي',
          price: Number(variant.price || product.basePrice || 0),
          cost: Number(variant.cost || product.cost || 0),
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

      await loadProducts(true);
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
          '', '', Number(p.basePrice || 0).toFixed(2), Number(p.cost || 0).toFixed(2), '', '',
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

      await Promise.all([loadCategories(), loadProducts(true)]);
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

    await Promise.all([loadCategories(), loadProducts(true)]);
    notify('تم حذف الفئة', 'success');
  };

  if (loading) {
    return (
      <div className="products-loading">
        <RefreshCw className="spin" size={20} />
        <span>جاري تحميل بيانات المنتجات...</span>
      </div>
    );
  }

  return (
    <div className="products-page">
      <header className="products-header">
        <div>
          <h1>إدارة المنتجات المتقدمة</h1>
          <p>ملابس - متغيرات لون/مقاس - مخزون متعدد (مخزن + عرض) - باركود - استيراد/تصدير</p>
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
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="ابحث بالاسم / SKU / الباركود" />
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

        <button type="button" className="products-btn products-btn-light" onClick={() => loadProducts(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          تحديث
        </button>
      </section>

      <section className="products-table-card">
        <div className="products-table-tools">
          <label className="check-control"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} /> تحديد الكل في الصفحة</label>
          <span>العناصر الظاهرة: {visibleProducts.length}</span>
          <span>المحدد للطباعة: {selectedIds.size}</span>
        </div>

        <div className="products-table-wrap">
          <table className="products-table">
            <thead>
              <tr>
                <th />
                <th>#</th>
                <th>المنتج</th>
                <th>الفئة</th>
                <th>التسعير</th>
                <th>المتغيرات</th>
                <th>المخزون</th>
                <th>آخر تحديث</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.length === 0 ? (
                <tr><td colSpan={9} className="products-empty">لا توجد منتجات مطابقة</td></tr>
              ) : visibleProducts.map((p) => {
                const s = stock(p);
                const c = categories.find((x) => x.id === p.categoryId);
                const expanded = expandedId === p.id;

                return (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleId(p.id)} /></td>
                      <td>{p.id}</td>
                      <td>
                        <div className="product-main-cell">
                          <div className="product-avatar">{p.image ? <img src={p.image} alt={p.name} /> : <Package size={16} />}</div>
                          <div>
                            <strong>{p.name}</strong>
                            <div className="product-meta">{p.brand ? <span>{p.brand}</span> : null}{p.sku ? <span>SKU: {p.sku}</span> : null}{p.barcode ? <span>BAR: {p.barcode}</span> : null}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="category-chip" style={{ backgroundColor: `${c?.color || '#64748b'}1f`, color: c?.color || '#334155', borderColor: `${c?.color || '#64748b'}66` }}>
                          {c?.icon || '📦'} {c?.name || 'غير مصنف'}
                        </span>
                      </td>
                      <td><div className="pricing-block"><strong>{money(p.basePrice)}</strong><small>تكلفة: {money(p.cost || 0)}</small></div></td>
                      <td><button type="button" className="link-btn" onClick={() => setExpandedId((prev) => (prev === p.id ? null : p.id))}>{(p.variants || []).length} متغير</button></td>
                      <td><div className="stock-cell"><span className={`stock-chip ${s.tone}`}>{s.label}</span><small>{s.total} قطعة | حد {s.min}</small><small>مخزن {nInt(p.inventory?.warehouseQty, 0)} | عرض {nInt(p.inventory?.displayQty, 0)}</small></div></td>
                      <td>{new Date(p.updatedAt || p.createdAt || Date.now()).toLocaleDateString('ar-EG')}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="icon-btn" title="تعديل" onClick={() => openEdit(p)}><Pencil size={15} /></button>
                          <button type="button" className="icon-btn" title="نسخ" onClick={() => duplicateProduct(p)}><Copy size={15} /></button>
                          <button type="button" className="icon-btn" title="طباعة باركود" onClick={() => printBarcodes([p])}><Barcode size={15} /></button>
                          <button type="button" className="icon-btn danger" title="حذف" onClick={() => deleteProduct(p)}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>

                    {expanded ? (
                      <tr className="variants-row">
                        <td colSpan={9}>
                          {!(p.variants || []).length ? <div className="variants-empty">لا توجد متغيرات</div> : (
                            <div className="variants-grid">
                              {p.variants.map((v) => (
                                <article className="variant-card" key={v.id}>
                                  <h5>{v.productSize} / {v.color}</h5>
                                  <p>سعر: {money(v.price)}</p>
                                  <p>تكلفة: {money(v.cost)}</p>
                                  <p>كمية: {nInt(v.quantity, 0)}</p>
                                  <p>باركود: {v.barcode || '-'}</p>
                                </article>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {totalPages > 1 ? (
        <div className="products-pagination">
          <button type="button" className="products-page-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}>السابق</button>
          <span className="products-page-indicator">صفحة {currentPage} من {Math.max(totalPages, 1)}</span>
          <button type="button" className="products-page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}>التالي</button>
        </div>
      ) : null}

      {showProductModal ? (
        <div className="products-modal-backdrop" onClick={closeProductModal}>
          <div className="products-modal product-modal-large" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>{modalMode === 'create' ? 'إضافة منتج جديد' : `تعديل: ${editingProduct?.name || ''}`}</h2>
              <button type="button" className="icon-btn" onClick={closeProductModal}><X size={16} /></button>
            </header>

            <section className="products-modal-body">
              <div className="form-grid two-cols">
                <label>اسم المنتج *<input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} /></label>
                <label>الفئة<select value={form.categoryId} onChange={(e) => setField('categoryId', e.target.value)}><option value="">بدون فئة</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label>الماركة<input type="text" value={form.brand} onChange={(e) => setField('brand', e.target.value)} /></label>
                <label>SKU<input type="text" value={form.sku} onChange={(e) => setField('sku', e.target.value)} /></label>
                <label>باركود المنتج<input type="text" value={form.barcode} onChange={(e) => setField('barcode', e.target.value)} /></label>
                <label>رابط الصورة<input type="text" value={form.image} onChange={(e) => setField('image', e.target.value)} /></label>
                <label>سعر البيع الأساسي<input type="number" step="0.01" value={form.basePrice} onChange={(e) => setField('basePrice', nNum(e.target.value, 0))} /></label>
                <label>التكلفة الأساسية<input type="number" step="0.01" value={form.cost} onChange={(e) => setField('cost', nNum(e.target.value, 0))} /></label>
              </div>

              <label>الوصف<textarea rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)} /></label>

              <div className="modal-card">
                <div className="card-head">
                  <h3>المخزون والمستودعات</h3>
                  <button type="button" className="products-btn products-btn-light" onClick={syncFromVariants}>مزامنة من المتغيرات</button>
                </div>

                <div className="form-grid five-cols">
                  <label>مخزن<input type="number" value={form.inventory.warehouseQty} onChange={(e) => setInv('warehouseQty', nInt(e.target.value, 0))} /></label>
                  <label>عرض<input type="number" value={form.inventory.displayQty} onChange={(e) => setInv('displayQty', nInt(e.target.value, 0))} /></label>
                  <label>الحد الأدنى<input type="number" value={form.inventory.minStock} onChange={(e) => setInv('minStock', nInt(e.target.value, 5))} /></label>
                  <label>الحد الأعلى<input type="number" value={form.inventory.maxStock} onChange={(e) => setInv('maxStock', nInt(e.target.value, 100))} /></label>
                  <label>إجمالي يدوي<input type="number" disabled value={nInt(form.inventory.warehouseQty, 0) + nInt(form.inventory.displayQty, 0)} /></label>
                </div>

                <label>ملاحظات المخزون<input type="text" value={form.inventory.notes} onChange={(e) => setInv('notes', e.target.value)} /></label>
              </div>

              <div className="modal-card">
                <div className="card-head">
                  <h3>متغيرات الملابس (مقاس / لون)</h3>
                  <button type="button" className="products-btn products-btn-primary" onClick={addVariant}><Plus size={14} />إضافة متغير</button>
                </div>

                <div className="variant-generator">
                  <label>قائمة المقاسات (فاصلة)<input type="text" value={form.genSizes} onChange={(e) => setField('genSizes', e.target.value)} /></label>
                  <label>قائمة الألوان (فاصلة)<input type="text" value={form.genColors} onChange={(e) => setField('genColors', e.target.value)} /></label>
                  <button type="button" className="products-btn products-btn-light" onClick={generateVariants}>توليد تركيبات</button>
                </div>

                <div className="variant-editor-table">
                  <table>
                    <thead><tr><th>المقاس</th><th>اللون</th><th>سعر البيع</th><th>التكلفة</th><th>الكمية</th><th>باركود</th><th /></tr></thead>
                    <tbody>
                      {form.variants.map((v) => (
                        <tr key={v.tempId}>
                          <td><input type="text" value={v.size} onChange={(e) => setVariant(v.tempId, 'size', e.target.value)} /></td>
                          <td><input type="text" value={v.color} onChange={(e) => setVariant(v.tempId, 'color', e.target.value)} /></td>
                          <td><input type="number" step="0.01" value={v.price} onChange={(e) => setVariant(v.tempId, 'price', nNum(e.target.value, 0))} /></td>
                          <td><input type="number" step="0.01" value={v.cost} onChange={(e) => setVariant(v.tempId, 'cost', nNum(e.target.value, 0))} /></td>
                          <td><input type="number" value={v.quantity} onChange={(e) => setVariant(v.tempId, 'quantity', nInt(e.target.value, 0))} /></td>
                          <td><input type="text" value={v.barcode} onChange={(e) => setVariant(v.tempId, 'barcode', e.target.value)} /></td>
                          <td><button type="button" className="icon-btn danger" onClick={() => removeVariant(v)}><Trash2 size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <footer>
              <button type="button" className="products-btn products-btn-light" onClick={closeProductModal}>إلغاء</button>
              <button type="button" className="products-btn products-btn-primary" onClick={saveProduct} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ المنتج'}</button>
            </footer>
          </div>
        </div>
      ) : null}

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

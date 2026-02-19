import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Barcode, Camera, Copy, Plus, Save, Shuffle, Trash2, X } from 'lucide-react';
import './ProductModal.css';

const TABS = {
  BASIC: 'basic',
  UNITS: 'units',
  STOCK: 'stock'
};

const DEFAULT_UNIT_ROW = {
  unitName: '',
  conversionFactor: 1,
  salePrice: 0,
  wholesalePrice: 0,
  minSalePrice: 0,
  purchasePrice: 0,
  barcode: ''
};

const makeTempVariantId = () => `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const DEFAULT_VARIANT_ROW = () => ({
  tempId: makeTempVariantId(),
  id: null,
  size: '',
  color: '',
  price: 0,
  cost: 0,
  quantity: 0,
  barcode: ''
});

const NUMERIC_UNIT_FIELDS = new Set([
  'conversionFactor',
  'salePrice',
  'wholesalePrice',
  'minSalePrice',
  'purchasePrice'
]);

const nText = (value) => String(value ?? '').trim();
const toNum = (value, fallback = 0) => {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const money = (value) => Number(Math.max(0, toNum(value, 0)).toFixed(2));
const marginPercentOf = (purchasePrice, salePrice) => {
  const purchase = toNum(purchasePrice, 0);
  const sale = toNum(salePrice, 0);
  if (purchase <= 0) return 0;
  return Number((((sale - purchase) / purchase) * 100).toFixed(2));
};

const makeSku = (name = '') => {
  const prefix = nText(name)
    .replace(/[^\w\u0600-\u06FF\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part.slice(0, 3).toUpperCase())
    .join('-');
  const stamp = Date.now().toString().slice(-6);
  return `${prefix || 'PRD'}-${stamp}`;
};

const calcEan13CheckDigit = (code12) => {
  const digits = String(code12).replace(/\D/g, '').padStart(12, '0').slice(0, 12).split('').map((x) => Number(x));
  const sum = digits.reduce((acc, digit, index) => acc + (index % 2 === 0 ? digit : digit * 3), 0);
  return (10 - (sum % 10)) % 10;
};

const makeEan13 = () => {
  const partA = Date.now().toString().slice(-5);
  const partB = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const code12 = `20${partA}${partB}`;
  return `${code12}${calcEan13CheckDigit(code12)}`;
};

const normalizeUnit = (unit, index) => {
  const unitName = nText(unit?.unitName) || (index === 0 ? 'قطعة' : '');
  const conversionFactor = index === 0 ? 1 : Math.max(0.0001, toNum(unit?.conversionFactor, 1));
  const salePrice = money(unit?.salePrice);
  const purchasePrice = money(unit?.purchasePrice);
  const wholesalePrice = money(Math.min(Math.max(0, toNum(unit?.wholesalePrice, salePrice)), salePrice));
  const minSalePrice = money(Math.min(Math.max(0, toNum(unit?.minSalePrice, wholesalePrice)), salePrice));

  return {
    unitName,
    conversionFactor,
    salePrice,
    wholesalePrice,
    minSalePrice,
    purchasePrice,
    barcode: nText(unit?.barcode)
  };
};

const buildInitialState = (initialData) => {
  if (!initialData) {
    return {
      name: '',
      categoryId: '',
      brand: '',
      description: '',
      sku: '',
      barcode: makeEan13(),
      image: '',
      type: 'store',
      isActive: true,
      openingUnit: 'قطعة',
      openingQty: 0,
      displayQty: 0,
      minStock: 5,
      maxStock: 100,
      notes: '',
      units: [{ ...DEFAULT_UNIT_ROW, unitName: 'قطعة' }],
      hasVariants: false,
      variants: [],
      variantSizeDraft: 'S, M, L, XL',
      variantColorDraft: 'أسود, أبيض'
    };
  }
  const sourceUnits = Array.isArray(initialData.productUnits) ? initialData.productUnits : [];
  const units = sourceUnits.length > 0
    ? sourceUnits.map((unit, index) => normalizeUnit(unit, index))
    : [{
      ...DEFAULT_UNIT_ROW,
      unitName: 'قطعة',
      salePrice: money(initialData.basePrice),
      purchasePrice: money(initialData.cost),
      barcode: nText(initialData.barcode)
    }];
  const sourceVariants = Array.isArray(initialData.variants) ? initialData.variants : [];
  const variants = sourceVariants.map((variant) => ({
    tempId: makeTempVariantId(),
    id: variant.id || null,
    size: nText(variant.productSize),
    color: nText(variant.color),
    price: money(variant.price),
    cost: money(variant.cost),
    quantity: Math.max(0, toInt(variant.quantity, 0)),
    barcode: nText(variant.barcode)
  }));
  return {
    name: nText(initialData.name),
    categoryId: initialData.categoryId ? String(initialData.categoryId) : '',
    brand: nText(initialData.brand),
    description: nText(initialData.description),
    sku: nText(initialData.sku),
    barcode: nText(initialData.barcode),
    image: nText(initialData.image),
    type: nText(initialData.type) || 'store',
    isActive: initialData.isActive ?? true,
    openingUnit: nText(units[0]?.unitName) || 'قطعة',
    openingQty: toInt(initialData?.inventory?.warehouseQty, 0),
    displayQty: toInt(initialData?.inventory?.displayQty, 0),
    minStock: Math.max(0, toInt(initialData?.inventory?.minStock, 5)),
    maxStock: Math.max(0, toInt(initialData?.inventory?.maxStock, 100)),
    notes: nText(initialData?.inventory?.notes),
    units,
    hasVariants: variants.length > 0,
    variants,
    variantSizeDraft: 'S, M, L, XL',
    variantColorDraft: 'أسود, أبيض'
  };
};

export default function ProductModal({
  isOpen,
  onClose,
  onSave,
  initialData = null,
  categories = [],
  isSaving = false
}) {
  const [activeTab, setActiveTab] = useState(TABS.BASIC);
  const [formData, setFormData] = useState(() => buildInitialState(initialData));
  const [validationMessage, setValidationMessage] = useState('');
  const fileInputRef = useRef(null);

  const isEditMode = Boolean(initialData?.id);

  useEffect(() => {
    if (!isOpen) return;
    const nextState = buildInitialState(initialData);
    setFormData(nextState);
    setValidationMessage('');
    setActiveTab(TABS.BASIC);
  }, [isOpen, initialData]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onEscape = (event) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [isOpen, isSaving, onClose]);

  const mainUnit = useMemo(() => normalizeUnit(formData.units[0] || DEFAULT_UNIT_ROW, 0), [formData.units]);
  const stockTotalPreview = useMemo(
    () => Math.max(0, toInt(formData.openingQty, 0) + toInt(formData.displayQty, 0)),
    [formData.openingQty, formData.displayQty]
  );

  const setField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const setUnitField = (index, field, value) => {
    setFormData((prev) => {
      const nextUnits = [...prev.units];
      const current = normalizeUnit(nextUnits[index] || DEFAULT_UNIT_ROW, index);
      if (field === 'purchasePrice') {
        const newPurchase = money(value);
        const currentMargin = marginPercentOf(current.purchasePrice, current.salePrice);
        const recalculatedSale = money(newPurchase * (1 + (currentMargin / 100)));
        current.purchasePrice = newPurchase;
        current.salePrice = recalculatedSale;
        current.wholesalePrice = Math.min(current.wholesalePrice, recalculatedSale);
        current.minSalePrice = Math.min(current.minSalePrice, recalculatedSale);
      } else if (field === 'salePrice') {
        const newSale = money(value);
        current.salePrice = newSale;
        current.wholesalePrice = Math.min(current.wholesalePrice, newSale);
        current.minSalePrice = Math.min(current.minSalePrice, newSale);
      } else if (field === 'wholesalePrice') {
        current.wholesalePrice = money(Math.min(toNum(value, 0), current.salePrice));
      } else if (field === 'minSalePrice') {
        current.minSalePrice = money(Math.min(toNum(value, 0), current.salePrice));
      } else {
        current[field] = NUMERIC_UNIT_FIELDS.has(field) ? toNum(value, 0) : value;
      }
      nextUnits[index] = current;
      return { ...prev, units: nextUnits };
    });
  };

  const setUnitMarginPercent = (index, value) => {
    setFormData((prev) => {
      const nextUnits = [...prev.units];
      const current = normalizeUnit(nextUnits[index] || DEFAULT_UNIT_ROW, index);
      const marginPercent = Math.max(-100, toNum(value, 0));
      const salePrice = money(current.purchasePrice * (1 + (marginPercent / 100)));
      current.salePrice = salePrice;
      current.wholesalePrice = Math.min(current.wholesalePrice, salePrice);
      current.minSalePrice = Math.min(current.minSalePrice, salePrice);
      nextUnits[index] = current;
      return { ...prev, units: nextUnits };
    });
  };

  const applyMainMarginToAllUnits = () => {
    const mainMargin = marginPercentOf(mainUnit.purchasePrice, mainUnit.salePrice);
    setFormData((prev) => ({
      ...prev,
      units: prev.units.map((unit, index) => {
        const normalized = normalizeUnit(unit, index);
        if (index === 0) return normalized;
        const salePrice = money(normalized.purchasePrice * (1 + (mainMargin / 100)));
        return normalizeUnit({
          ...normalized,
          salePrice,
          wholesalePrice: Math.min(normalized.wholesalePrice, salePrice),
          minSalePrice: Math.min(normalized.minSalePrice, salePrice)
        }, index);
      })
    }));
  };

  const setVariantField = (index, field, value) => {
    setFormData((prev) => {
      const nextVariants = [...prev.variants];
      const current = { ...(nextVariants[index] || DEFAULT_VARIANT_ROW()) };
      if (field === 'price' || field === 'cost') current[field] = money(value);
      else if (field === 'quantity') current.quantity = Math.max(0, toInt(value, 0));
      else current[field] = value;
      nextVariants[index] = current;
      return { ...prev, variants: nextVariants };
    });
  };

  const addVariantRow = (seed = {}) => {
    setFormData((prev) => ({
      ...prev,
      hasVariants: true,
      variants: [
        ...prev.variants,
        {
          ...DEFAULT_VARIANT_ROW(),
          price: money(seed.price ?? mainUnit.salePrice),
          cost: money(seed.cost ?? mainUnit.purchasePrice),
          ...seed
        }
      ]
    }));
  };

  const removeVariantRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, rowIndex) => rowIndex !== index)
    }));
  };

  const toggleVariants = (enabled) => {
    setFormData((prev) => {
      if (!enabled) {
        return { ...prev, hasVariants: false, variants: [] };
      }
      if (prev.variants.length > 0) return { ...prev, hasVariants: true };
      return {
        ...prev,
        hasVariants: true,
        variants: [{
          ...DEFAULT_VARIANT_ROW(),
          size: 'M',
          color: 'أسود',
          price: money(mainUnit.salePrice),
          cost: money(mainUnit.purchasePrice)
        }]
      };
    });
  };

  const generateVariantCombinations = () => {
    const sizes = nText(formData.variantSizeDraft)
      .split(',')
      .map((item) => nText(item))
      .filter(Boolean);
    const colors = nText(formData.variantColorDraft)
      .split(',')
      .map((item) => nText(item))
      .filter(Boolean);

    if (!sizes.length || !colors.length) return;

    setFormData((prev) => {
      const existingKeys = new Set(
        prev.variants.map((variant) => `${nText(variant.size).toLowerCase()}|${nText(variant.color).toLowerCase()}`)
      );
      const additions = [];
      sizes.forEach((size) => {
        colors.forEach((color) => {
          const key = `${size.toLowerCase()}|${color.toLowerCase()}`;
          if (existingKeys.has(key)) return;
          existingKeys.add(key);
          additions.push({
            ...DEFAULT_VARIANT_ROW(),
            size,
            color,
            price: money(mainUnit.salePrice),
            cost: money(mainUnit.purchasePrice)
          });
        });
      });
      return {
        ...prev,
        hasVariants: true,
        variants: [...prev.variants, ...additions]
      };
    });
  };

  const collectTakenBarcodes = ({ excludeProduct = false, excludeUnitIndex = null, excludeVariantIndex = null } = {}) => {
    const taken = new Set();
    if (!excludeProduct) {
      const productBarcode = nText(formData.barcode);
      if (productBarcode) taken.add(productBarcode.toLowerCase());
    }
    formData.units.forEach((unit, index) => {
      if (excludeUnitIndex !== null && index === excludeUnitIndex) return;
      const unitBarcode = nText(unit?.barcode);
      if (unitBarcode) taken.add(unitBarcode.toLowerCase());
    });
    formData.variants.forEach((variant, index) => {
      if (excludeVariantIndex !== null && index === excludeVariantIndex) return;
      const variantBarcode = nText(variant?.barcode);
      if (variantBarcode) taken.add(variantBarcode.toLowerCase());
    });
    return taken;
  };

  const buildUniqueBarcode = (takenSet) => {
    for (let i = 0; i < 60; i += 1) {
      const candidate = makeEan13();
      if (!takenSet.has(candidate.toLowerCase())) return candidate;
    }
    return `${Date.now()}${Math.floor(Math.random() * 10)}`.slice(0, 13);
  };

  const addUnit = () => {
    setFormData((prev) => ({
      ...prev,
      units: [...prev.units, { ...DEFAULT_UNIT_ROW }]
    }));
  };

  const removeUnit = (index) => {
    if (formData.units.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      units: prev.units.filter((_, rowIndex) => rowIndex !== index)
    }));
  };

  const normalizeAllUnits = () => {
    setFormData((prev) => ({
      ...prev,
      units: prev.units.map((unit, index) => normalizeUnit(unit, index))
    }));
  };

  const generateUnitsPricingFromMain = () => {
    const baseSale = money(mainUnit.salePrice);
    const baseCost = money(mainUnit.purchasePrice);

    setFormData((prev) => ({
      ...prev,
      units: prev.units.map((unit, index) => {
        if (index === 0) return normalizeUnit(unit, 0);
        const factor = Math.max(0.0001, toNum(unit.conversionFactor, 1));
        const salePrice = money(baseSale * factor);
        const purchasePrice = money(baseCost * factor);
        return normalizeUnit({
          ...unit,
          salePrice,
          wholesalePrice: salePrice,
          minSalePrice: salePrice,
          purchasePrice
        }, index);
      })
    }));
  };

  const copyMainBarcodeToProductBarcode = () => {
    if (!nText(mainUnit.barcode)) return;
    setField('barcode', nText(mainUnit.barcode));
  };

  const generateProductBarcode = () => {
    const taken = collectTakenBarcodes({ excludeProduct: true });
    setField('barcode', buildUniqueBarcode(taken));
  };

  const generateUnitBarcode = (index) => {
    const taken = collectTakenBarcodes({ excludeUnitIndex: index });
    setUnitField(index, 'barcode', buildUniqueBarcode(taken));
  };

  const generateVariantBarcode = (index) => {
    const taken = collectTakenBarcodes({ excludeVariantIndex: index });
    setVariantField(index, 'barcode', buildUniqueBarcode(taken));
  };

  const pickImage = () => {
    if (isSaving) return;
    fileInputRef.current?.click();
  };

  const clearImage = () => {
    setField('image', '');
  };

  const onImageFileSelected = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setValidationMessage('اختر ملف صورة صالح (PNG/JPG/WebP).');
      setActiveTab(TABS.BASIC);
      return;
    }

    const sizeLimit = 2 * 1024 * 1024;
    if (file.size > sizeLimit) {
      setValidationMessage('حجم الصورة كبير. الحد الأقصى 2MB.');
      setActiveTab(TABS.BASIC);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = nText(reader.result);
      setField('image', result);
      setValidationMessage('');
    };
    reader.onerror = () => {
      setValidationMessage('تعذر قراءة ملف الصورة.');
      setActiveTab(TABS.BASIC);
    };
    reader.readAsDataURL(file);
  };

  const selectAllInputValue = useCallback((event) => {
    const input = event.target;
    if (!input || input.tagName !== 'INPUT') return;

    const inputType = String(input.type || '').toLowerCase();
    if (inputType === 'checkbox' || inputType === 'radio' || input.readOnly || input.disabled) return;

    if (typeof input.select === 'function') {
      input.select();
    }
  }, []);

  const handleSave = () => {
    setValidationMessage('');
    const name = nText(formData.name);
    if (!name) {
      setValidationMessage('اسم الصنف مطلوب.');
      setActiveTab(TABS.BASIC);
      return;
    }

    const normalizedUnits = formData.units
      .map((unit, index) => normalizeUnit(unit, index))
      .filter((unit, index) => index === 0 || unit.unitName || unit.salePrice || unit.purchasePrice || unit.barcode);

    if (!normalizedUnits.length || !nText(normalizedUnits[0].unitName)) {
      setValidationMessage('أضف وحدة أساسية واحدة على الأقل.');
      setActiveTab(TABS.UNITS);
      return;
    }

    const unitBarcodes = normalizedUnits.map((unit) => nText(unit.barcode).toLowerCase()).filter(Boolean);
    if (new Set(unitBarcodes).size !== unitBarcodes.length) {
      setValidationMessage('يوجد باركود مكرر بين الوحدات.');
      setActiveTab(TABS.UNITS);
      return;
    }

    const normalizedVariants = (formData.hasVariants ? formData.variants : [])
      .map((variant) => ({
        tempId: variant.tempId || makeTempVariantId(),
        id: variant.id ? toInt(variant.id, 0) : null,
        size: nText(variant.size) || 'موحد',
        color: nText(variant.color) || 'افتراضي',
        price: money(variant.price || normalizedUnits[0].salePrice),
        cost: money(variant.cost || normalizedUnits[0].purchasePrice),
        quantity: Math.max(0, toInt(variant.quantity, 0)),
        barcode: nText(variant.barcode) || null
      }))
      .filter((variant) => variant.size || variant.color || variant.price || variant.cost || variant.quantity || variant.barcode);

    if (formData.hasVariants && normalizedVariants.length === 0) {
      setValidationMessage('أضف متغيرًا واحدًا على الأقل أو ألغِ خيار الألوان/المقاسات.');
      setActiveTab(TABS.UNITS);
      return;
    }

    const variantBarcodes = normalizedVariants.map((variant) => nText(variant.barcode).toLowerCase()).filter(Boolean);
    if (new Set(variantBarcodes).size !== variantBarcodes.length) {
      setValidationMessage('يوجد باركود مكرر بين المتغيرات.');
      setActiveTab(TABS.UNITS);
      return;
    }

    const allBarcodes = [
      ...unitBarcodes,
      ...variantBarcodes,
      nText(formData.barcode).toLowerCase()
    ].filter(Boolean);
    if (new Set(allBarcodes).size !== allBarcodes.length) {
      setValidationMessage('يوجد تعارض باركود بين المنتج/الوحدات/المتغيرات.');
      setActiveTab(TABS.UNITS);
      return;
    }

    const categoryId = nText(formData.categoryId) || null;
    const openingQty = Math.max(0, toInt(formData.openingQty, 0));
    const displayQty = Math.max(0, toInt(formData.displayQty, 0));
    const minStock = Math.max(0, toInt(formData.minStock, 5));
    const maxStock = Math.max(minStock, toInt(formData.maxStock, 100));
    const firstUnit = normalizedUnits[0];

    onSave({
      name,
      categoryId,
      brand: nText(formData.brand) || null,
      description: nText(formData.description) || null,
      sku: nText(formData.sku) || null,
      barcode: nText(formData.barcode) || nText(firstUnit.barcode) || null,
      image: nText(formData.image) || null,
      type: nText(formData.type) || 'store',
      isActive: Boolean(formData.isActive),
      openingUnit: nText(formData.openingUnit) || nText(firstUnit.unitName) || 'قطعة',
      openingQty,
      displayQty,
      minStock,
      maxStock,
      notes: nText(formData.notes) || null,
      units: normalizedUnits,
      hasVariants: Boolean(formData.hasVariants),
      variants: normalizedVariants,
      basePrice: money(firstUnit.salePrice),
      cost: money(firstUnit.purchasePrice)
    });
  };

  if (!isOpen) return null;

  return (
    <div className="product-modal-overlay" onClick={() => !isSaving && onClose()}>
      <div className="product-modal" onClick={(event) => event.stopPropagation()}>
        <div className="product-modal-header">
          <div>
            <h2>{isEditMode ? 'تعديل منتج' : 'إضافة منتج جديد'}</h2>
            <p>{isEditMode ? 'حدّث بيانات المنتج والتسعير والمخزون' : 'أدخل البيانات الأساسية والتسعير والوحدات'}</p>
          </div>
          <button type="button" className="close-button" onClick={onClose} disabled={isSaving}>
            <X size={20} />
          </button>
        </div>

        <div className="product-modal-tabs">
          <button type="button" className={`tab-button ${activeTab === TABS.BASIC ? 'active' : ''}`} onClick={() => setActiveTab(TABS.BASIC)}>
            بيانات أساسية
          </button>
          <button type="button" className={`tab-button ${activeTab === TABS.UNITS ? 'active' : ''}`} onClick={() => setActiveTab(TABS.UNITS)}>
            التسعير والوحدات
          </button>
          <button type="button" className={`tab-button ${activeTab === TABS.STOCK ? 'active' : ''}`} onClick={() => setActiveTab(TABS.STOCK)}>
            المخزون
          </button>
        </div>

        <div className="product-modal-body">
          {validationMessage ? (
            <div className="modal-inline-alert">
              <AlertCircle size={16} />
              <span>{validationMessage}</span>
            </div>
          ) : null}

          {activeTab === TABS.BASIC ? (
            <div className="form-section">
              <div className="basic-layout">
                <div className="image-panel">
                  <input ref={fileInputRef} type="file" accept="image/*" className="image-file-input" onChange={onImageFileSelected} />
                  <div className="image-upload-wrap">
                    <button type="button" className="image-upload-box" onClick={pickImage}>
                      {formData.image ? <img src={formData.image} alt={formData.name || 'Product'} /> : <Camera size={34} />}
                    </button>
                    {formData.image ? (
                      <button
                        type="button"
                        className="image-clear-fab"
                        onClick={(event) => {
                          event.stopPropagation();
                          clearImage();
                        }}
                        aria-label="حذف الصورة"
                        title="حذف الصورة"
                        disabled={isSaving}
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>

                  <div className="image-status-row">
                    <label className="toggle-switch">
                      <input type="checkbox" checked={formData.isActive} onChange={(event) => setField('isActive', event.target.checked)} />
                      <span className="toggle-slider" />
                      <span>{formData.isActive ? 'المنتج نشط' : 'المنتج غير نشط'}</span>
                    </label>
                  </div>
                </div>

                <div className="main-form-grid">
                  <div className="form-row">
                    <label className="form-group">
                      <span>اسم الصنف</span>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.name}
                        onChange={(event) => setField('name', event.target.value)}
                        placeholder="مثال: تيشيرت قطن"
                      />
                    </label>
                    <label className="form-group">
                      <span>الفئة</span>
                      <select className="form-select" value={formData.categoryId} onChange={(event) => setField('categoryId', event.target.value)}>
                        <option value="">بدون فئة</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>{category.icon || '📦'} {category.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="form-row">
                    <label className="form-group">
                      <span>SKU / كود الصنف</span>
                      <div className="field-with-button">
                        <input type="text" className="form-input" value={formData.sku} onChange={(event) => setField('sku', event.target.value)} />
                        <button type="button" className="btn-icon" onClick={() => setField('sku', makeSku(formData.name))} title="توليد كود">
                          <Shuffle size={14} />
                        </button>
                      </div>
                    </label>
                    <label className="form-group">
                      <span>باركود المنتج</span>
                      <div className="field-with-buttons">
                        <input type="text" className="form-input" value={formData.barcode} onChange={(event) => setField('barcode', event.target.value)} />
                        <button type="button" className="btn-icon" onClick={generateProductBarcode} title="توليد باركود">
                          <Barcode size={14} />
                        </button>
                        <button type="button" className="btn-icon" onClick={copyMainBarcodeToProductBarcode} title="نسخ باركود الوحدة الأساسية">
                          <Copy size={14} />
                        </button>
                      </div>
                    </label>
                  </div>

                  <div className="form-row">
                    <label className="form-group">
                      <span>الماركة</span>
                      <input type="text" className="form-input" value={formData.brand} onChange={(event) => setField('brand', event.target.value)} />
                    </label>
                    <label className="form-group">
                      <span>نوع المنتج</span>
                      <select className="form-select" value={formData.type} onChange={(event) => setField('type', event.target.value)}>
                        <option value="store">منتج مخزني</option>
                        <option value="service">خدمة</option>
                      </select>
                    </label>
                  </div>

                  <div className="form-row">
                    <label className="form-group form-grow">
                      <span>الوصف</span>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={formData.description}
                        onChange={(event) => setField('description', event.target.value)}
                        placeholder="وصف مختصر للصنف"
                      />
                    </label>
                  </div>

                </div>
              </div>
            </div>
          ) : null}

          {activeTab === TABS.UNITS ? (
            <div
              className="form-section"
              onFocusCapture={selectAllInputValue}
              onClickCapture={selectAllInputValue}
            >
              <div className="units-toolbar">
                <button type="button" className="btn-inline" onClick={addUnit}>
                  <Plus size={14} />
                  إضافة وحدة
                </button>
                <button type="button" className="btn-inline" onClick={generateUnitsPricingFromMain}>
                  <Shuffle size={14} />
                  توليد أسعار الوحدات من الأساسية
                </button>
                <button type="button" className="btn-inline" onClick={applyMainMarginToAllUnits}>
                  تطبيق نفس نسبة ربح الوحدة الأساسية
                </button>
                <button type="button" className="btn-inline btn-inline-ghost" onClick={normalizeAllUnits}>
                  ترتيب وتنظيف الأرقام
                </button>
              </div>

              <div className="pricing-calculator">
                <label className="form-group">
                  <span>تكلفة الوحدة الأساسية</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    value={mainUnit.purchasePrice}
                    onChange={(event) => setUnitField(0, 'purchasePrice', event.target.value)}
                  />
                </label>
                <label className="form-group">
                  <span>نسبة الربح %</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={marginPercentOf(mainUnit.purchasePrice, mainUnit.salePrice)}
                    onChange={(event) => setUnitMarginPercent(0, event.target.value)}
                  />
                </label>
                <label className="form-group">
                  <span>سعر البيع الناتج</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    value={mainUnit.salePrice}
                    onChange={(event) => setUnitField(0, 'salePrice', event.target.value)}
                  />
                </label>
              </div>

              <div className="units-table-wrap">
                <table className="units-table">
                  <thead>
                    <tr>
                      <th>الوحدة</th>
                      <th>معامل التحويل</th>
                      <th>سعر البيع</th>
                      <th>سعر الجملة</th>
                      <th>أقل سعر</th>
                      <th>سعر الشراء</th>
                      <th>هامش %</th>
                      <th>باركود الوحدة</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {formData.units.map((unit, index) => (
                      <tr key={`unit-${index}`}>
                        <td>
                          <input
                            type="text"
                            value={unit.unitName}
                            onChange={(event) => setUnitField(index, 'unitName', event.target.value)}
                            placeholder={index === 0 ? 'الوحدة الأساسية' : 'مثال: كرتونة'}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={unit.conversionFactor}
                            onChange={(event) => setUnitField(index, 'conversionFactor', event.target.value)}
                            disabled={index === 0}
                          />
                        </td>
                        <td>
                          <input type="number" step="0.01" min="0" value={unit.salePrice} onChange={(event) => setUnitField(index, 'salePrice', event.target.value)} />
                        </td>
                        <td>
                          <input type="number" step="0.01" min="0" value={unit.wholesalePrice} onChange={(event) => setUnitField(index, 'wholesalePrice', event.target.value)} />
                        </td>
                        <td>
                          <input type="number" step="0.01" min="0" value={unit.minSalePrice} onChange={(event) => setUnitField(index, 'minSalePrice', event.target.value)} />
                        </td>
                        <td>
                          <input type="number" step="0.01" min="0" value={unit.purchasePrice} onChange={(event) => setUnitField(index, 'purchasePrice', event.target.value)} />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={marginPercentOf(unit.purchasePrice, unit.salePrice)}
                            onChange={(event) => setUnitMarginPercent(index, event.target.value)}
                          />
                        </td>
                        <td>
                          <div className="unit-barcode-field">
                            <input type="text" value={unit.barcode} onChange={(event) => setUnitField(index, 'barcode', event.target.value)} />
                            <button type="button" className="btn-icon" onClick={() => generateUnitBarcode(index)} title="توليد باركود الوحدة">
                              <Barcode size={14} />
                            </button>
                          </div>
                        </td>
                        <td>
                          {index > 0 ? (
                            <button type="button" className="delete-btn" onClick={() => removeUnit(index)} aria-label="حذف الوحدة">
                              <Trash2 size={16} />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <section className="variants-section">
                <div className="variants-header">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={formData.hasVariants}
                      onChange={(event) => toggleVariants(event.target.checked)}
                    />
                    <span className="toggle-slider" />
                    <span>المنتج له ألوان/مقاسات</span>
                  </label>

                  {formData.hasVariants ? (
                    <div className="variants-actions">
                      <button type="button" className="btn-inline" onClick={() => addVariantRow()}>
                        <Plus size={14} />
                        إضافة متغير
                      </button>
                      <button type="button" className="btn-inline btn-inline-ghost" onClick={generateVariantCombinations}>
                        <Shuffle size={14} />
                        توليد تركيبات
                      </button>
                    </div>
                  ) : null}
                </div>

                {formData.hasVariants ? (
                  <>
                    <div className="variants-generator-grid">
                      <label className="form-group">
                        <span>المقاسات (فاصلة)</span>
                        <input
                          type="text"
                          className="form-input"
                          value={formData.variantSizeDraft}
                          onChange={(event) => setField('variantSizeDraft', event.target.value)}
                          placeholder="S, M, L, XL"
                        />
                      </label>
                      <label className="form-group">
                        <span>الألوان (فاصلة)</span>
                        <input
                          type="text"
                          className="form-input"
                          value={formData.variantColorDraft}
                          onChange={(event) => setField('variantColorDraft', event.target.value)}
                          placeholder="أسود, أبيض"
                        />
                      </label>
                    </div>

                    <div className="variants-table-wrap">
                      <table className="variants-table">
                        <thead>
                          <tr>
                            <th>المقاس</th>
                            <th>اللون</th>
                            <th>سعر البيع</th>
                            <th>التكلفة</th>
                            <th>الكمية</th>
                            <th>الباركود</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {formData.variants.map((variant, index) => (
                            <tr key={variant.tempId || variant.id || index}>
                              <td>
                                <input type="text" value={variant.size} onChange={(event) => setVariantField(index, 'size', event.target.value)} placeholder="M" />
                              </td>
                              <td>
                                <input type="text" value={variant.color} onChange={(event) => setVariantField(index, 'color', event.target.value)} placeholder="أسود" />
                              </td>
                              <td>
                                <input type="number" min="0" step="0.01" value={variant.price} onChange={(event) => setVariantField(index, 'price', event.target.value)} />
                              </td>
                              <td>
                                <input type="number" min="0" step="0.01" value={variant.cost} onChange={(event) => setVariantField(index, 'cost', event.target.value)} />
                              </td>
                              <td>
                                <input type="number" min="0" value={variant.quantity} onChange={(event) => setVariantField(index, 'quantity', event.target.value)} />
                              </td>
                              <td>
                                <div className="unit-barcode-field">
                                  <input type="text" value={variant.barcode || ''} onChange={(event) => setVariantField(index, 'barcode', event.target.value)} />
                                  <button type="button" className="btn-icon" onClick={() => generateVariantBarcode(index)} title="توليد باركود المتغير">
                                    <Barcode size={14} />
                                  </button>
                                </div>
                              </td>
                              <td>
                                <button type="button" className="delete-btn" onClick={() => removeVariantRow(index)} aria-label="حذف المتغير">
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="variants-empty-note">فعّل الخيار لإضافة ألوان ومقاسات للمنتج.</div>
                )}
              </section>
            </div>
          ) : null}

          {activeTab === TABS.STOCK ? (
            <div
              className="form-section"
              onFocusCapture={selectAllInputValue}
              onClickCapture={selectAllInputValue}
            >
              <div className="stock-layout">
                {isEditMode ? <div className="stock-note">سيتم تحديث كميات المخزون الحالية لهذا الصنف.</div> : null}

                <div className="stock-basic-grid">
                  <label className="form-group">
                    <span>الوحدة الافتراضية للمخزون</span>
                    <select className="form-select" value={formData.openingUnit} onChange={(event) => setField('openingUnit', event.target.value)}>
                      {formData.units.map((unit, index) => (
                        <option key={`opening-unit-${index}`} value={nText(unit.unitName) || `unit-${index}`}>
                          {nText(unit.unitName) || `وحدة ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-group">
                    <span>كمية المخزن</span>
                    <input type="number" min="0" className="form-input" value={formData.openingQty} onChange={(event) => setField('openingQty', toInt(event.target.value, 0))} />
                  </label>
                  <label className="form-group">
                    <span>كمية العرض</span>
                    <input type="number" min="0" className="form-input" value={formData.displayQty} onChange={(event) => setField('displayQty', toInt(event.target.value, 0))} />
                  </label>
                  <label className="form-group">
                    <span>حد إعادة الطلب</span>
                    <input type="number" min="0" className="form-input" value={formData.minStock} onChange={(event) => setField('minStock', toInt(event.target.value, 5))} />
                  </label>
                </div>

                <div className="stock-total-card">
                  <span>إجمالي الرصيد الحالي</span>
                  <strong>{stockTotalPreview}</strong>
                </div>

                <details className="stock-advanced-panel">
                  <summary>إعدادات متقدمة</summary>
                  <div className="stock-advanced-content">
                    <label className="form-group">
                      <span>الحد الأقصى المقترح</span>
                      <input type="number" min="0" className="form-input" value={formData.maxStock} onChange={(event) => setField('maxStock', toInt(event.target.value, 100))} />
                    </label>
                    <label className="form-group form-grow">
                      <span>ملاحظات المخزون</span>
                      <textarea className="form-input" rows={3} value={formData.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="أي ملاحظة تخص التخزين أو التجهيز" />
                    </label>
                  </div>
                </details>
              </div>
            </div>
          ) : null}
        </div>

        <div className="product-modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={isSaving}>إلغاء</button>
          <button type="button" className="btn-save" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'جاري الحفظ...' : <><Save size={16} /> حفظ المنتج</>}
          </button>
        </div>
      </div>
    </div>
  );
}

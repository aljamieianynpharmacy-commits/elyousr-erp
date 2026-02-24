export const APP_SETTINGS_STORAGE_KEY = 'erp.appSettings.v1';

const DEFAULT_APP_SETTINGS = {
  defaultSaleType: 'نقدي',
  defaultWarehouseId: null
};

export const normalizeSaleType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'آجل' || normalized === 'اجل' || normalized === 'credit' || normalized === 'deferred') {
    return 'آجل';
  }
  return 'نقدي';
};

export const normalizeWarehouseId = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const getAppSettings = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_APP_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };

    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      defaultSaleType: normalizeSaleType(parsed?.defaultSaleType),
      defaultWarehouseId: normalizeWarehouseId(parsed?.defaultWarehouseId)
    };
  } catch (error) {
    return { ...DEFAULT_APP_SETTINGS };
  }
};

export const saveAppSettings = (partialSettings = {}) => {
  const current = getAppSettings();
  const merged = {
    ...current,
    ...partialSettings,
    defaultSaleType: normalizeSaleType(partialSettings?.defaultSaleType ?? current.defaultSaleType),
    defaultWarehouseId: normalizeWarehouseId(partialSettings?.defaultWarehouseId ?? current.defaultWarehouseId)
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
  }

  return merged;
};

export const getDefaultSaleType = () => getAppSettings().defaultSaleType;
export const getDefaultWarehouseId = () => getAppSettings().defaultWarehouseId;

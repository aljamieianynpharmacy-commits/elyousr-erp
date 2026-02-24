export const APP_SETTINGS_STORAGE_KEY = 'erp.appSettings.v1';

const DEFAULT_APP_SETTINGS = {
  defaultSaleType: 'نقدي',
  defaultWarehouseId: null,
  defaultSearchMode: 'name',
  defaultProductDisplayMode: 'list',
  companyName: '',
  companyContactNumbers: '',
  companyAddress: ''
};

export const normalizeSaleType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'آجل' ||
    normalized === 'اجل' ||
    normalized === 'credit' ||
    normalized === 'deferred'
  ) {
    return 'آجل';
  }
  return 'نقدي';
};

export const normalizeWarehouseId = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const normalizeSearchMode = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'barcode' ? 'barcode' : 'name';
};

export const normalizeProductDisplayMode = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'grid' ? 'grid' : 'list';
};

export const normalizeCompanyName = (value) => String(value ?? '')
  .trim()
  .slice(0, 120);

export const normalizeCompanyContactNumbers = (value) => String(value ?? '')
  .trim()
  .slice(0, 500);

export const normalizeCompanyAddress = (value) => String(value ?? '')
  .trim()
  .slice(0, 250);

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
      defaultWarehouseId: normalizeWarehouseId(parsed?.defaultWarehouseId),
      defaultSearchMode: normalizeSearchMode(parsed?.defaultSearchMode),
      defaultProductDisplayMode: normalizeProductDisplayMode(parsed?.defaultProductDisplayMode),
      companyName: normalizeCompanyName(parsed?.companyName),
      companyContactNumbers: normalizeCompanyContactNumbers(parsed?.companyContactNumbers),
      companyAddress: normalizeCompanyAddress(parsed?.companyAddress)
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
    defaultWarehouseId: normalizeWarehouseId(partialSettings?.defaultWarehouseId ?? current.defaultWarehouseId),
    defaultSearchMode: normalizeSearchMode(partialSettings?.defaultSearchMode ?? current.defaultSearchMode),
    defaultProductDisplayMode: normalizeProductDisplayMode(
      partialSettings?.defaultProductDisplayMode ?? current.defaultProductDisplayMode
    ),
    companyName: normalizeCompanyName(partialSettings?.companyName ?? current.companyName),
    companyContactNumbers: normalizeCompanyContactNumbers(
      partialSettings?.companyContactNumbers ?? current.companyContactNumbers
    ),
    companyAddress: normalizeCompanyAddress(partialSettings?.companyAddress ?? current.companyAddress)
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
  }

  return merged;
};

export const getDefaultSaleType = () => getAppSettings().defaultSaleType;
export const getDefaultWarehouseId = () => getAppSettings().defaultWarehouseId;
export const getDefaultSearchMode = () => getAppSettings().defaultSearchMode;
export const getDefaultProductDisplayMode = () => getAppSettings().defaultProductDisplayMode;
export const getCompanyName = () => getAppSettings().companyName;
export const getCompanyContactNumbers = () => getAppSettings().companyContactNumbers;
export const getCompanyAddress = () => getAppSettings().companyAddress;
export const getCompanyPrintSettings = () => {
  const settings = getAppSettings();
  return {
    name: normalizeCompanyName(settings.companyName) || 'ERP SYSTEM',
    contactNumbers: normalizeCompanyContactNumbers(settings.companyContactNumbers),
    address: normalizeCompanyAddress(settings.companyAddress)
  };
};

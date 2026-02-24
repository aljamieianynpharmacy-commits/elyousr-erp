import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { safeAlert } from '../utils/safeAlert';
import { safeConfirm } from '../utils/safeConfirm';
import { safePrint } from '../printing/safePrint';
import { emitPurchaseEditorRequest } from '../utils/posEditorBridge';
import SaleActions from '../components/sales/SaleActions';
import './Sales.css';

const PAGE_SIZE = 50;
const PURCHASES_CACHE_TTL_MS = 60 * 1000;
const purchasesPageCache = new Map();

const normalizeSearchToken = (value) => String(value ?? '').trim().toLowerCase();
const normalizeDateToken = (value) => String(value ?? '').trim();
const getTodayInputDate = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
  return localDate.toISOString().split('T')[0];
};

const getPurchasesCacheKey = (page, pageSize = PAGE_SIZE, filters = {}) => {
  const normalizedSearch = normalizeSearchToken(filters?.searchTerm);
  const normalizedFromDate = normalizeDateToken(filters?.fromDate);
  const normalizedToDate = normalizeDateToken(filters?.toDate);

  return (
    `purchases:p${page}:s${pageSize}`
    + `:q${encodeURIComponent(normalizedSearch)}`
    + `:f${encodeURIComponent(normalizedFromDate)}`
    + `:t${encodeURIComponent(normalizedToDate)}`
  );
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatMoney = (value) => `${Number(value || 0).toFixed(2)} ج.م`;
const getPurchaseDate = (purchase) => purchase?.invoiceDate || purchase?.createdAt;

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const normalizePurchaseRow = (purchase) => {
  const total = Math.max(0, toFiniteNumber(purchase?.total, 0));
  const paidRaw = toFiniteNumber(purchase?.paidAmount ?? purchase?.paid, 0);
  const paidAmount = Math.max(0, Math.min(total, paidRaw));
  const remainingAmount = Math.max(0, total - paidAmount);
  const itemsCount = Number.isFinite(Number(purchase?.itemsCount))
    ? Number(purchase.itemsCount)
    : Array.isArray(purchase?.items)
      ? purchase.items.length
      : 0;

  return {
    ...purchase,
    total,
    paidAmount,
    remainingAmount,
    itemsCount
  };
};

const normalizePurchasesResponse = (result, fallbackPage) => {
  if (Array.isArray(result)) {
    return {
      data: result,
      total: result.length,
      page: fallbackPage,
      totalPages: Math.max(1, Math.ceil(result.length / PAGE_SIZE))
    };
  }

  return {
    data: Array.isArray(result?.data) ? result.data : [],
    total: Number(result?.total || 0),
    page: Number(result?.page || fallbackPage),
    totalPages: Number(result?.totalPages || 1)
  };
};

const getFreshPurchasesCache = (cacheKey) => {
  const cached = purchasesPageCache.get(cacheKey);
  if (!cached) return null;
  if ((Date.now() - cached.timestamp) > PURCHASES_CACHE_TTL_MS) return null;
  return cached;
};

const writePurchasesCache = (cacheKey, payload) => {
  purchasesPageCache.set(cacheKey, {
    ...payload,
    timestamp: Date.now()
  });
};

export const clearPurchaseHistoryCache = () => {
  purchasesPageCache.clear();
};

export const prefetchPurchaseHistoryPage = async ({ page = 1, pageSize = PAGE_SIZE } = {}) => {
  if (typeof window === 'undefined' || typeof window?.api?.getPurchases !== 'function') {
    return null;
  }

  const cacheKey = getPurchasesCacheKey(page, pageSize, {});
  const cached = getFreshPurchasesCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await window.api.getPurchases({
      paginated: true,
      page,
      pageSize,
      sortCol: 'createdAt',
      sortDir: 'desc',
      lightweight: true
    });

    if (response?.error) return null;

    const normalized = normalizePurchasesResponse(response, page);
    const rows = (normalized.data || []).map(normalizePurchaseRow);
    const payload = {
      data: rows,
      totalItems: normalized.total,
      totalPages: Math.max(1, normalized.totalPages)
    };

    writePurchasesCache(cacheKey, payload);
    return payload;
  } catch (error) {
    console.error('Purchase history prefetch failed:', error);
    return null;
  }
};

const buildPurchaseSearchIndex = (purchase) => ([
  purchase?.id,
  purchase?.invoiceDate,
  purchase?.createdAt,
  purchase?.supplier?.name,
  purchase?.purchaseType,
  purchase?.payment,
  purchase?.paymentMethod?.name,
  purchase?.notes,
  purchase?.total,
  purchase?.paidAmount,
  purchase?.remainingAmount,
  purchase?.itemsCount
]
  .map((value) => String(value ?? '').toLowerCase())
  .join(' '));

const generatePurchaseInvoiceHTML = (purchase) => {
  const items = Array.isArray(purchase?.items) ? purchase.items : [];
  const total = Math.max(0, toFiniteNumber(purchase?.total, 0));
  const paid = Math.max(0, Math.min(total, toFiniteNumber(purchase?.paidAmount ?? purchase?.paid, 0)));
  const remaining = Math.max(0, total - paid);
  const supplier = purchase?.supplier || null;
  const paymentLabel = purchase?.payment || purchase?.paymentMethod?.name || '-';

  const rows = items.map((item, index) => {
    const quantity = Math.max(0, toFiniteNumber(item?.quantity, 0));
    const price = Math.max(0, toFiniteNumber(item?.price ?? item?.cost, 0));
    const lineTotal = price * quantity;

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item?.variant?.product?.name || item?.productName || 'منتج')}</td>
        <td>${escapeHtml(item?.variant?.productSize || item?.size || '-')}</td>
        <td>${escapeHtml(item?.variant?.color || item?.color || '-')}</td>
        <td>${quantity}</td>
        <td>${price.toFixed(2)}</td>
        <td>${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <title>فاتورة مشتريات رقم ${escapeHtml(purchase?.id)}</title>
    <style>
      body { font-family: Tahoma, Arial, sans-serif; margin: 0; padding: 20px; color: #111827; direction: rtl; }
      .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 14px; }
      .header h1 { margin: 0; font-size: 22px; color: #0f766e; }
      .header p { margin: 6px 0 0; color: #475569; }
      .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; font-size: 13px; }
      .meta-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f8fafc; }
      .meta-box strong { color: #0f172a; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
      th, td { border: 1px solid #dbe2ea; padding: 8px; font-size: 13px; text-align: right; }
      th { background: #f1f5f9; color: #334155; }
      .summary { border: 1px solid #dbe2ea; border-radius: 8px; padding: 10px; background: #f8fafc; }
      .summary-row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 14px; }
      .summary-row strong { color: #0f172a; }
      .summary-row.total { border-top: 1px solid #dbe2ea; padding-top: 8px; font-size: 16px; font-weight: 700; color: #0f766e; }
      .footer { margin-top: 20px; text-align: center; color: #64748b; font-size: 12px; }
      @media print { body { padding: 10px; } }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>فاتورة مشتريات</h1>
      <p>رقم الفاتورة: #${escapeHtml(purchase?.id)}</p>
      <p>التاريخ: ${escapeHtml(formatDateTime(getPurchaseDate(purchase)))}</p>
    </div>

    <div class="meta">
      <div class="meta-box">
        <div><strong>المورد:</strong> ${escapeHtml(supplier?.name || 'مورد عام')}</div>
        <div><strong>الهاتف:</strong> ${escapeHtml(supplier?.phone || '-')}</div>
      </div>
      <div class="meta-box">
        <div><strong>طريقة الدفع:</strong> ${escapeHtml(paymentLabel)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>الصنف</th>
          <th>المقاس</th>
          <th>اللون</th>
          <th>الكمية</th>
          <th>السعر</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="7" style="text-align:center">لا توجد أصناف</td></tr>'}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-row"><span>إجمالي الفاتورة</span><strong>${formatMoney(total)}</strong></div>
      <div class="summary-row"><span>المدفوع</span><strong>${formatMoney(paid)}</strong></div>
      <div class="summary-row total"><span>المتبقي</span><strong>${formatMoney(remaining)}</strong></div>
    </div>

    <div class="footer">
      وقت الطباعة: ${escapeHtml(new Date().toLocaleString('ar-EG'))}
    </div>
  </body>
  </html>
  `.trim();
};

function PurchaseDetailsModal({ purchase, onClose }) {
  if (!purchase) return null;

  const isLoadingDetails = Boolean(purchase?.isLoadingDetails);
  const items = Array.isArray(purchase?.items) ? purchase.items : [];

  return (
    <div className="sales-modal-overlay" onClick={onClose}>
      <div className="sales-modal" onClick={(event) => event.stopPropagation()}>
        <div className="sales-modal-header">
          <h2>تفاصيل فاتورة المشتريات #{purchase.id}</h2>
          <button className="sales-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="sales-modal-meta">
          <div><strong>التاريخ:</strong> {formatDateTime(getPurchaseDate(purchase))}</div>
          <div><strong>المورد:</strong> {purchase.supplier?.name || 'مورد عام'}</div>
          <div><strong>طريقة الدفع:</strong> {purchase.payment || purchase.paymentMethod?.name || '-'}</div>
          <div><strong>إجمالي الفاتورة:</strong> {formatMoney(purchase.total)}</div>
        </div>

        <div className="sales-modal-table-wrap">
          <table className="sales-modal-table">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>المقاس</th>
                <th>اللون</th>
                <th>الكمية</th>
                <th>السعر</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingDetails ? (
                <tr>
                  <td colSpan={6} className="sales-empty-state">جاري تحميل التفاصيل...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="sales-empty-state">لا توجد أصناف في الفاتورة</td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const quantity = Math.max(0, toFiniteNumber(item?.quantity, 0));
                  const price = Math.max(0, toFiniteNumber(item?.price ?? item?.cost, 0));

                  return (
                    <tr key={`${purchase.id}-${item.id || item.variantId || index}`}>
                      <td>{item.variant?.product?.name || item.productName || 'منتج'}</td>
                      <td>{item.variant?.productSize || item.size || '-'}</td>
                      <td>{item.variant?.color || item.color || '-'}</td>
                      <td>{quantity}</td>
                      <td>{formatMoney(price)}</td>
                      <td>{formatMoney(price * quantity)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [defaultDateFilter] = useState(() => getTodayInputDate());
  const [fromDateFilter, setFromDateFilter] = useState(() => defaultDateFilter);
  const [toDateFilter, setToDateFilter] = useState(() => defaultDateFilter);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const detailsRequestRef = useRef(0);
  const latestPurchasesRequestRef = useRef(0);

  const loadPurchases = useCallback(async () => {
    const requestId = latestPurchasesRequestRef.current + 1;
    latestPurchasesRequestRef.current = requestId;

    const normalizedSearchTerm = String(searchTerm || '').trim();
    let normalizedFromDate = String(fromDateFilter || '').trim();
    let normalizedToDate = String(toDateFilter || '').trim();

    if (normalizedFromDate && normalizedToDate && normalizedFromDate > normalizedToDate) {
      [normalizedFromDate, normalizedToDate] = [normalizedToDate, normalizedFromDate];
    }

    const cacheKey = getPurchasesCacheKey(currentPage, PAGE_SIZE, {
      searchTerm: normalizedSearchTerm,
      fromDate: normalizedFromDate,
      toDate: normalizedToDate
    });
    const cached = getFreshPurchasesCache(cacheKey);
    const hasCache = Boolean(cached);

    if (hasCache) {
      setPurchases(cached.data || []);
      setTotalItems(cached.totalItems || 0);
      setTotalPages(cached.totalPages || 1);
    }

    try {
      const requestOptions = {
        paginated: true,
        page: currentPage,
        pageSize: PAGE_SIZE,
        searchTerm: normalizedSearchTerm,
        sortCol: 'createdAt',
        sortDir: 'desc',
        lightweight: true
      };

      if (normalizedFromDate) requestOptions.fromDate = normalizedFromDate;
      if (normalizedToDate) requestOptions.toDate = normalizedToDate;

      const response = await window.api.getPurchases(requestOptions);
      if (requestId !== latestPurchasesRequestRef.current) return;

      if (response?.error) {
        if (!hasCache) {
          await safeAlert('تعذر تحميل فواتير المشتريات: ' + response.error);
          setPurchases([]);
          setTotalItems(0);
          setTotalPages(1);
        } else {
          console.error('Purchase history refresh failed:', response.error);
        }
        return;
      }

      const normalized = normalizePurchasesResponse(response, currentPage);
      const rows = (normalized.data || []).map(normalizePurchaseRow);
      const nextTotalPages = Math.max(1, normalized.totalPages);

      setPurchases(rows);
      setTotalItems(normalized.total);
      setTotalPages(nextTotalPages);

      writePurchasesCache(cacheKey, {
        data: rows,
        totalItems: normalized.total,
        totalPages: nextTotalPages
      });
    } catch (error) {
      if (requestId !== latestPurchasesRequestRef.current) return;
      console.error('Failed to load purchases:', error);
      if (!hasCache) {
        await safeAlert('تعذر تحميل فواتير المشتريات');
        setPurchases([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } finally {
      if (requestId !== latestPurchasesRequestRef.current) return;
      setHasLoadedOnce(true);
    }
  }, [currentPage, searchTerm, fromDateFilter, toDateFilter]);

  const fetchPurchaseDetails = useCallback(async (purchaseId) => {
    const result = await window.api.getPurchaseById(purchaseId);
    if (result?.error) {
      await safeAlert('تعذر تحميل تفاصيل الفاتورة: ' + result.error);
      return null;
    }
    return normalizePurchaseRow(result);
  }, []);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  const visiblePurchases = useMemo(() => {
    const normalizedSearch = normalizeSearchToken(searchTerm);
    if (!normalizedSearch) return purchases;
    return purchases.filter((purchase) => buildPurchaseSearchIndex(purchase).includes(normalizedSearch));
  }, [purchases, searchTerm]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(Math.max(1, prev), totalPages));
  }, [totalPages]);

  const isInitialLoading = !hasLoadedOnce && purchases.length === 0;

  const handleCloseDetailsModal = useCallback(() => {
    detailsRequestRef.current += 1;
    setSelectedPurchase(null);
  }, []);

  const handleOpenPurchaseDetails = useCallback(async (purchase) => {
    const requestId = detailsRequestRef.current + 1;
    detailsRequestRef.current = requestId;

    setSelectedPurchase({
      ...purchase,
      items: Array.isArray(purchase?.items) ? purchase.items : [],
      isLoadingDetails: true
    });

    const fullPurchase = await fetchPurchaseDetails(purchase.id);
    if (detailsRequestRef.current !== requestId) return;

    if (!fullPurchase) {
      setSelectedPurchase((prev) => (
        prev && prev.id === purchase.id
          ? { ...prev, isLoadingDetails: false }
          : prev
      ));
      return;
    }

    setSelectedPurchase(fullPurchase);
  }, [fetchPurchaseDetails]);

  const handleEditPurchase = useCallback(async (purchase) => {
    try {
      const linkedReturnsCount = Array.isArray(purchase?.returns)
        ? purchase.returns.length
        : Number(purchase?.returnsCount || 0);
      if (linkedReturnsCount > 0) {
        await safeAlert('لا يمكن تعديل فاتورة مشتريات مرتبطة بمرتجع مشتريات.');
        return;
      }

      const fullPurchase = await fetchPurchaseDetails(purchase.id);
      if (!fullPurchase) return;

      const paidAmount = Math.max(0, toFiniteNumber(fullPurchase?.paidAmount ?? fullPurchase?.paid, 0));
      const totalAmount = Math.max(0, toFiniteNumber(fullPurchase?.total, 0));
      const remainingAmount = Math.max(0, totalAmount - paidAmount);
      const supplier = fullPurchase?.supplier || null;

      emitPurchaseEditorRequest({
        type: 'purchase',
        sale: {
          ...fullPurchase,
          customerId: fullPurchase?.supplierId || supplier?.id || null,
          customer: supplier,
          saleType: fullPurchase?.purchaseType || (remainingAmount > 0 ? 'آجل' : 'نقدي'),
          paidAmount,
          remainingAmount
        },
        customer: supplier
      });
    } catch (error) {
      console.error('Open purchase editor failed:', error);
      await safeAlert('تعذر فتح الفاتورة للتعديل');
    }
  }, [fetchPurchaseDetails]);

  const handleDeletePurchase = useCallback(async (purchase) => {
    const linkedReturnsCount = Array.isArray(purchase?.returns)
      ? purchase.returns.length
      : Number(purchase?.returnsCount || 0);
    if (linkedReturnsCount > 0) {
      await safeAlert('لا يمكن حذف فاتورة مشتريات مرتبطة بمرتجع مشتريات.');
      return;
    }

    const confirmed = await safeConfirm(
      `هل أنت متأكد من حذف فاتورة المشتريات رقم ${purchase.id}؟`,
      { title: 'تأكيد الحذف', detail: 'لا يمكن التراجع عن هذه العملية.' }
    );
    if (!confirmed) return;

    try {
      const result = await window.api.deletePurchase(purchase.id);
      if (result?.error) {
        await safeAlert('فشل الحذف: ' + result.error);
        return;
      }

      clearPurchaseHistoryCache();
      setSelectedPurchase((prev) => (prev?.id === purchase.id ? null : prev));
      if (purchases.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => Math.max(1, prev - 1));
      } else {
        await loadPurchases();
      }
    } catch (error) {
      console.error('Delete purchase failed:', error);
      await safeAlert('تعذر حذف فاتورة المشتريات');
    }
  }, [purchases.length, currentPage, loadPurchases]);

  const handlePrintPurchase = useCallback(async (purchase) => {
    try {
      const fullPurchase = await fetchPurchaseDetails(purchase.id);
      if (!fullPurchase) return;

      const html = generatePurchaseInvoiceHTML(fullPurchase);
      const result = await safePrint(html, {
        title: `فاتورة مشتريات رقم ${fullPurchase.id}`
      });

      if (result?.error) {
        await safeAlert('خطأ في الطباعة: ' + result.error);
      }
    } catch (error) {
      console.error('Print purchase failed:', error);
      await safeAlert('تعذر تنفيذ الطباعة');
    }
  }, [fetchPurchaseDetails]);

  const handleSearchChange = useCallback((event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  }, []);

  const handleFromDateFilterChange = useCallback((event) => {
    setFromDateFilter(event.target.value);
    setCurrentPage(1);
  }, []);

  const handleToDateFilterChange = useCallback((event) => {
    setToDateFilter(event.target.value);
    setCurrentPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchTerm('');
    setFromDateFilter(defaultDateFilter);
    setToDateFilter(defaultDateFilter);
    setCurrentPage(1);
  }, [defaultDateFilter]);

  const hasActiveFilters = Boolean(
    searchTerm
    || fromDateFilter !== defaultDateFilter
    || toDateFilter !== defaultDateFilter
  );

  const pageStart = totalItems === 0 ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1;
  const pageEnd = totalItems === 0 ? 0 : Math.min(totalItems, pageStart + visiblePurchases.length - 1);

  return (
    <div className="sales-page">
      <div className="sales-table-card card">
        <div className="sales-search-bar">
          <div className="sales-filter-group sales-filter-group-search">
            <label>بحث سريع</label>
            <input
              type="text"
              className="sales-search-input"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="رقم الفاتورة / اسم المورد / ملاحظة"
            />
          </div>

          <div className="sales-filter-group sales-filter-group-date">
            <label>من تاريخ</label>
            <input
              type="date"
              value={fromDateFilter}
              onChange={handleFromDateFilterChange}
            />
          </div>

          <div className="sales-filter-group sales-filter-group-date">
            <label>إلى تاريخ</label>
            <input
              type="date"
              value={toDateFilter}
              onChange={handleToDateFilterChange}
            />
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              className="sales-btn sales-btn-light"
              onClick={clearAllFilters}
            >
              مسح الفلاتر
            </button>
          ) : null}

          <button
            type="button"
            className="sales-btn sales-btn-light"
            onClick={() => {
              clearPurchaseHistoryCache();
              loadPurchases();
            }}
          >
            تحديث
          </button>
        </div>

        <div className="sales-table-scroll">
          <table className="sales-table">
            <thead>
              <tr>
                <th># الفاتورة</th>
                <th>التاريخ</th>
                <th>المورد</th>
                <th>طريقة الدفع</th>
                <th>الإجمالي</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th>عدد الأصناف</th>
                <th>ملاحظات</th>
                <th>إجراءات</th>
              </tr>
            </thead>

            <tbody>
              {visiblePurchases.length === 0 && hasLoadedOnce ? (
                <tr>
                  <td colSpan={10} className="sales-empty-state">
                    لا توجد مشتريات
                  </td>
                </tr>
              ) : (
                visiblePurchases.map((purchase) => {
                  const remainingAmount = Number(purchase.remainingAmount || 0);
                  const paidAmount = Number(purchase.paidAmount || 0);

                  return (
                    <tr key={purchase.id}>
                      <td>#{purchase.id}</td>
                      <td>{formatDateTime(getPurchaseDate(purchase))}</td>
                      <td>{purchase.supplier?.name || 'مورد عام'}</td>
                      <td>{purchase.payment || purchase.paymentMethod?.name || '-'}</td>
                      <td className="sales-money sales-total">{formatMoney(purchase.total)}</td>
                      <td className="sales-money sales-paid">{formatMoney(paidAmount)}</td>
                      <td className={`sales-money ${remainingAmount > 0 ? 'sales-remaining' : 'sales-cleared'}`}>
                        {formatMoney(remainingAmount)}
                      </td>
                      <td>{purchase.itemsCount || 0}</td>
                      <td className="sales-notes-cell" title={purchase.notes || '-'}>
                        {purchase.notes || '-'}
                      </td>
                      <td>
                        <SaleActions
                          sale={purchase}
                          onView={handleOpenPurchaseDetails}
                          onEdit={handleEditPurchase}
                          onPrint={handlePrintPurchase}
                          onDelete={handleDeletePurchase}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="sales-pagination">
          <button
            className="sales-btn sales-btn-light"
            disabled={currentPage <= 1 || isInitialLoading}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          >
            السابق
          </button>

          <span>
            {pageStart.toLocaleString('ar-EG')} - {pageEnd.toLocaleString('ar-EG')} من {totalItems.toLocaleString('ar-EG')}
          </span>

          <button
            className="sales-btn sales-btn-light"
            disabled={currentPage >= totalPages || isInitialLoading}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          >
            التالي
          </button>
        </div>
      </div>

      <PurchaseDetailsModal
        purchase={selectedPurchase}
        onClose={handleCloseDetailsModal}
      />
    </div>
  );
}

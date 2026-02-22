import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { safeAlert } from '../utils/safeAlert';
import { safeConfirm } from '../utils/safeConfirm';
import { safePrint } from '../printing/safePrint';
import { generateInvoiceHTML } from '../printing/invoiceTemplate';
import { emitPosEditorRequest } from '../utils/posEditorBridge';
import SaleActions from '../components/sales/SaleActions';
import SaleDetailsModal from '../components/sales/SaleDetailsModal';
import './Sales.css';

const PAGE_SIZE = 100;

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
const getSaleDate = (sale) => sale?.invoiceDate || sale?.createdAt;

const toFiniteNumber = (value, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const isCreditSaleType = (saleType) => {
    const normalized = String(saleType || '').trim().toLowerCase();
    return (
        normalized === 'آجل'
        || normalized === 'اجل'
        || normalized === 'Ã¸Â¢Ã¸Â¬Ã¹â€ž'
        || normalized === 'credit'
        || normalized === 'deferred'
    );
};

const normalizeSaleRow = (sale) => {
    const total = Math.max(0, toFiniteNumber(sale?.total, 0));
    const paidFromApi = hasValue(sale?.paidAmount) ? toFiniteNumber(sale.paidAmount, 0) : null;
    const remainingFromApi = hasValue(sale?.remainingAmount) ? toFiniteNumber(sale.remainingAmount, 0) : null;
    const paidLegacy = hasValue(sale?.paid) ? toFiniteNumber(sale.paid, 0) : null;
    const remainingLegacy = hasValue(sale?.remaining) ? toFiniteNumber(sale.remaining, 0) : null;

    const paidKnown = paidFromApi ?? paidLegacy;
    const remainingKnown = remainingFromApi ?? remainingLegacy;

    let remainingAmount;
    if (remainingKnown !== null) {
        remainingAmount = Math.max(0, remainingKnown);
    } else if (paidKnown !== null) {
        remainingAmount = Math.max(0, total - paidKnown);
    } else {
        remainingAmount = isCreditSaleType(sale?.saleType) ? total : 0;
    }

    let paidAmount;
    if (paidKnown !== null) {
        paidAmount = Math.max(0, paidKnown);
    } else {
        paidAmount = Math.max(0, total - remainingAmount);
    }

    const itemsCount = Number.isFinite(Number(sale?.itemsCount))
        ? Number(sale.itemsCount)
        : Array.isArray(sale?.items)
            ? sale.items.length
            : 0;

    return {
        ...sale,
        total,
        paidAmount,
        remainingAmount,
        itemsCount
    };
};

const normalizeSalesResponse = (result, fallbackPage) => {
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

export default function Sales() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busySaleId, setBusySaleId] = useState(null);
    const [selectedSale, setSelectedSale] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const loadSales = useCallback(async () => {
        setLoading(true);
        try {
            const response = await window.api.getSales({
                paginated: true,
                page: currentPage,
                pageSize: PAGE_SIZE,
                sortCol: 'invoiceDate',
                sortDir: 'desc',
                lightweight: true
            });

            if (response?.error) {
                await safeAlert('خطأ في تحميل المبيعات: ' + response.error);
                setSales([]);
                setTotalItems(0);
                setTotalPages(1);
                return;
            }

            const normalized = normalizeSalesResponse(response, currentPage);
            setSales((normalized.data || []).map(normalizeSaleRow));
            setTotalItems(normalized.total);
            setTotalPages(Math.max(1, normalized.totalPages));
        } catch (error) {
            console.error('Failed to load sales:', error);
            await safeAlert('تعذر تحميل المبيعات');
            setSales([]);
            setTotalItems(0);
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    }, [currentPage]);

    const fetchSaleDetails = useCallback(async (saleId) => {
        const result = await window.api.getSaleById(saleId);
        if (result?.error) {
            await safeAlert('تعذر تحميل بيانات الفاتورة: ' + result.error);
            return null;
        }
        return result;
    }, []);

    useEffect(() => {
        loadSales();
    }, [loadSales]);

    const handleOpenSaleDetails = useCallback(async (sale) => {
        setBusySaleId(sale.id);
        try {
            const fullSale = await fetchSaleDetails(sale.id);
            if (!fullSale) return;
            setSelectedSale(fullSale);
        } finally {
            setBusySaleId(null);
        }
    }, [fetchSaleDetails]);

    const handlePrintSale = useCallback(async (sale) => {
        setBusySaleId(sale.id);
        try {
            const fullSale = await fetchSaleDetails(sale.id);
            if (!fullSale) return;

            const html = generateInvoiceHTML(fullSale, fullSale.customer || sale.customer);
            const result = await safePrint(html, {
                title: `فاتورة رقم ${fullSale.id}`
            });

            if (result?.error) {
                await safeAlert('خطأ في الطباعة: ' + result.error);
            }
        } finally {
            setBusySaleId(null);
        }
    }, [fetchSaleDetails]);

    const handleEditSale = useCallback(async (sale) => {
        setBusySaleId(sale.id);
        try {
            const fullSale = await fetchSaleDetails(sale.id);
            if (!fullSale) return;

            emitPosEditorRequest({
                type: 'sale',
                sale: fullSale,
                customer: fullSale.customer || sale.customer || null
            });
        } finally {
            setBusySaleId(null);
        }
    }, [fetchSaleDetails]);

    const handleDeleteSale = useCallback(async (sale) => {
        const confirmed = await safeConfirm(
            `هل أنت متأكد من حذف الفاتورة رقم ${sale.id}؟`,
            { title: 'تأكيد الحذف', detail: 'لا يمكن التراجع عن هذه العملية.' }
        );

        if (!confirmed) return;

        setBusySaleId(sale.id);
        try {
            const result = await window.api.deleteSale(sale.id);
            if (result?.error) {
                await safeAlert('فشل الحذف: ' + result.error);
                return;
            }

            if (sales.length === 1 && currentPage > 1) {
                setCurrentPage((prev) => Math.max(1, prev - 1));
            } else {
                await loadSales();
            }
        } catch (error) {
            console.error('Failed to delete sale:', error);
            await safeAlert('تعذر حذف الفاتورة');
        } finally {
            setBusySaleId(null);
        }
    }, [sales.length, currentPage, loadSales]);

    const tableRows = useMemo(() => (
        sales.map((sale) => {
            const isBusy = busySaleId === sale.id;
            const remainingAmount = Number(sale.remainingAmount || 0);
            const paidAmount = Number(sale.paidAmount || 0);

            return (
                <tr key={sale.id}>
                    <td>#{sale.id}</td>
                    <td>{formatDateTime(getSaleDate(sale))}</td>
                    <td>{sale.customer?.name || 'عميل نقدي'}</td>
                    <td>
                        <span className={`sales-sale-type ${remainingAmount > 0 ? 'is-credit' : 'is-cash'}`}>
                            {sale.saleType || (remainingAmount > 0 ? 'آجل' : 'نقدي')}
                        </span>
                    </td>
                    <td>{sale.payment || sale.paymentMethod?.name || '-'}</td>
                    <td className="sales-money sales-total">{formatMoney(sale.total)}</td>
                    <td className="sales-money sales-paid">{formatMoney(paidAmount)}</td>
                    <td className={`sales-money ${remainingAmount > 0 ? 'sales-remaining' : 'sales-cleared'}`}>
                        {formatMoney(remainingAmount)}
                    </td>
                    <td>{sale.itemsCount || 0}</td>
                    <td className="sales-notes-cell" title={sale.notes || '-'}>
                        {sale.notes || '-'}
                    </td>
                    <td>
                        <SaleActions
                            sale={sale}
                            isBusy={isBusy}
                            onView={handleOpenSaleDetails}
                            onEdit={handleEditSale}
                            onPrint={handlePrintSale}
                            onDelete={handleDeleteSale}
                        />
                    </td>
                </tr>
            );
        })
    ), [
        sales,
        busySaleId,
        handleOpenSaleDetails,
        handleEditSale,
        handlePrintSale,
        handleDeleteSale
    ]);

    const pageStart = totalItems === 0 ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1;
    const pageEnd = totalItems === 0 ? 0 : Math.min(totalItems, pageStart + sales.length - 1);

    return (
        <div className="sales-page">
            <div className="sales-table-card card">
                <div className="sales-table-scroll">
                    <table className="sales-table">
                        <thead>
                            <tr>
                                <th># الفاتورة</th>
                                <th>التاريخ</th>
                                <th>العميل</th>
                                <th>نوع البيع</th>
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
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className="sales-empty-state">
                                        جاري تحميل المبيعات...
                                    </td>
                                </tr>
                            ) : sales.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="sales-empty-state">
                                        لا توجد مبيعات
                                    </td>
                                </tr>
                            ) : tableRows}
                        </tbody>
                    </table>
                </div>

                <div className="sales-pagination">
                    <button
                        className="sales-btn sales-btn-light"
                        disabled={currentPage <= 1 || loading}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    >
                        السابق
                    </button>

                    <span>
                        {pageStart.toLocaleString('ar-EG')} - {pageEnd.toLocaleString('ar-EG')} من {totalItems.toLocaleString('ar-EG')}
                    </span>

                    <button
                        className="sales-btn sales-btn-light"
                        disabled={currentPage >= totalPages || loading}
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                        التالي
                    </button>
                </div>
            </div>

            <SaleDetailsModal
                sale={selectedSale}
                onClose={() => setSelectedSale(null)}
            />
        </div>
    );
}

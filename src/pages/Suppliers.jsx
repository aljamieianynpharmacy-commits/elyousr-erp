import React, { useCallback, useEffect, useMemo, useState } from "react";
import { safeAlert } from "../utils/safeAlert";
import { filterPosPaymentMethods } from "../utils/paymentMethodFilters";
import {
    Users, TrendingDown, TrendingUp, Scale, Search, RefreshCw, Download,
    Plus, FileText, DollarSign, Edit2, Trash2, X, Inbox, UserPlus, Truck
} from "lucide-react";
import SupplierLedger from "./SupplierLedger";
import "./Suppliers.css";

const today = () => new Date().toISOString().split("T")[0];
const toNumber = (value, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const formatMoney = (value) =>
    toNumber(value).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("ar-EG");
};

const initialSupplierForm = { name: "", phone: "", address: "", balance: "0" };

export default function Suppliers() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [paymentMethods, setPaymentMethods] = useState([]);

    const [searchTerm, setSearchTerm] = useState("");
    const [balanceFilter, setBalanceFilter] = useState("all");

    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [supplierForm, setSupplierForm] = useState(() => ({ ...initialSupplierForm }));

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [paymentSubmitting, setPaymentSubmitting] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        amount: "",
        paymentDate: today(),
        notes: "",
        paymentMethodId: "",
    });

    const [showLedger, setShowLedger] = useState(null);

    const defaultPaymentMethodId = useMemo(
        () => String(paymentMethods[0]?.id || ""),
        [paymentMethods]
    );

    const loadSuppliers = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            const result = await window.api.getSuppliers();
            if (result?.error) throw new Error(result.error);
            setSuppliers(Array.isArray(result) ? result : []);
        } catch (error) {
            console.error("Failed to load suppliers:", error);
            await safeAlert("فشل تحميل الموردين");
        } finally {
            if (showLoader) setLoading(false);
        }
    }, []);

    const loadPaymentMethods = useCallback(async () => {
        try {
            const result = await window.api.getPaymentMethods();
            setPaymentMethods(Array.isArray(result) ? filterPosPaymentMethods(result) : []);
        } catch (error) {
            console.error("Failed to load payment methods:", error);
            setPaymentMethods([]);
        }
    }, []);

    useEffect(() => {
        const load = async () => {
            await Promise.all([loadSuppliers(true), loadPaymentMethods()]);
        };
        load();
    }, [loadSuppliers, loadPaymentMethods]);

    const filteredSuppliers = useMemo(() => {
        const normalized = String(searchTerm || "").trim().toLowerCase();
        let list = suppliers;

        if (normalized) {
            list = list.filter((supplier) => {
                const name = String(supplier.name || "").toLowerCase();
                const phone = String(supplier.phone || "").toLowerCase();
                const address = String(supplier.address || "").toLowerCase();
                return name.includes(normalized) || phone.includes(normalized) || address.includes(normalized);
            });
        }

        if (balanceFilter === "debt") {
            list = list.filter((supplier) => toNumber(supplier.balance) < 0);
        } else if (balanceFilter === "credit") {
            list = list.filter((supplier) => toNumber(supplier.balance) > 0);
        } else if (balanceFilter === "settled") {
            list = list.filter((supplier) => Math.abs(toNumber(supplier.balance)) < 0.0001);
        }

        return [...list].sort((a, b) => (b.id || 0) - (a.id || 0));
    }, [balanceFilter, searchTerm, suppliers]);

    const stats = useMemo(() => {
        let debtCount = 0;
        let creditCount = 0;
        let settledCount = 0;
        let debtAmount = 0;
        let creditAmount = 0;
        let net = 0;

        for (const supplier of filteredSuppliers) {
            const balance = toNumber(supplier.balance);
            net += balance;
            if (balance < 0) {
                debtCount += 1;
                debtAmount += Math.abs(balance);
            } else if (balance > 0) {
                creditCount += 1;
                creditAmount += balance;
            } else {
                settledCount += 1;
            }
        }

        return { debtCount, creditCount, settledCount, debtAmount, creditAmount, net };
    }, [filteredSuppliers]);

    const selectedSupplierLive = useMemo(() => {
        if (!selectedSupplier) return null;
        return suppliers.find((item) => String(item.id) === String(selectedSupplier.id)) || selectedSupplier;
    }, [selectedSupplier, suppliers]);

    const paymentPreviewBalance = useMemo(
        () => toNumber(selectedSupplierLive?.balance) + Math.max(0, toNumber(paymentForm.amount)),
        [paymentForm.amount, selectedSupplierLive]
    );

    const openAddSupplierModal = () => {
        setEditingSupplier(null);
        setSupplierForm({ ...initialSupplierForm });
        setShowSupplierModal(true);
    };

    const openEditSupplierModal = (supplier) => {
        setEditingSupplier(supplier);
        setSupplierForm({
            name: supplier.name || "",
            phone: supplier.phone || "",
            address: supplier.address || "",
            balance: toNumber(supplier.balance).toFixed(2),
        });
        setShowSupplierModal(true);
    };

    const closeSupplierModal = () => {
        setShowSupplierModal(false);
        setEditingSupplier(null);
        setSupplierForm({ ...initialSupplierForm });
    };

    const saveSupplier = async () => {
        const supplierName = String(supplierForm.name || "").trim();
        if (!supplierName) {
            await safeAlert("اسم المورد مطلوب");
            return;
        }

        const payload = {
            name: supplierName,
            phone: String(supplierForm.phone || "").trim(),
            address: String(supplierForm.address || "").trim(),
        };
        const isEditMode = Boolean(editingSupplier);
        if (!isEditMode) payload.balance = toNumber(supplierForm.balance);

        try {
            const result = isEditMode
                ? await window.api.updateSupplier(editingSupplier.id, payload)
                : await window.api.addSupplier(payload);

            if (result?.error) {
                await safeAlert(`خطأ: ${result.error}`);
                return;
            }

            closeSupplierModal();
            await loadSuppliers(false);
        } catch (error) {
            console.error("Failed to save supplier:", error);
            await safeAlert("فشل حفظ بيانات المورد");
        }
    };

    const deleteSupplier = useCallback(async (supplierId) => {
        if (!window.confirm("هل أنت متأكد من حذف المورد؟")) return;
        try {
            const result = await window.api.deleteSupplier(supplierId);
            if (result?.error) {
                await safeAlert(`خطأ: ${result.error}`);
                return;
            }
            await loadSuppliers(false);
        } catch (error) {
            console.error("Failed to delete supplier:", error);
            await safeAlert("فشل حذف المورد");
        }
    }, [loadSuppliers]);

    const openPaymentModal = (supplier) => {
        setSelectedSupplier(supplier);
        setPaymentForm({
            amount: "",
            paymentDate: today(),
            notes: "",
            paymentMethodId: defaultPaymentMethodId,
        });
        setShowPaymentModal(true);
    };

    const closePaymentModal = () => {
        setShowPaymentModal(false);
        setSelectedSupplier(null);
    };

    const saveSupplierPayment = async () => {
        if (!selectedSupplierLive) return;

        const amount = Math.max(0, toNumber(paymentForm.amount));
        if (amount <= 0) {
            await safeAlert("الرجاء إدخال مبلغ سداد صحيح");
            return;
        }

        const confirmText = `سيتم تسجيل سداد بقيمة ${formatMoney(amount)} للمورد ${selectedSupplierLive.name}.\nالرصيد بعد السداد: ${formatMoney(paymentPreviewBalance)}\nهل تريد المتابعة؟`;
        if (!window.confirm(confirmText)) return;

        setPaymentSubmitting(true);
        try {
            const result = await window.api.addSupplierPayment({
                supplierId: selectedSupplierLive.id,
                amount,
                paymentDate: paymentForm.paymentDate || today(),
                notes: String(paymentForm.notes || "").trim(),
                paymentMethodId: parseInt(paymentForm.paymentMethodId, 10) || undefined,
            });

            if (result?.error) {
                await safeAlert(`خطأ: ${result.error}`);
                return;
            }

            closePaymentModal();
            await loadSuppliers(false);
        } catch (error) {
            console.error("Failed to save supplier payment:", error);
            await safeAlert("فشل تسجيل السداد");
        } finally {
            setPaymentSubmitting(false);
        }
    };

    const exportCsv = async () => {
        if (filteredSuppliers.length === 0) {
            await safeAlert("لا توجد بيانات للتصدير");
            return;
        }

        const escapeCsv = (value) => {
            const text = String(value ?? "");
            return text.includes(",") || text.includes("\"") || text.includes("\n")
                ? `"${text.replace(/"/g, "\"\"")}"`
                : text;
        };

        const header = ["#", "اسم المورد", "الهاتف", "العنوان", "الرصيد", "تاريخ التسجيل"];
        const rows = filteredSuppliers.map((supplier) => [
            supplier.id,
            supplier.name || "",
            supplier.phone || "",
            supplier.address || "",
            toNumber(supplier.balance).toFixed(2),
            formatDate(supplier.createdAt),
        ]);
        const content = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");

        const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `suppliers-${today()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="suppliers-loading">
                <div className="suppliers-loading-spinner" />
                جاري تحميل الموردين...
            </div>
        );
    }

    return (
        <div className="suppliers-page">
            {/* ─── Header ─── */}
            <div className="suppliers-header">
                <h1>
                    <span className="suppliers-header-icon">
                        <Truck size={20} />
                    </span>
                    إدارة الموردين
                </h1>
                <div className="suppliers-header-actions">
                    <button className="suppliers-btn suppliers-btn-secondary" onClick={() => loadSuppliers(true)}>
                        <RefreshCw size={15} />
                        تحديث
                    </button>
                    <button className="suppliers-btn suppliers-btn-secondary" onClick={exportCsv}>
                        <Download size={15} />
                        تصدير CSV
                    </button>
                    <button className="suppliers-btn suppliers-btn-primary" onClick={openAddSupplierModal}>
                        <Plus size={15} />
                        إضافة مورد
                    </button>
                </div>
            </div>

            {/* ─── Stats Cards ─── */}
            <div className="suppliers-stats">
                <div className="suppliers-stat-card">
                    <div className="suppliers-stat-icon is-total">
                        <Users size={22} />
                    </div>
                    <div className="suppliers-stat-info">
                        <span className="suppliers-stat-label">عدد الموردين</span>
                        <span className="suppliers-stat-value">{filteredSuppliers.length}</span>
                    </div>
                </div>
                <div className="suppliers-stat-card">
                    <div className="suppliers-stat-icon is-debt">
                        <TrendingDown size={22} />
                    </div>
                    <div className="suppliers-stat-info">
                        <span className="suppliers-stat-label">مستحقات علينا</span>
                        <span className="suppliers-stat-value is-debt">{formatMoney(stats.debtAmount)}</span>
                    </div>
                </div>
                <div className="suppliers-stat-card">
                    <div className="suppliers-stat-icon is-credit">
                        <TrendingUp size={22} />
                    </div>
                    <div className="suppliers-stat-info">
                        <span className="suppliers-stat-label">رصيد دائن للموردين</span>
                        <span className="suppliers-stat-value is-credit">{formatMoney(stats.creditAmount)}</span>
                    </div>
                </div>
                <div className="suppliers-stat-card">
                    <div className="suppliers-stat-icon is-net">
                        <Scale size={22} />
                    </div>
                    <div className="suppliers-stat-info">
                        <span className="suppliers-stat-label">صافي الرصيد</span>
                        <span className={`suppliers-stat-value ${stats.net < 0 ? "is-net-negative" : "is-net-positive"}`}>
                            {formatMoney(stats.net)}
                        </span>
                    </div>
                </div>
            </div>

            {/* ─── Search & Filter ─── */}
            <div className="suppliers-search-bar">
                <div className="suppliers-search-wrapper">
                    <Search size={18} className="suppliers-search-icon" />
                    <input
                        type="text"
                        placeholder="بحث بالاسم أو الهاتف أو العنوان..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select value={balanceFilter} onChange={(e) => setBalanceFilter(e.target.value)}>
                    <option value="all">كل الأرصدة</option>
                    <option value="debt">علينا مستحقات</option>
                    <option value="credit">له رصيد دائن</option>
                    <option value="settled">متزن</option>
                </select>
            </div>

            {/* ─── Table ─── */}
            <div className="suppliers-table-card">
                <div className="suppliers-table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>اسم المورد</th>
                                <th>الهاتف</th>
                                <th>العنوان</th>
                                <th>الرصيد</th>
                                <th>تاريخ التسجيل</th>
                                <th style={{ textAlign: "center" }}>العمليات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSuppliers.length === 0 ? (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="suppliers-empty">
                                            <Inbox size={40} className="suppliers-empty-icon" />
                                            <span className="suppliers-empty-text">لا توجد بيانات</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSuppliers.map((supplier) => {
                                    const balance = toNumber(supplier.balance);
                                    const balanceClass = balance < 0 ? "is-negative" : balance > 0 ? "is-positive" : "is-zero";
                                    return (
                                        <tr key={supplier.id}>
                                            <td>{supplier.id}</td>
                                            <td className="suppliers-name-cell">{supplier.name}</td>
                                            <td className="suppliers-muted-cell">{supplier.phone || "-"}</td>
                                            <td className="suppliers-muted-cell">{supplier.address || "-"}</td>
                                            <td className={`suppliers-balance-cell ${balanceClass}`}>
                                                {formatMoney(balance)}
                                            </td>
                                            <td className="suppliers-muted-cell">{formatDate(supplier.createdAt)}</td>
                                            <td className="suppliers-actions-cell">
                                                <div className="suppliers-actions-group">
                                                    <button
                                                        className="suppliers-action-btn is-ledger"
                                                        onClick={() => setShowLedger(supplier.id)}
                                                        title="كشف الحساب"
                                                    >
                                                        <FileText size={16} />
                                                    </button>
                                                    <button
                                                        className="suppliers-action-btn is-payment"
                                                        onClick={() => openPaymentModal(supplier)}
                                                        title="تسجيل سداد"
                                                    >
                                                        <DollarSign size={16} />
                                                    </button>
                                                    <button
                                                        className="suppliers-action-btn is-edit"
                                                        onClick={() => openEditSupplierModal(supplier)}
                                                        title="تعديل"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        className="suppliers-action-btn is-delete"
                                                        onClick={() => deleteSupplier(supplier.id)}
                                                        title="حذف"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Add/Edit Supplier Modal ─── */}
            {showSupplierModal && (
                <div className="suppliers-modal-overlay" onClick={closeSupplierModal}>
                    <div className="suppliers-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="suppliers-modal-header">
                            <h3>
                                <span className="suppliers-modal-header-icon is-supplier">
                                    {editingSupplier ? <Edit2 size={16} /> : <UserPlus size={16} />}
                                </span>
                                {editingSupplier ? "تعديل المورد" : "إضافة مورد جديد"}
                            </h3>
                            <button className="suppliers-modal-close" onClick={closeSupplierModal}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="suppliers-modal-body">
                            <div className="suppliers-form-group">
                                <label>اسم المورد</label>
                                <input
                                    type="text"
                                    placeholder="أدخل اسم المورد"
                                    value={supplierForm.name}
                                    onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                            <div className="suppliers-form-group">
                                <label>الهاتف</label>
                                <input
                                    type="text"
                                    placeholder="رقم الهاتف"
                                    value={supplierForm.phone}
                                    onChange={(e) => setSupplierForm((prev) => ({ ...prev, phone: e.target.value }))}
                                />
                            </div>
                            <div className="suppliers-form-group">
                                <label>العنوان</label>
                                <input
                                    type="text"
                                    placeholder="عنوان المورد"
                                    value={supplierForm.address}
                                    onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))}
                                />
                            </div>
                            {!editingSupplier && (
                                <div className="suppliers-form-group">
                                    <label>الرصيد الافتتاحي</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={supplierForm.balance}
                                        onChange={(e) => setSupplierForm((prev) => ({ ...prev, balance: e.target.value }))}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="suppliers-modal-footer">
                            <button className="suppliers-btn suppliers-btn-primary" onClick={saveSupplier}>
                                حفظ
                            </button>
                            <button className="suppliers-btn suppliers-btn-secondary" onClick={closeSupplierModal}>
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Payment Modal ─── */}
            {showPaymentModal && selectedSupplierLive && (
                <div className="suppliers-modal-overlay" onClick={closePaymentModal}>
                    <div className="suppliers-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="suppliers-modal-header">
                            <h3>
                                <span className="suppliers-modal-header-icon is-payment">
                                    <DollarSign size={16} />
                                </span>
                                تسجيل سداد مورد
                            </h3>
                            <button className="suppliers-modal-close" onClick={closePaymentModal}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="suppliers-modal-body">
                            <div className="suppliers-payment-info">
                                <div className="suppliers-payment-info-row">
                                    <span className="label">المورد</span>
                                    <span className="value">{selectedSupplierLive.name}</span>
                                </div>
                                <div className="suppliers-payment-info-row">
                                    <span className="label">الرصيد الحالي</span>
                                    <span className="value">{formatMoney(selectedSupplierLive.balance)}</span>
                                </div>
                            </div>
                            <div className="suppliers-form-group">
                                <label>مبلغ السداد</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                                />
                            </div>
                            <div className="suppliers-form-group">
                                <label>تاريخ السداد</label>
                                <input
                                    type="date"
                                    value={paymentForm.paymentDate}
                                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                                />
                            </div>
                            <div className="suppliers-form-group">
                                <label>طريقة الدفع</label>
                                <select
                                    value={paymentForm.paymentMethodId}
                                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentMethodId: e.target.value }))}
                                >
                                    {paymentMethods.length > 0 ? (
                                        paymentMethods.map((method) => (
                                            <option key={method.id} value={String(method.id)}>
                                                {method.name}
                                            </option>
                                        ))
                                    ) : (
                                        <option value="">طريقة افتراضية</option>
                                    )}
                                </select>
                            </div>
                            <div className="suppliers-form-group">
                                <label>ملاحظات</label>
                                <textarea
                                    rows={3}
                                    placeholder="أضف ملاحظات (اختياري)"
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>
                            <div className="suppliers-payment-preview">
                                <span className="label">الرصيد بعد السداد</span>
                                <span className="value">{formatMoney(paymentPreviewBalance)}</span>
                            </div>
                        </div>
                        <div className="suppliers-modal-footer">
                            <button
                                className="suppliers-btn suppliers-btn-primary"
                                onClick={saveSupplierPayment}
                                disabled={paymentSubmitting}
                            >
                                {paymentSubmitting ? "جاري الحفظ..." : "حفظ السداد"}
                            </button>
                            <button
                                className="suppliers-btn suppliers-btn-secondary"
                                onClick={closePaymentModal}
                                disabled={paymentSubmitting}
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Ledger ─── */}
            {showLedger && (
                <SupplierLedger
                    supplierId={showLedger}
                    onClose={() => setShowLedger(null)}
                />
            )}
        </div>
    );
}

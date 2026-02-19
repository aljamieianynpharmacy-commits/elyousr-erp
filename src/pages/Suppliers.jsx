import React, { useCallback, useEffect, useMemo, useState } from "react";
import { safeAlert } from "../utils/safeAlert";
import { filterPosPaymentMethods } from "../utils/paymentMethodFilters";
import SupplierLedger from "./SupplierLedger";

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

    if (loading) return <div className="card">جاري تحميل الموردين...</div>;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <h1 style={{ margin: 0 }}>إدارة الموردين</h1>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button onClick={() => loadSuppliers(true)}>تحديث</button>
                    <button onClick={exportCsv}>تصدير CSV</button>
                    <button onClick={openAddSupplierModal}>+ إضافة مورد</button>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: "8px" }}>
                    <input
                        type="text"
                        placeholder="بحث بالاسم أو الهاتف أو العنوان..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                    <select value={balanceFilter} onChange={(event) => setBalanceFilter(event.target.value)}>
                        <option value="all">كل الأرصدة</option>
                        <option value="debt">علينا مستحقات</option>
                        <option value="credit">له رصيد دائن</option>
                        <option value="settled">متزن</option>
                    </select>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px" }}>
                <div className="card" style={{ marginBottom: 0, padding: "12px" }}>
                    <div>عدد الموردين</div>
                    <strong>{filteredSuppliers.length}</strong>
                </div>
                <div className="card" style={{ marginBottom: 0, padding: "12px" }}>
                    <div>مستحقات علينا</div>
                    <strong style={{ color: "#dc2626" }}>{formatMoney(stats.debtAmount)}</strong>
                </div>
                <div className="card" style={{ marginBottom: 0, padding: "12px" }}>
                    <div>رصيد دائن للموردين</div>
                    <strong style={{ color: "#0ea5e9" }}>{formatMoney(stats.creditAmount)}</strong>
                </div>
                <div className="card" style={{ marginBottom: 0, padding: "12px" }}>
                    <div>صافي الرصيد</div>
                    <strong style={{ color: stats.net < 0 ? "#dc2626" : "#16a34a" }}>{formatMoney(stats.net)}</strong>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ minWidth: "880px" }}>
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
                                    <td colSpan={7} style={{ textAlign: "center", padding: "18px" }}>
                                        لا توجد بيانات
                                    </td>
                                </tr>
                            ) : (
                                filteredSuppliers.map((supplier) => {
                                    const balance = toNumber(supplier.balance);
                                    return (
                                        <tr key={supplier.id}>
                                            <td>{supplier.id}</td>
                                            <td style={{ fontWeight: "bold" }}>{supplier.name}</td>
                                            <td>{supplier.phone || "-"}</td>
                                            <td>{supplier.address || "-"}</td>
                                            <td style={{ color: balance < 0 ? "#dc2626" : balance > 0 ? "#0284c7" : "#16a34a", fontWeight: "bold" }}>
                                                {formatMoney(balance)}
                                            </td>
                                            <td>{formatDate(supplier.createdAt)}</td>
                                            <td style={{ textAlign: "center" }}>
                                                <div style={{ display: "inline-flex", gap: "6px" }}>
                                                    <button onClick={() => setShowLedger(supplier.id)}>كشف</button>
                                                    <button onClick={() => openPaymentModal(supplier)}>سداد</button>
                                                    <button onClick={() => openEditSupplierModal(supplier)}>تعديل</button>
                                                    <button onClick={() => deleteSupplier(supplier.id)} style={{ color: "#dc2626" }}>حذف</button>
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

            {showSupplierModal && (
                <div className="modal-overlay" onClick={closeSupplierModal}>
                    <div className="modal-content" onClick={(event) => event.stopPropagation()}>
                        <h3>{editingSupplier ? "تعديل المورد" : "إضافة مورد"}</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <input
                                type="text"
                                placeholder="اسم المورد"
                                value={supplierForm.name}
                                onChange={(event) => setSupplierForm((prev) => ({ ...prev, name: event.target.value }))}
                            />
                            <input
                                type="text"
                                placeholder="الهاتف"
                                value={supplierForm.phone}
                                onChange={(event) => setSupplierForm((prev) => ({ ...prev, phone: event.target.value }))}
                            />
                            <input
                                type="text"
                                placeholder="العنوان"
                                value={supplierForm.address}
                                onChange={(event) => setSupplierForm((prev) => ({ ...prev, address: event.target.value }))}
                            />
                            {!editingSupplier && (
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="الرصيد الافتتاحي"
                                    value={supplierForm.balance}
                                    onChange={(event) => setSupplierForm((prev) => ({ ...prev, balance: event.target.value }))}
                                />
                            )}
                        </div>
                        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                            <button onClick={saveSupplier} style={{ flex: 1 }}>حفظ</button>
                            <button onClick={closeSupplierModal} style={{ flex: 1 }}>إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {showPaymentModal && selectedSupplierLive && (
                <div className="modal-overlay" onClick={closePaymentModal}>
                    <div className="modal-content" onClick={(event) => event.stopPropagation()}>
                        <h3>تسجيل سداد مورد</h3>
                        <div style={{ marginBottom: "8px" }}>
                            <div>المورد: <strong>{selectedSupplierLive.name}</strong></div>
                            <div>الرصيد الحالي: <strong>{formatMoney(selectedSupplierLive.balance)}</strong></div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="مبلغ السداد"
                                value={paymentForm.amount}
                                onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))}
                            />
                            <input
                                type="date"
                                value={paymentForm.paymentDate}
                                onChange={(event) => setPaymentForm((prev) => ({ ...prev, paymentDate: event.target.value }))}
                            />
                            <select
                                value={paymentForm.paymentMethodId}
                                onChange={(event) => setPaymentForm((prev) => ({ ...prev, paymentMethodId: event.target.value }))}
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
                            <textarea
                                rows={3}
                                placeholder="ملاحظات"
                                value={paymentForm.notes}
                                onChange={(event) => setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))}
                            />
                        </div>
                        <div style={{ marginTop: "10px", fontWeight: "bold", color: "#16a34a" }}>
                            الرصيد بعد السداد: {formatMoney(paymentPreviewBalance)}
                        </div>
                        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                            <button onClick={saveSupplierPayment} disabled={paymentSubmitting} style={{ flex: 1 }}>
                                {paymentSubmitting ? "جاري الحفظ..." : "حفظ السداد"}
                            </button>
                            <button onClick={closePaymentModal} disabled={paymentSubmitting} style={{ flex: 1 }}>
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showLedger && (
                <SupplierLedger
                    supplierId={showLedger}
                    onClose={() => setShowLedger(null)}
                />
            )}
        </div>
    );
}

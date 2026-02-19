import React, { useEffect, useMemo, useState } from "react";

const toNumber = (value, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const formatMoney = (value) =>
    toNumber(value).toLocaleString("ar-EG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const formatDateTime = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return "-";
    return parsed.toLocaleString("ar-EG", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export default function SupplierLedger({ supplierId, onClose }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [supplier, setSupplier] = useState(null);
    const [purchases, setPurchases] = useState([]);
    const [payments, setPayments] = useState([]);

    useEffect(() => {
        let active = true;

        const load = async () => {
            if (!supplierId) {
                setError("المورد غير محدد");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError("");
            try {
                const [suppliersData, purchasesData, paymentsData] = await Promise.all([
                    window.api.getSuppliers(),
                    window.api.getPurchases(),
                    window.api.getSupplierPayments(supplierId),
                ]);

                if (!active) return;

                if (suppliersData?.error) {
                    throw new Error(suppliersData.error);
                }
                if (purchasesData?.error) {
                    throw new Error(purchasesData.error);
                }
                if (paymentsData?.error) {
                    throw new Error(paymentsData.error);
                }

                const suppliersList = Array.isArray(suppliersData) ? suppliersData : [];
                const purchasesList = Array.isArray(purchasesData) ? purchasesData : [];
                const paymentsList = Array.isArray(paymentsData) ? paymentsData : [];

                setSupplier(
                    suppliersList.find((item) => String(item.id) === String(supplierId)) || null
                );
                setPurchases(
                    purchasesList.filter((item) => String(item.supplierId) === String(supplierId))
                );
                setPayments(paymentsList);
            } catch (err) {
                if (!active) return;
                setError(err?.message || "فشل تحميل كشف حساب المورد");
            } finally {
                if (active) setLoading(false);
            }
        };

        load();
        return () => {
            active = false;
        };
    }, [supplierId]);

    const summary = useMemo(() => {
        const totalPurchases = purchases.reduce((sum, item) => sum + toNumber(item.total), 0);
        const paidInPurchases = purchases.reduce((sum, item) => sum + toNumber(item.paid), 0);
        const directPayments = payments.reduce((sum, item) => sum + toNumber(item.amount), 0);
        const outstanding = Math.max(0, totalPurchases - paidInPurchases - directPayments);

        return {
            totalPurchases,
            paidInPurchases,
            directPayments,
            outstanding,
        };
    }, [purchases, payments]);

    const transactions = useMemo(() => {
        const rows = [];

        for (const purchase of purchases) {
            const total = toNumber(purchase.total);
            const paid = toNumber(purchase.paid);
            const remaining = Math.max(0, total - paid);

            rows.push({
                id: `purchase-${purchase.id}`,
                type: "purchase",
                date: purchase.createdAt,
                label: `فاتورة مشتريات #${purchase.id}`,
                note: purchase.notes || "",
                total,
                paid,
                remaining,
                effect: -remaining,
            });
        }

        for (const payment of payments) {
            const amount = toNumber(payment.amount);
            rows.push({
                id: `payment-${payment.id}`,
                type: "payment",
                date: payment.createdAt,
                label: `سداد مورد #${payment.id}`,
                note: payment.notes || "",
                total: 0,
                paid: amount,
                remaining: 0,
                effect: amount,
            });
        }

        rows.sort((a, b) => {
            const aTime = new Date(a.date).getTime() || 0;
            const bTime = new Date(b.date).getTime() || 0;
            if (aTime !== bTime) return aTime - bTime;
            return String(a.id).localeCompare(String(b.id));
        });

        let running = 0;
        return rows.map((row) => {
            running += toNumber(row.effect);
            return {
                ...row,
                runningBalance: running,
            };
        });
    }, [payments, purchases]);

    const cardStyle = {
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "12px",
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(15, 23, 42, 0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2100,
                padding: "20px",
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                style={{
                    width: "100%",
                    maxWidth: "1100px",
                    maxHeight: "90vh",
                    overflow: "auto",
                    background: "white",
                    borderRadius: "14px",
                    boxShadow: "0 24px 40px rgba(2, 6, 23, 0.25)",
                    padding: "18px",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "14px",
                        gap: "12px",
                    }}
                >
                    <div>
                        <h3 style={{ margin: 0, color: "#0f172a" }}>كشف حساب المورد</h3>
                        <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                            {supplier?.name || "مورد غير معروف"}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            onClick={() => window.print()}
                            style={{
                                border: "none",
                                background: "#2563eb",
                                color: "white",
                                borderRadius: "8px",
                                padding: "8px 12px",
                                cursor: "pointer",
                                fontWeight: "bold",
                            }}
                        >
                            طباعة
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                border: "1px solid #cbd5e1",
                                background: "white",
                                color: "#334155",
                                borderRadius: "8px",
                                padding: "8px 12px",
                                cursor: "pointer",
                            }}
                        >
                            إغلاق
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                        جاري تحميل كشف الحساب...
                    </div>
                ) : error ? (
                    <div
                        style={{
                            padding: "14px",
                            borderRadius: "10px",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            color: "#991b1b",
                        }}
                    >
                        {error}
                    </div>
                ) : (
                    <>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                gap: "10px",
                                marginBottom: "14px",
                            }}
                        >
                            <div style={cardStyle}>
                                <div style={{ fontSize: "12px", color: "#64748b" }}>إجمالي المشتريات</div>
                                <div style={{ fontWeight: "bold", color: "#0f172a", marginTop: "4px" }}>
                                    {formatMoney(summary.totalPurchases)}
                                </div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ fontSize: "12px", color: "#64748b" }}>المدفوع داخل الفواتير</div>
                                <div style={{ fontWeight: "bold", color: "#166534", marginTop: "4px" }}>
                                    {formatMoney(summary.paidInPurchases)}
                                </div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ fontSize: "12px", color: "#64748b" }}>سداد منفصل</div>
                                <div style={{ fontWeight: "bold", color: "#166534", marginTop: "4px" }}>
                                    {formatMoney(summary.directPayments)}
                                </div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ fontSize: "12px", color: "#64748b" }}>متبقي تقديري</div>
                                <div style={{ fontWeight: "bold", color: "#b91c1c", marginTop: "4px" }}>
                                    {formatMoney(summary.outstanding)}
                                </div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ fontSize: "12px", color: "#64748b" }}>رصيد المورد الحالي</div>
                                <div
                                    style={{
                                        fontWeight: "bold",
                                        color: toNumber(supplier?.balance) < 0 ? "#b91c1c" : "#0f766e",
                                        marginTop: "4px",
                                    }}
                                >
                                    {formatMoney(supplier?.balance)}
                                </div>
                            </div>
                        </div>

                        <div
                            style={{
                                border: "1px solid #e2e8f0",
                                borderRadius: "10px",
                                overflow: "hidden",
                            }}
                        >
                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                                <thead style={{ background: "#f8fafc" }}>
                                    <tr>
                                        <th style={{ padding: "10px", textAlign: "right" }}>التاريخ</th>
                                        <th style={{ padding: "10px", textAlign: "right" }}>النوع</th>
                                        <th style={{ padding: "10px", textAlign: "right" }}>البيان</th>
                                        <th style={{ padding: "10px", textAlign: "right" }}>الإجمالي</th>
                                        <th style={{ padding: "10px", textAlign: "right" }}>المدفوع</th>
                                        <th style={{ padding: "10px", textAlign: "right" }}>المتبقي</th>
                                        <th style={{ padding: "10px", textAlign: "right" }}>تأثير الحركة</th>
                                        <th style={{ padding: "10px", textAlign: "right" }}>الرصيد التراكمي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={8}
                                                style={{
                                                    padding: "16px",
                                                    textAlign: "center",
                                                    color: "#64748b",
                                                }}
                                            >
                                                لا توجد حركات لهذا المورد
                                            </td>
                                        </tr>
                                    ) : (
                                        transactions.map((row) => (
                                            <tr key={row.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                                                <td style={{ padding: "10px" }}>{formatDateTime(row.date)}</td>
                                                <td style={{ padding: "10px" }}>
                                                    {row.type === "purchase" ? "مشتريات" : "سداد"}
                                                </td>
                                                <td style={{ padding: "10px" }}>
                                                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{row.label}</div>
                                                    {row.note ? (
                                                        <div style={{ fontSize: "12px", color: "#64748b" }}>{row.note}</div>
                                                    ) : null}
                                                </td>
                                                <td style={{ padding: "10px" }}>{formatMoney(row.total)}</td>
                                                <td style={{ padding: "10px" }}>{formatMoney(row.paid)}</td>
                                                <td style={{ padding: "10px" }}>{formatMoney(row.remaining)}</td>
                                                <td
                                                    style={{
                                                        padding: "10px",
                                                        color: row.effect < 0 ? "#b91c1c" : "#166534",
                                                        fontWeight: "bold",
                                                    }}
                                                >
                                                    {row.effect < 0 ? "-" : "+"}
                                                    {formatMoney(Math.abs(row.effect))}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "10px",
                                                        color: row.runningBalance < 0 ? "#b91c1c" : "#0f766e",
                                                        fontWeight: "bold",
                                                    }}
                                                >
                                                    {formatMoney(row.runningBalance)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// موديل اذن استلام نقديه
import React, {
    useRef,
    useEffect,
    useState,
    useMemo,
    useCallback,
} from "react";
import { X, Printer, Save, FileText } from "lucide-react";

// ثابت (عدم إعادة إنشاء المصفوفة في كل رندر)
const DEFAULT_PAYMENT_METHODS = [
    { id: 1, name: "كاش", code: "cash" },
    { id: 2, name: "فودافون كاش", code: "vodafone" },
    { id: 3, name: "انستابي", code: "instapay" },
];

export default function PaymentModal({
    isOpen,
    selectedCustomer,
    paymentData,
    onSubmit,
    onClose,
    isSubmitting,
    formatCurrency,
    paymentMethods = DEFAULT_PAYMENT_METHODS,
}) {
    /* =======================
       Hooks (ثابتة دائمًا)
    ======================= */
    const amountRef = useRef(null);

    const [amount, setAmount] = useState("");
    const [date, setDate] = useState("");
    const [notes, setNotes] = useState("");
    const [alert, setAlert] = useState({ message: "", type: "info" }); // unified alert box
    // keep paymentMethod as string to match option values and avoid unnecessary resets
    const [paymentMethod, setPaymentMethod] = useState(String(paymentMethods[0]?.id || ""));

    useEffect(() => {
        if (isOpen) {
            setAmount(paymentData.amount || "");
            // ensure date is formatted as YYYY-MM-DD for <input type="date">
            const formatDateForInput = (d) => {
                if (!d) return "";
                const dt = new Date(d);
                if (isNaN(dt)) return "";
                return dt.toISOString().slice(0, 10);
            };

            setDate(formatDateForInput(paymentData.paymentDate) || "");
            setNotes(paymentData.notes || "");
            setPaymentMethod(String(paymentData.paymentMethodId || paymentMethods[0]?.id || ""));
            setTimeout(() => {
                amountRef.current?.focus();
                amountRef.current?.select();
            }, 50);
        }
    }, [isOpen, paymentData, paymentMethods]);

    const amountNumber = parseFloat(amount) || 0;

    const newBalance = useMemo(() => {
        if (!selectedCustomer) return 0;
        return Number(selectedCustomer.balance) - amountNumber;
    }, [amountNumber, selectedCustomer]);

    // تنسيق الرقم بدون رمز العملة، وإظهار الكسور فقط عند الحاجة
    const formatPlainNumber = (val) => {
        const n = Number(val) || 0;
        const abs = Math.abs(n);
        const hasDecimals = Math.abs(Math.round((abs - Math.floor(abs)) * 100)) > 0;
        const opts = { minimumFractionDigits: hasDecimals ? 2 : 0, maximumFractionDigits: 2 };
        // استخدم toLocaleString لعرض الفواصل آلاف بحسب locale بدون عملة
        return (n).toLocaleString(undefined, opts);
    };

    const balanceColor = newBalance > 0 ? "#dc2626" : newBalance === 0 ? "#059669" : "#2563eb";

    const submitAndMaybePrint = useCallback(
        async (withPrint = false) => {
            if (isSubmitting) return;

            if (!amount || !date || !paymentMethod) {
                setAlert({ message: "المبلغ، التاريخ وطريقة الدفع مطلوبة.", type: "error" });
                return;
            }

            // clear previous alerts
            setAlert({ message: "", type: "info" });

            // call parent submit and capture result
            const result = await onSubmit({
                ...paymentData,
                amount,
                paymentDate: date,
                // ensure we send a number id
                paymentMethodId: parseInt(paymentMethod, 10) || 1,
                notes,
            });

            // if error returned from parent, show error alert
            if (result && result.error) {
                setAlert({ message: result.error || 'فشل في التسجيل', type: 'error' });
                return;
            }

            // print if requested
            if (withPrint) {
                // allow print dialog to open
                await new Promise((res) => {
                    setTimeout(() => {
                        window.print();
                        // small delay to allow print to start
                        setTimeout(res, 500);
                    }, 200);
                });
            }

            // close modal immediately after successful save
            onClose && onClose();
        },
        [amount, date, paymentMethod, notes, isSubmitting, onSubmit, paymentData]
    );

    useEffect(() => {
        const handler = (e) => {
            if (!isOpen || isSubmitting) return;

            if (e.key === "F1") {
                e.preventDefault();
                submitAndMaybePrint(false);
            } else if (e.key === "F2" || e.key === "Enter") {
                e.preventDefault();
                submitAndMaybePrint(true);
            } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, isSubmitting, submitAndMaybePrint, onClose]);

    // auto-dismiss alert after 4 seconds
    useEffect(() => {
        if (!alert.message) return;
        const t = setTimeout(() => setAlert({ message: "", type: "info" }), 3000);
        return () => clearTimeout(t);
    }, [alert]);

    /* =======================
       ✅ return بعد كل Hooks
    ======================= */
    if (!isOpen || !selectedCustomer) return null;

    /* =======================
       Styles
    ======================= */
    const styles = {
        overlay: {
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
        },
        modal: {
            background: "#fff",
            width: "100%",
            maxWidth: 480,
            borderRadius: 12,
            boxShadow: "0 20px 25px rgba(0,0,0,.2)",
            overflow: "hidden",
        },
        header: {
            padding: "16px 20px",
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#fcfcfc",
        },
        label: { fontSize: 13, fontWeight: 600, marginBottom: 6 },
        input: {
            width: "100%",
            padding: "10px 12px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            outline: "none", 
            boxShadow: "none",
            fontSize: 14,
        },
        amountInput: {
            fontSize: 22,
            fontWeight: "bold",
            textAlign: "center",
            border: "2px solid #10b981",
            outline: "none",
            color: "#059669",
        },
        btnPrimary: {
            flex: 1,
            background: "#10b981",
            color: "#fff",
            border: "none",
            padding: 12,
            borderRadius: 6,
            fontWeight: "bold",
            cursor: "pointer",
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
        },
        btnSecondary: {
            flex: 1,
            background: "#6366f1",
            color: "#fff",
            border: "none",
            padding: 12,
            borderRadius: 6,
            fontWeight: "bold",
            cursor: "pointer",
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
        },
        alertBase: {
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
        },
        alertInfo: {
            background: '#eef2ff',
            border: '1px solid #c7d2fe',
            color: '#1e293b'
        },
        alertError: {
            background: '#fff1f2',
            border: '1px solid #fecaca',
            color: '#7f1d1d'
        },
        alertSuccess: {
            background: '#ecfdf5',
            border: '1px solid #bbf7d0',
            color: '#065f46'
        },
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <h3 style={{ margin: 0, display: "flex", gap: 8 }}>
                        <FileText size={20} color="#10b981" />
                        تسجيل مستند قبض
                    </h3>
                    <button onClick={onClose} style={{ background: "none", border: 0 }}>
                        <X size={20} color="#999" />
                    </button>
                </div>

                <div style={{ padding: 20 }}>
                    {/* Customer */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                            background: "#f0f7ff",
                            padding: 14,
                            borderRadius: 8,
                            marginBottom: 18,
                        }}
                    >
                        <div>
                            <div style={{ fontSize: 11, color: "#666" }}>العميل</div>
                            <strong style={{ display: 'block', fontSize: 16, color: '#111' }}>{selectedCustomer.name}</strong>
                        </div>
                        <div style={{ textAlign: "left" }}>
                            <div style={{ fontSize: 11, color: "#666" }}>الرصيد السابق</div>
                            <strong style={{ display: 'block', fontSize: 16, color: (Number(selectedCustomer.balance) > 0 ? '#dc2626' : Number(selectedCustomer.balance) === 0 ? '#059669' : '#2563eb') }}>
                                {formatPlainNumber(selectedCustomer.balance)}
                            </strong>
                        </div>
                    </div>

                    {/* Amount (label beside input) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                        <div style={{ minWidth: 120 }}>
                            <div style={{ ...styles.label, marginBottom: 0 }}>المبلغ المستلم *</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <input
                                ref={amountRef}
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                style={{ ...styles.input, ...styles.amountInput }}
                            />
                        </div>
                    </div>

                    {/* Payment Method & Date */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        
                            <div style={{ flex: 1 }}>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    style={{
                                        ...styles.input,
                                        fontSize: 14,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {paymentMethods.map((method) => (
                                        <option key={method.id} value={String(method.id)}>
                                            {method.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  
                            <div style={{ flex: 1 }}>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    style={styles.input}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <label style={{ ...styles.label, marginTop: 14 }}>ملاحظات</label>
                    <textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        style={{ ...styles.input, resize: "none" }}
                    />

                    {/* Balance After */}
                    <div style={{ marginTop: 14, padding: 12, background: "#f0f7ff", borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>الرصيد الحالي</div>
                        <div
                            style={{
                                fontSize: 18,
                                fontWeight: "bold",
                                color: balanceColor,
                            }}
                        >
                            {formatPlainNumber(newBalance)}
                        </div>
                    </div>

                    {/* Unified alert (validation / info / shortcuts) */}
                    <div style={{ marginTop: 14 }}>
                        {alert.message ? (
                            <div
                                style={{
                                    ...styles.alertBase,
                                    ...(alert.type === 'error' ? styles.alertError : alert.type === 'success' ? styles.alertSuccess : styles.alertInfo)
                                }}
                            >
                                <div style={{ fontWeight: 700 }}>{alert.type === 'error' ? 'خطأ' : alert.type === 'success' ? 'تم' : 'معلومة'}</div>
                                <div style={{ flex: 1 }}>{alert.message}</div>
                            </div>
                        ) : (
                            <div style={{ ...styles.alertBase, ...styles.alertInfo }}>
                                <div style={{ fontWeight: 700 }}>اختصارات</div>
                                <div style={{ flex: 1 }}>F1: حفظ • Enter / F2: حفظ وطباعة • ESC: خروج</div>
                            </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                            <button onClick={() => submitAndMaybePrint(false)} style={styles.btnPrimary}>
                                <Save size={18} /> حفظ (F1)
                            </button>
                            <button onClick={() => submitAndMaybePrint(true)} style={styles.btnSecondary}>
                                <Printer size={18} /> حفظ وطباعة (Enter / F2)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

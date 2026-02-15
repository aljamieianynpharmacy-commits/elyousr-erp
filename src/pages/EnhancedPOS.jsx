import React, { useState, useEffect, useRef, useMemo } from "react";
import CustomerLedger from "./CustomerLedger";
import InvoicePreview from "./InvoicePreview";
import VariantModal from "../components/VariantModal";
import NewCustomerModal from "../components/NewCustomerModal";

/**
 * Toast Notification Component
 * عرض إشعارات مؤقتة في الزاوية السفلى اليسرى
 * 4 أنواع: success, error, warning, info
 */
const Toast = ({ message, type = "info", onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 2000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColor = {
        success: "#10b981",
        error: "#ef4444",
        warning: "#f59e0b",
        info: "#3b82f6",
    }[type];

    const icon = {
        success: "✅",
        error: "❌",
        warning: "⚠️",
        info: "ℹ️",
    }[type];

    return (
        <div
            style={{
                position: "fixed",
                bottom: "20px",
                left: "20px",
                backgroundColor: bgColor,
                color: "white",
                padding: "15px 20px",
                borderRadius: "8px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                gap: "10px",
                animation: "slideIn 0.3s ease-out",
                maxWidth: "400px",
                fontSize: "14px",
            }}
        >
            <span style={{ fontSize: "20px" }}>{icon}</span>
            <span>{message}</span>
        </div>
    );
};

/**
 * ============================================
 * Custom Hooks - خطاطيف مخصصة
 * ============================================
 */

/**
 * Hook لحساب إجمالي الفاتورة
 * يحسب: المجموع، الخصم، المتبقي، المدفوع، والربح
 */
const useInvoiceCalculations = (invoice) => {
    return useMemo(() => {
        const subTotal = invoice.cart.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
        );
        const totalDiscount = invoice.cart.reduce(
            (sum, item) => sum + item.discount * item.quantity,
            0,
        );
        const totalCost = invoice.cart.reduce(
            (sum, item) => sum + (item.costPrice || 0) * item.quantity,
            0,
        );
        let billDiscount = parseFloat(invoice.discount) || 0;
        // حساب الخصم بالنسبة المئوية إذا كان محددًا
        if (invoice.discountType === "percent") {
            billDiscount = ((subTotal - totalDiscount) * billDiscount) / 100;
        }

        const total = Math.max(
            0,
            subTotal - totalDiscount - billDiscount,
        );
        const paid = parseFloat(invoice.paidAmount) || 0;
        const remaining = total - paid;
        const profit = Math.max(0, total - totalCost);

        return { subTotal, totalDiscount, total, paid, remaining, totalCost, profit, billDiscount };
    }, [invoice.cart, invoice.discount, invoice.discountType, invoice.paidAmount]);
};

/**
 * ============================================
 * Utility Functions - دوال مساعدة
 * ============================================
 */

/**
 * تشغيل صوت تنبيه للعمليات الناجحة
 */
const playSound = (soundType) => {
    try {
        if (soundType === "save") {
            const audioContext = new (
                window.AudioContext || window.webkitAudioContext
            )();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.type = "sine";

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(
                0.01,
                audioContext.currentTime + 0.3,
            );

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        }
    } catch (error) {
        console.log("Sound not available");
    }
};

/**
 * توليد معرّف فريد للفاتورة
 */
const generateInvoiceId = () => `INV-${Date.now().toString().slice(-6)}`;

/**
 * ============================================
 * Sub Components - المكونات الفرعية
 * ============================================
 */

/**
 * عنصان تبويب الفاتورة
 * يعرض اسم العميل أو رقم الفاتورة
 */
const InvoiceTab = ({ invoice, isActive, onSelect, onClose, canClose }) => (
    <div
        onClick={onSelect}
        style={{
            padding: "8px 15px",
            backgroundColor: isActive ? "#2563eb" : "#e5e7eb",
            color: isActive ? "white" : "#374151",
            borderRadius: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: "120px",
            justifyContent: "space-between",
            boxShadow: isActive ? "0 4px 6px -1px rgba(37, 99, 235, 0.3)" : "none",
            transition: "all 0.2s",
        }}
    >
        <span>
            {invoice.customer ? `👤 ${invoice.customer.name}` : `🧾 ${invoice.id}`}
        </span>
        {canClose && (
            <span
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                style={{ fontSize: "18px", lineHeight: "1", opacity: 0.7 }}
            >
                ×
            </span>
        )}
    </div>
);

/**
 * بطاقة المنتج
 * تعرض: الاسم، السعر، المخزون المتاح
 */
const ProductCard = ({ product, onClick }) => (
    <div
        onClick={onClick}
        style={{
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            padding: "12px",
            cursor: "pointer",
            textAlign: "center",
            backgroundColor: "white",
            transition: "all 0.2s",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            position: "relative",
            overflow: "hidden",
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.1)";
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
        }}
    >
        <div
            style={{
                fontWeight: "bold",
                marginBottom: "5px",
                fontSize: "14px",
                color: "#1f2937",
            }}
        >
            {product.name}
        </div>
        <div
            style={{
                color: "#059669",
                fontWeight: "bold",
                fontSize: "15px",
                marginBottom: "5px",
            }}
        >
            {product.basePrice.toFixed(2)}
        </div>
        <div
            style={{
                fontSize: "11px",
                color: product.totalQuantity > 0 ? "#6b7280" : "#ef4444",
                backgroundColor: product.totalQuantity > 0 ? "#f3f4f6" : "#fee2e2",
                padding: "2px 6px",
                borderRadius: "4px",
                display: "inline-block",
            }}
        >
            المخزون: {product.totalQuantity}
        </div>
    </div>
);

/**
 * صف في عربة التسوق
 * يعرض: المنتج، السعر، الكمية، الحذف
 */
const CartItemRow = ({ item, onUpdate, onRemove, onShowDetails }) => (
    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
        <td style={{ padding: "12px" }}>
            <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                {item.productName}
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>
                {item.size} | {item.color}
            </div>
        </td>
        <td style={{ padding: "12px", textAlign: "center" }}>
            <input
                type="number"
                value={item.price}
                onChange={(e) => onUpdate({ price: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
                style={{
                    width: "70px",
                    padding: "5px",
                    borderRadius: "4px",
                    border: "1px solid #d1d5db",
                    textAlign: "center",
                }}
            />
        </td>
        <td style={{ padding: "12px", textAlign: "center" }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                }}
            >
                <button
                    onClick={() => onUpdate({ quantity: item.quantity - 1 })}
                    style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "4px",
                        border: "none",
                        backgroundColor: "#ff5757ff",

                        cursor: "pointer",
                        color: "white",
                    }}
                    disabled={item.quantity <= 1}
                >
                    -
                </button>
                <span style={{ fontWeight: "bold", minWidth: "20px" }}>
                    {item.quantity}
                </span>
                <button
                    onClick={() => onUpdate({ quantity: item.quantity + 1 })}
                    style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: "#10b981",
                        color: "white",
                    }}
                >
                    +
                </button>
            </div>
        </td>
        <td
            style={{
                padding: "12px",
                textAlign: "center",
                fontWeight: "bold",
                color: "#059669",
            }}
        >
            {(item.price * item.quantity).toFixed(2)}
        </td>
        <td style={{ padding: "12px", textAlign: "center" }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                }}
            >
                <button
                    onClick={onShowDetails}
                    style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: "#eff6ff",
                        color: "#2563eb",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                    }}
                    title="تفاصيل المنتج والربح"
                >
                    ℹ️
                </button>
                <button
                    onClick={onRemove}
                    style={{
                        color: "#ef4444",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "18px",
                    }}
                >
                    <i className="fas fa-trash" style={{ color: "#ef4444", cursor: "pointer" }}></i>

                </button>
            </div>
        </td>
    </tr>
);

/**
 * ============================================
 * Main Component - المكون الرئيسي
 * ============================================
 */

/**
 * نظام نقطة البيع المحسّن (Enhanced POS)
 * الميزات الرئيسية:
 * - إدارة متعددة الفواتير (Multi-invoice)
 * - بحث فوري عن المنتجات
 * - نظام إدارة العملاء
 * - دعم كامل للكيبورد
 * - إخطارات Toast محترفة
 */
export default function EnhancedPOS() {
    /**
     * ========== البيانات العامة ==========
     * المتغيرات المرتبطة بقاعدة البيانات
     */
    const [variants, setVariants] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    /**
     * ========== حالة الفواتير المتعددة ==========
     * إدارة فواتير متعددة في نفس الجلسة
     */
    const [invoices, setInvoices] = useState(() => {
        try {
            const saved = localStorage.getItem("pos_invoices");
            if (saved) {
                const parsedInvoices = JSON.parse(saved);
                // Ensure all invoices have invoiceDate field
                return parsedInvoices.map(invoice => ({
                    ...invoice,
                    invoiceDate: invoice.invoiceDate || new Date().toISOString().split('T')[0]
                }));
            } else {
                return [
                    {
                        id: generateInvoiceId(),
                        invoiceDate: new Date().toISOString().split('T')[0],
                        cart: [],
                        customer: null,
                        discount: 0,
                        discountType: "value", // value or percent
                        paidAmount: "",
                        saleType: "نقدي",
                        paymentMethod: "Cash",
                        notes: "",
                    },
                ];
            }
        } catch (e) {
            return [
                {
                    id: generateInvoiceId(),
                    invoiceDate: new Date().toISOString().split('T')[0],
                    cart: [],
                    customer: null,
                    discount: 0,
                    discountType: "value", // value or percent
                    paidAmount: "",
                    saleType: "نقدي",
                    paymentMethod: "Cash",
                    notes: "",
                },
            ];
        }
    });

    /**
     * معرّف الفاتورة النشطة الحالية
     */
    const [activeInvoiceId, setActiveInvoiceId] = useState(() => {
        return (
            localStorage.getItem("pos_activeId") ||
            (invoices[0] ? invoices[0].id : "")
        );
    });

    /**
     * ========== حالة الواجهة (UI State) ==========
     * البحث، الاختيار، العرض والإدارة
     */
    const [searchTerm, setSearchTerm] = useState("");
    const [customerSearchTerm, setCustomerSearchTerm] = useState("");
    const [selectedProductForVariant, setSelectedProductForVariant] =
        useState(null);
    const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);
    const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
    const [productDisplayMode, setProductDisplayMode] = useState("list"); // 'grid' or 'list'
    const [selectedVariantIndex, setSelectedVariantIndex] = useState(-1);
    const searchInputRef = useRef(null);
    const customerDropdownRef = useRef(null);
    const customerListRef = useRef(null);
    const productGridRef = useRef(null);
    const variantModalRef = useRef(null);
    const isFirstOpenRef = useRef(true);
    const handleCheckoutRef = useRef(null);
    const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        name: "",
        phone: "",
        phone2: "",
        address: "",
        city: "",
        district: "",
        notes: "",
        creditLimit: 0,
        customerType: "عادي",
    });
    const [productDetailsModal, setProductDetailsModal] = useState({
        open: false,
        item: null,
    });
    const [showCustomerList, setShowCustomerList] = useState(false);
    const [showCustomerLedger, setShowCustomerLedger] = useState(null);
    const [showInvoicePreview, setShowInvoicePreview] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    /**
     * ========== حالة الإشعارات ==========
     * نظام Toast للرسائل المختلفة
     */
    const [toast, setToast] = useState(null);

    const showToast = (message, type = "info") => {
        setToast({ message, type });
    };

    /**
     * ========== حالات إضافية للواجهة ==========
     */
    const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
    const [searchMode, setSearchMode] = useState("name"); // 'name' أو 'barcode'

    /**
     * ========== الحالة المشتقة ==========
     * حسابات وبيانات مشتقة من البيانات الأساسية
     */
    const activeInvoice =
        invoices.find((inv) => inv.id === activeInvoiceId) || invoices[0];
    const calculations = useInvoiceCalculations(activeInvoice);

    /**
     * حفظ البيانات في localStorage
     * للحفاظ على حالة الفواتير بين الجلسات
     */
    useEffect(() => {
        localStorage.setItem("pos_invoices", JSON.stringify(invoices));
        localStorage.setItem("pos_activeId", activeInvoiceId);
    }, [invoices, activeInvoiceId]);

    /**
     * تجميع المنتجات حسب الفئة
     * مع فلترة حسب البحث
     * يتم إظهار المنتجات فقط عند وجود بحث نشط
     */
    const groupedProducts = useMemo(() => {
        // إذا لم يكن هناك بحث، لا نعرض المنتجات
        if (!searchTerm || searchTerm.trim() === "") {
            return [];
        }

        const groups = {};
        variants.forEach((variant) => {
            if (!groups[variant.productId]) {
                groups[variant.productId] = {
                    id: variant.productId,
                    name: variant.product.name,
                    basePrice: variant.price,
                    totalQuantity: 0,
                    variants: [],
                };
            }
            groups[variant.productId].variants.push(variant);
            groups[variant.productId].totalQuantity += variant.quantity;
        });

        // تطبيق الفلترة حسب نوع البحث
        return Object.values(groups).filter((product) => {
            const searchLower = searchTerm.toLowerCase();

            if (searchMode === "barcode") {
                // بحث بالباركود فقط
                return product.variants.some((v) => v.barcode?.includes(searchTerm));
            } else {
                // بحث بالاسم فقط
                return product.name.toLowerCase().includes(searchLower);
            }
        });
    }, [variants, searchTerm, searchMode]);

    /**
     * فلترة العملاء حسب البحث
     * تحديد أقصى 50 عميل بدون بحث، و 20 مع البحث
     */
    const filteredCustomers = useMemo(() => {
        if (!Array.isArray(customers)) return [];
        if (showCustomerList && !customerSearchTerm) return customers.slice(0, 50);
        if (!customerSearchTerm) return [];
        const lowerTerm = customerSearchTerm.toLowerCase();
        return customers
            .filter(
                (c) =>
                    c.name.toLowerCase().includes(lowerTerm) ||
                    c.phone?.includes(lowerTerm),
            )
            .slice(0, 20);
    }, [customers, customerSearchTerm, showCustomerList]);

    /**
     * ========== معالجات الكيبورد ==========
     * التنقل والاختيار باستخدام الأسهم و Enter
     */

    /**
     * معالجة مفاتيح الكيبورد للتنقل بين المنتجات
     * تنقل فقط بالأسهم (↑/↓)
     */
    const handleProductKeyDown = (e) => {
        // ⚠️ تجاهل أحداث الكيبورد إذا كان موديال المقاسات مفتوحاً
        if (selectedProductForVariant) return;

        if (groupedProducts.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setSelectedProductIndex((prev) =>
                    prev < groupedProducts.length - 1 ? prev + 1 : prev,
                );
                break;
            case "ArrowUp":
                e.preventDefault();
                setSelectedProductIndex((prev) => (prev > 0 ? prev - 1 : -1));
                break;
            case "Enter":
                e.preventDefault();
                if (
                    selectedProductIndex >= 0 &&
                    groupedProducts[selectedProductIndex]
                ) {
                    const selectedProduct = groupedProducts[selectedProductIndex];
                    setSelectedProductForVariant(selectedProduct);
                }
                break;
            case "Escape":
                e.preventDefault();
                setSelectedProductIndex(-1);
                break;
            default:
                break;
        }
    };

    const handleCustomerKeyDown = (e) => {
        if (!showCustomerList || filteredCustomers.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setSelectedCustomerIndex((prev) =>
                    prev < filteredCustomers.length - 1 ? prev + 1 : prev,
                );
                break;
            case "ArrowUp":
                e.preventDefault();
                setSelectedCustomerIndex((prev) => (prev > 0 ? prev - 1 : -1));
                break;
            case "Enter":
                e.preventDefault();
                if (
                    selectedCustomerIndex >= 0 &&
                    filteredCustomers[selectedCustomerIndex]
                ) {
                    const selectedCustomer = filteredCustomers[selectedCustomerIndex];
                    updateInvoice({ customer: selectedCustomer });
                    setCustomerSearchTerm("");
                    setShowCustomerList(false);
                    setSelectedCustomerIndex(-1);
                }
                break;
            case "Escape":
                e.preventDefault();
                setShowCustomerList(false);
                setSelectedCustomerIndex(-1);
                break;
            default:
                break;
        }
    };

    /**
     * ========== Effects - المؤثرات الجانبية ==========
     * تحميل البيانات، معالجات المفاتيح، الـ cleanup
     */
    useEffect(() => {
        loadData(false);

        const handleKeyPress = (e) => {
            if (e.key === "F1") {
                e.preventDefault();
                if (handleCheckoutRef.current) handleCheckoutRef.current(true);
            } else if (e.key === "F2") {
                e.preventDefault();
                if (handleCheckoutRef.current) handleCheckoutRef.current(false);
            } else if (e.key === "F3") {
                e.preventDefault();
                if (handleCheckoutRef.current) handleCheckoutRef.current(false, true);
            } else if (e.key === "F4") {
                e.preventDefault();
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            } else if (e.key === "F5") {
                e.preventDefault();
                const customerInput = document.querySelector(
                    'input[placeholder*="ابحث عن عميل"]',
                );
                if (customerInput) {
                    customerInput.focus();
                }
            }
        };

        document.addEventListener("keydown", handleKeyPress);
        return () => document.removeEventListener("keydown", handleKeyPress);
    }, []);

    // === Reset selected customer index when search term changes ===
    useEffect(() => {
        setSelectedCustomerIndex(-1);
    }, [customerSearchTerm]);

    // === Auto scroll to selected customer ===
    useEffect(() => {
        if (selectedCustomerIndex >= 0 && customerListRef.current) {
            const items = customerListRef.current.querySelectorAll(
                "[data-customer-index]",
            );
            if (items[selectedCustomerIndex]) {
                items[selectedCustomerIndex].scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                });
            }
        }
    }, [selectedCustomerIndex]);

    /**
     * Scroll تلقائي للمنتج المختار بالكيبورد
     */
    useEffect(() => {
        if (selectedProductIndex >= 0 && productGridRef.current) {
            const items = productGridRef.current.querySelectorAll(
                "[data-product-index]",
            );
            if (items[selectedProductIndex]) {
                items[selectedProductIndex].scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                });
            }
        }
    }, [selectedProductIndex]);

    /**
     * إعادة تعيين الفهرس عند تغيير البحث
     */
    useEffect(() => {
        setSelectedProductIndex(-1);
    }, [searchTerm]);

    /**
     * Scroll تلقائي للمتغير المحدد في الموديال
     */
    useEffect(() => {
        if (selectedVariantIndex >= 0 && variantModalRef.current) {
            const items = variantModalRef.current.querySelectorAll(
                "[data-variant-index]",
            );
            if (items[selectedVariantIndex]) {
                items[selectedVariantIndex].scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                });
            }
        }
    }, [selectedVariantIndex]);

    /**
     * إغلاق قائمة العملاء عند الضغط خارجها
     */
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                customerDropdownRef.current &&
                !customerDropdownRef.current.contains(event.target)
            ) {
                setShowCustomerList(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loadData = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            const [variantsData, customersData] = await Promise.all([
                window.api.getVariants(),
                window.api.getCustomers(),
            ]);

            if (!variantsData.error) setVariants(variantsData);
            if (!customersData.error) setCustomers(customersData.data || []);
        } catch (error) {
            console.error(error);
            if (!isBackground) showToast("فشل في تحميل البيانات", "error");
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    /**
     * ========== عمليات الفاتورة ==========
     * التحديث، الحفظ، الحذف والإدارة
     */
    const updateInvoice = (updates) => {
        setInvoices((prev) =>
            prev.map((inv) =>
                inv.id === activeInvoiceId ? { ...inv, ...updates } : inv,
            ),
        );
    };

    const setInvoiceSaleType = (type) => {
        updateInvoice({
            saleType: type,
            paidAmount: type === "نقدي" ? calculations.total : 0,
        });
    };

    const addTab = () => {
        const newInvoice = {
            id: generateInvoiceId(),
            invoiceDate: new Date().toISOString().split('T')[0],
            cart: [],
            customer: null,
            discount: 0,
            discountType: "value", // value or percent
            paidAmount: "",
            saleType: "نقدي",
            paymentMethod: "Cash",
            notes: "",
        };
        setInvoices((prev) => [...prev, newInvoice]);
        setActiveInvoiceId(newInvoice.id);
    };

    const closeTab = (invoiceId) => {
        if (invoices.length === 1) {
            showToast("لا يمكن إغلاق الفاتورة الوحيدة", "warning");
            return;
        }
        const newInvoices = invoices.filter((inv) => inv.id !== invoiceId);
        setInvoices(newInvoices);
        if (activeInvoiceId === invoiceId) {
            setActiveInvoiceId(newInvoices[newInvoices.length - 1].id);
        }
    };

    /**
     * ========== عمليات السلة ==========
     * إضافة، تحديث، حذف المنتجات من السلة
     */
    const addToCart = (variant) => {
        // الكمية المتاحة في المخزن
        let availableQuantity = variant.quantity || 0;

        // الكمية المطلوبة من الموديال (إن وجدت، أو 1 افتراضياً)
        // لاحظ: variant.quantity هنا هو الكمية المتاحة في المخزن
        // والكمية المختارة تُمرر كخاصية في variant أيضاً
        let requestedQuantity = 1;

        // إذا كان variant.quantity > 0 و موجود في الموديال، فهو الكمية المختارة
        // وإلا فهو الكمية المتاحة الأصلية
        if (variant.quantitySelected) {
            requestedQuantity = variant.quantitySelected;
            // استرجع الكمية الأصلية المتاحة من maxQuantity
        } else if (variant.maxQuantity) {
            availableQuantity = variant.maxQuantity;
        }

        if (availableQuantity <= 0) {
            showToast("المخزون نفد!", "error");
            return;
        }

        const existingItem = activeInvoice.cart.find(
            (item) => item.variantId === variant.id,
        );
        let newCart;

        if (existingItem) {
            // التحقق من أن الكمية الجديدة لا تتجاوز المتاح
            if (existingItem.quantity + requestedQuantity > availableQuantity) {
                showToast("الكمية المطلوبة غير متوفرة", "warning");
                return;
            }
            newCart = activeInvoice.cart.map((item) =>
                item.variantId === variant.id
                    ? { ...item, quantity: item.quantity + requestedQuantity }
                    : item,
            );
        } else {
            newCart = [
                ...activeInvoice.cart,
                {
                    variantId: variant.id,
                    productId: variant.productId,
                    productName: variant.product.name,
                    price: variant.price,
                    costPrice: variant.cost || 0,
                    quantity: requestedQuantity,
                    size: variant.productSize,
                    color: variant.color,
                    discount: 0,
                    maxQuantity: availableQuantity,
                },
            ];
        }

        updateInvoice({ cart: newCart });
        setSearchTerm("");
        if (searchInputRef.current) searchInputRef.current.focus();
    };

    /**
     * تحديث سعر أو كمية المنتج في السلة
     */
    const updateCartItem = (variantId, updates) => {
        const item = activeInvoice.cart.find((i) => i.variantId === variantId);
        if (updates.quantity && updates.quantity > item.maxQuantity) {
            showToast(`الكمية المتاحة فقط ${item.maxQuantity}`, "warning");
            return;
        }

        updateInvoice({
            cart: activeInvoice.cart.map((item) =>
                item.variantId === variantId ? { ...item, ...updates } : item,
            ),
        });
    };

    const removeFromCart = (variantId) => {
        updateInvoice({
            cart: activeInvoice.cart.filter((item) => item.variantId !== variantId),
        });
    };

    /**
     * ========== عملية الدفع والحفظ ==========
     * معالجة الفواتير والتحقق والحفظ في قاعدة البيانات
     */
    const handleCheckout = async (shouldPrint = false, shouldPreview = false) => {
        if (isFirstOpenRef.current === "locked") return;
        isFirstOpenRef.current = "locked";

        setIsSaving(true);

        try {
            // احصل على أحدث حالة الفاتورة
            const currentInvoice =
                invoices.find((inv) => inv.id === activeInvoiceId) || invoices[0];

            if (!currentInvoice || currentInvoice.cart.length === 0) return;

            playSound("save");

            // أعد حساب على أساس الفاتورة الحالية
            const subTotal = currentInvoice.cart.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0,
            );
            const totalDiscount = currentInvoice.cart.reduce(
                (sum, item) => sum + item.discount * item.quantity,
                0,
            );
            const total = Math.max(
                0,
                subTotal - totalDiscount - (parseFloat(currentInvoice.discount) || 0),
            );
            const paid = parseFloat(currentInvoice.paidAmount) || 0;
            const remaining = total - paid;

            let finalSaleType = currentInvoice.saleType;
            if (remaining > 0.01) {
                finalSaleType = "آجل";
            }

            // تحديث الفاتورة في الحالة الحالية قبل الحفظ إذا كان نوع البيع آجل وليس هناك عميل
            if (
                finalSaleType === "آجل" &&
                (!currentInvoice.customer || !currentInvoice.customer.id)
            ) {
                showToast(
                    "⚠️ يوجد متبقي في الفاتورة، يرجى اختيار عميل لتسجيل الدين.",
                    "warning",
                );
                return;
            }

            if (finalSaleType === "آجل" && currentInvoice.customer?.creditLimit > 0) {
                const newBalance = (currentInvoice.customer.balance || 0) + remaining;
                if (newBalance > currentInvoice.customer.creditLimit) {
                    showToast(
                        `⚠️ تجاوز الحد الائتماني! الرصيد الجديد سيكون: ${newBalance.toFixed(2)}`,
                        "error",
                    );
                    return;
                }
            }

            let paymentLabel = currentInvoice.paymentMethod;
            if (paid === 0 && finalSaleType === "آجل") {
                paymentLabel = "Credit";
            }

            const saleData = {
                items: currentInvoice.cart.map((item) => ({
                    variantId: item.variantId,
                    quantity: item.quantity,
                    price: item.price,
                    costPrice: item.costPrice,
                    discount: parseFloat(item.discount || 0),
                })),
                customerId: currentInvoice.customer?.id,
                total: total,
                paid: paid,
                payment: paymentLabel,
                saleType: finalSaleType,
                discount: parseFloat(currentInvoice.discount || 0),
                invoiceDate: currentInvoice.invoiceDate || new Date().toISOString().split("T")[0],
            };

            if (shouldPreview) {
                const result = await window.api.createSale(saleData);
                if (result.error) {
                    showToast("خطأ: " + result.error, "error");
                    return;
                }

                const previewSale = {
                    id: result.id || result.saleId,
                    createdAt: new Date().toISOString(),
                    invoiceDate:
                        currentInvoice.invoiceDate || new Date().toISOString().split("T")[0],
                    customer: currentInvoice.customer,
                    items: currentInvoice.cart.map((item) => ({
                        variant: {
                            product: { name: item.productName },
                            productSize: item.size,
                            color: item.color,
                        },
                        quantity: item.quantity,
                        price: item.price,
                        discount: item.discount || 0,
                    })),
                    total: total,
                    paid: paid,
                    payment: paymentLabel,
                    discount: parseFloat(currentInvoice.discount || 0),
                };
                setPreviewData(previewSale);
                setShowInvoicePreview(true);

                loadData(true);
                resetInvoice();
                return;
            }

            const result = await window.api.createSale(saleData);
            if (result.error) {
                showToast("خطأ: " + result.error, "error");
                return;
            }

            if (shouldPrint) {
                await window.api.printSale(result.id || result.saleId);
            }

            loadData(true);
            resetInvoice();

            setTimeout(() => {
                if (searchInputRef.current) searchInputRef.current.focus();
            }, 100);

            showToast("✅ تم حفظ الفاتورة بنجاح", "success");
        } catch (err) {
            console.error(err);
            showToast("خطأ في الاتصال بالقاعدة", "error");
        } finally {
            isFirstOpenRef.current = false;
            setIsSaving(false);
        }
    };

    // Update the ref with the latest handleCheckout function
    useEffect(() => {
        handleCheckoutRef.current = handleCheckout;
    }, [handleCheckout]);

    /**
     * إعادة تعيين الفاتورة لبدء فاتورة جديدة
     */
    const resetInvoice = () => {
        updateInvoice({
            cart: [],
            customer: null,
            discount: 0,
            paidAmount: "",
            saleType: "نقدي",
            paymentMethod: "Cash",
            notes: "",
        });
        setCustomerSearchTerm("");
    };

    /**
     * تمييز النصوص المطابقة في البحث بلون أصفر
     */
    const highlightMatch = (text, searchTerm) => {
        if (!searchTerm) return text;

        const parts = [];
        const regex = new RegExp(
            `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
            "gi",
        );
        const split = text.split(regex);

        split.forEach((part, index) => {
            if (part.toLowerCase() === searchTerm.toLowerCase()) {
                parts.push(
                    <span
                        key={index}
                        style={{ backgroundColor: "#fbbf24", fontWeight: "bold" }}
                    >
                        {part}
                    </span>,
                );
            } else {
                parts.push(part);
            }
        });

        return parts;
    };

    /**
     * ========== عمليات العملاء ==========
     * إضافة عميل جديد والتعامل مع بيانات العملاء
     */
    const handleAddCustomer = async () => {
        try {
            const res = await window.api.addCustomer(newCustomer);
            if (!res.error) {
                showToast("تم إضافة العميل بنجاح", "success");
                setShowNewCustomerModal(false);
                setNewCustomer({
                    name: "",
                    phone: "",
                    phone2: "",
                    address: "",
                    city: "",
                    district: "",
                    notes: "",
                    creditLimit: 0,
                    customerType: "عادي",
                });
                loadData(true);

                if (res && res.id) {
                    updateInvoice({ customer: res });
                    setCustomerSearchTerm(res.name);
                }
            } else {
                showToast("خطأ: " + res.error, "error");
            }
        } catch (err) {
            showToast("خطأ في النظام", "error");
        }
    };

    if (loading)
        return (
            <div style={{ padding: "20px", textAlign: "center" }}>
                جاري تحميل البيانات...
            </div>
        );

    /**
     * ========== الواجهة الرئيسية (Main UI) ==========
     * تخطيط ثنائي الأعمدة: منتجات على اليسار، الفاتورة على اليمين
     */
    return (
        <div
            style={{
                padding: "5px",
                height: "94vh",
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#f3f4f6",
                overflow: "hidden",
                boxSizing: "border-box",
            }}
        >
            {/* Global Styles */}
            <style>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes slideIn {
                    from { transform: translateX(400px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>

            {/* Toast Notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* ========== Header & Tabs ========== */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "15px",
                }}
            >
                {/* Invoice Tabs */}
                <div
                    className="hide-scrollbar"
                    style={{
                        display: "flex",
                        gap: "5px",
                        overflowX: "auto",
                        flex: 1,
                        paddingBottom: "5px",
                    }}
                >
                    {invoices.map((inv) => (
                        <InvoiceTab
                            key={inv.id}
                            invoice={inv}
                            isActive={activeInvoiceId === inv.id}
                            onSelect={() => setActiveInvoiceId(inv.id)}
                            onClose={() => closeTab(inv.id)}
                            canClose={invoices.length > 1}
                        />
                    ))}
                    <button
                        onClick={addTab}
                        style={{
                            padding: "8px 12px",
                            backgroundColor: "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "18px",
                            fontWeight: "bold",
                        }}
                    >
                        +
                    </button>
                </div>
            </div>

            {/* ========== Main Content ========== */}
            <div
                style={{ display: "flex", gap: "20px", flex: 1, overflow: "hidden" }}
            >
                {/* ========== Left Side: Products Grid/List ========== */}
                <div
                    style={{
                        flex: 2,
                        display: "flex",
                        flexDirection: "column",
                        backgroundColor: "white",
                        padding: "15px",
                        borderRadius: "12px",
                        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                    }}
                >
                    {/* Search & Display Mode Toggle */}
                    <div
                        style={{
                            display: "flex",
                            gap: "10px",
                            marginBottom: "15px",
                            alignItems: "center",
                            flexWrap: "wrap",
                        }}
                    >
                        {/* Product Search Input */}
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="🔍 ابدأ البحث لإظهار المنتجات..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleProductKeyDown}
                            style={{
                                padding: "12px",
                                borderRadius: "8px",
                                border: "1px solid #d1d5db",
                                fontSize: "16px",
                                flex: 1,
                                minWidth: "200px",
                            }}
                        />

                        {/* Search Mode Selector */}
                        <div style={{ display: "flex", gap: "4px", backgroundColor: "#f3f4f6", borderRadius: "8px", padding: "4px" }}>
                            <button
                                onClick={() => setSearchMode("name")}
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                    border: "none",
                                    backgroundColor: searchMode === "name" ? "white" : "transparent",
                                    color: searchMode === "name" ? "#3b82f6" : "#6b7280",
                                    cursor: "pointer",
                                    fontWeight: "bold",
                                    boxShadow: searchMode === "name" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                                    transition: "all 0.2s",
                                    fontSize: "13px",
                                }}
                                title="بحث بالاسم"
                            >
                                📝 اسم
                            </button>
                            <button
                                onClick={() => setSearchMode("barcode")}
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                    border: "none",
                                    backgroundColor: searchMode === "barcode" ? "white" : "transparent",
                                    color: searchMode === "barcode" ? "#dc2626" : "#6b7280",
                                    cursor: "pointer",
                                    fontWeight: "bold",
                                    boxShadow: searchMode === "barcode" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                                    transition: "all 0.2s",
                                    fontSize: "13px",
                                }}
                                title="بحث بالباركود"
                            >
                                📦 باركود
                            </button>
                        </div>

                        {/* Display Mode Toggle */}
                        <div
                            style={{
                                display: "flex",
                                backgroundColor: "#f3f4f6",
                                borderRadius: "8px",
                                padding: "4px",
                            }}
                        >
                            <button
                                onClick={() => setProductDisplayMode("grid")}
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                    border: "none",
                                    backgroundColor:
                                        productDisplayMode === "grid" ? "white" : "transparent",
                                    color: productDisplayMode === "grid" ? "#3b82f6" : "#6b7280",
                                    cursor: "pointer",
                                    fontWeight: "bold",
                                    boxShadow:
                                        productDisplayMode === "grid"
                                            ? "0 1px 2px rgba(0,0,0,0.1)"
                                            : "none",
                                    transition: "all 0.2s",
                                    fontSize: "18px",
                                }}
                                title="عرض الكارت - اضغط للتبديل"
                            >
                                ▦
                            </button>
                            <button
                                onClick={() => setProductDisplayMode("list")}
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                    border: "none",
                                    backgroundColor:
                                        productDisplayMode === "list" ? "white" : "transparent",
                                    color: productDisplayMode === "list" ? "#3b82f6" : "#6b7280",
                                    cursor: "pointer",
                                    fontWeight: "bold",
                                    boxShadow:
                                        productDisplayMode === "list"
                                            ? "0 1px 2px rgba(0,0,0,0.1)"
                                            : "none",
                                    transition: "all 0.2s",
                                    fontSize: "18px",
                                }}
                                title="عرض القائمة - اضغط للتبديل"
                            >
                                ≡
                            </button>
                        </div>
                    </div>

                    {/* Products Display */}
                    {!searchTerm.trim() ? (
                        // رسالة عدم وجود بحث
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                color: "#9ca3af",
                                fontSize: "18px",
                                fontWeight: "bold",
                                textAlign: "center",
                                padding: "40px",
                            }}
                        >
                            <div>
                                <div style={{ fontSize: "48px", marginBottom: "10px" }}>🔍</div>
                                <div>ابدأ البحث عن منتج لإظهار النتائج</div>
                                <div style={{ fontSize: "12px", marginTop: "10px", color: "#d1d5db" }}>
                                    ابحث بـ {searchMode === "name" ? "اسم المنتج" : "رقم الباركود"}
                                </div>
                            </div>
                        </div>
                    ) : groupedProducts.length === 0 ? (
                        // رسالة عدم وجود نتائج
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                color: "#9ca3af",
                                fontSize: "16px",
                                fontWeight: "bold",
                                textAlign: "center",
                                padding: "40px",
                            }}
                        >
                            <div>
                                <div style={{ fontSize: "40px", marginBottom: "10px" }}>❌</div>
                                <div>لم يتم العثور على منتجات</div>
                                <div style={{ fontSize: "12px", marginTop: "10px", color: "#d1d5db" }}>
                                    جرب البحث بـ {searchMode === "name" ? "اسم مختلف" : "رقم باركود مختلف"}
                                </div>
                            </div>
                        </div>
                    ) : productDisplayMode === "grid" ? (
                        <div
                            ref={productGridRef}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                                gap: "15px",
                                overflowY: "auto",
                                paddingRight: "5px",
                            }}
                        >
                            {groupedProducts.map((product, index) => (
                                <div
                                    key={product.id}
                                    data-product-index={index}
                                    onClick={() => {
                                        setSelectedProductIndex(index);
                                        setSelectedProductForVariant(product);
                                    }}
                                    onMouseEnter={() => setSelectedProductIndex(index)}
                                    style={{
                                        cursor: "pointer",
                                        position: "relative",
                                        transition: "transform 0.2s",
                                    }}
                                >
                                    <ProductCard
                                        product={product}
                                        onClick={() => setSelectedProductForVariant(product)}
                                    />
                                    {selectedProductIndex === index && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                border: "3px solid #3b82f6",
                                                borderRadius: "10px",
                                                pointerEvents: "none",
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div ref={productGridRef} style={{ overflowY: "auto", flex: 1 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead
                                    style={{
                                        backgroundColor: "#f9fafb",
                                        position: "sticky",
                                        top: 0,
                                    }}
                                >
                                    <tr>
                                        <th
                                            style={{
                                                padding: "12px",
                                                textAlign: "right",
                                                fontSize: "13px",
                                                color: "#4b5563",
                                            }}
                                        >
                                            المنتج
                                        </th>
                                        <th
                                            style={{
                                                padding: "12px",
                                                textAlign: "center",
                                                fontSize: "13px",
                                                color: "#4b5563",
                                            }}
                                        >
                                            السعر
                                        </th>
                                        <th
                                            style={{
                                                padding: "12px",
                                                textAlign: "center",
                                                fontSize: "13px",
                                                color: "#4b5563",
                                            }}
                                        >
                                            المخزون
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedProducts.map((product, index) => (
                                        <tr
                                            key={product.id}
                                            data-product-index={index}
                                            onClick={() => {
                                                setSelectedProductIndex(index);
                                                setSelectedProductForVariant(product);
                                            }}
                                            onMouseEnter={() => setSelectedProductIndex(index)}
                                            style={{
                                                backgroundColor:
                                                    selectedProductIndex === index ? "#eff6ff" : "white",
                                                cursor: "pointer",
                                                borderBottom: "1px solid #e5e7eb",
                                                transition: "background-color 0.2s",
                                                borderLeft:
                                                    selectedProductIndex === index
                                                        ? "4px solid #3b82f6"
                                                        : "none",
                                            }}
                                        >
                                            <td style={{ padding: "12px", textAlign: "right" }}>
                                                <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                                                    {product.name}
                                                </div>
                                            </td>
                                            <td style={{ padding: "12px", textAlign: "center" }}>
                                                <span style={{ color: "#059669", fontWeight: "bold" }}>
                                                    {product.basePrice.toFixed(2)}
                                                </span>
                                            </td>
                                            <td style={{ padding: "12px", textAlign: "center" }}>
                                                <span
                                                    style={{
                                                        fontSize: "11px",
                                                        color:
                                                            product.totalQuantity > 0 ? "#6b7280" : "#ef4444",
                                                        backgroundColor:
                                                            product.totalQuantity > 0 ? "#f3f4f6" : "#fee2e2",
                                                        padding: "2px 6px",
                                                        borderRadius: "4px",
                                                        display: "inline-block",
                                                    }}
                                                >
                                                    {product.totalQuantity}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ========== Right Side: Invoice, Customer & Payment ========== */}
                <div
                    style={{
                        flex: 3,
                        display: "flex",
                        flexDirection: "column",
                        gap: "15px",
                        overflow: "hidden",
                    }}
                >
                    {/* Section 1: Sale Type & Customer Selection */}
                    <div
                        style={{
                            backgroundColor: "white",
                            borderRadius: "12px",
                            padding: "15px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                        }}
                    >
                        {/* Sale Type Toggle with Date */}
                        <div
                            style={{
                                display: "flex",
                                backgroundColor: "#f3f4f6",
                                borderRadius: "8px",
                                padding: "4px",
                                gap: "10px",
                                alignItems: "center",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    flex: 1,
                                    backgroundColor: "#e5e7eb",
                                    borderRadius: "6px",
                                    padding: "2px",
                                }}
                            >
                                <button
                                    onClick={() => setInvoiceSaleType("نقدي")}
                                    style={{
                                        flex: 1,
                                        padding: "8px",
                                        borderRadius: "4px",
                                        border: "none",
                                        backgroundColor:
                                            activeInvoice.saleType === "نقدي" ? "white" : "transparent",
                                        color:
                                            activeInvoice.saleType === "نقدي" ? "#10b981" : "#6b7280",
                                        fontWeight: "bold",
                                        cursor: "pointer",
                                        boxShadow:
                                            activeInvoice.saleType === "نقدي"
                                                ? "0 1px 2px rgba(0,0,0,0.1)"
                                                : "none",
                                        transition: "all 0.2s",
                                    }}
                                >
                                    💵 نقدي
                                </button>
                                <button
                                    onClick={() => setInvoiceSaleType("آجل")}
                                    style={{
                                        flex: 1,
                                        padding: "8px",
                                        borderRadius: "4px",
                                        border: "none",
                                        backgroundColor:
                                            activeInvoice.saleType === "آجل" ? "white" : "transparent",
                                        color:
                                            activeInvoice.saleType === "آجل" ? "#f59e0b" : "#6b7280",
                                        fontWeight: "bold",
                                        cursor: "pointer",
                                        boxShadow:
                                            activeInvoice.saleType === "آجل"
                                                ? "0 1px 2px rgba(0,0,0,0.1)"
                                                : "none",
                                        transition: "all 0.2s",
                                    }}
                                >
                                    📅 آجل
                                </button>
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    backgroundColor: "white",
                                    padding: "5px 10px",
                                    borderRadius: "6px",
                                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                }}
                            >
                                <span style={{ fontSize: "14px", color: "#6b7280", fontWeight: "500" }}>
                                    📆
                                </span>
                                <input
                                    type="date"
                                    value={activeInvoice.invoiceDate || new Date().toISOString().split('T')[0]}
                                    onChange={(e) => updateInvoice({ invoiceDate: e.target.value })}
                                    style={{
                                        border: "none",
                                        outline: "none",
                                        fontSize: "14px",
                                        color: "#374151",
                                        fontWeight: "500",
                                        cursor: "pointer",
                                        backgroundColor: "transparent",
                                    }}
                                />
                            </div>
                        </div>
                        {!activeInvoice.customer ? (
                            <div
                                ref={customerDropdownRef}
                                style={{ display: "flex", gap: "10px", position: "relative" }}
                            >
                                <div style={{ flex: 1, position: "relative" }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            position: "relative",
                                        }}
                                    >
                                        <input
                                            type="text"
                                            placeholder="👤 ابحث عن عميل (الاسم أو الهاتف)..."
                                            value={customerSearchTerm}
                                            onChange={(e) => {
                                                setCustomerSearchTerm(e.target.value);
                                                setShowCustomerList(true);
                                                setSelectedCustomerIndex(-1);
                                            }}
                                            onFocus={() => setShowCustomerList(true)}
                                            onKeyDown={handleCustomerKeyDown}
                                            style={{
                                                flex: 1,
                                                padding: "10px",
                                                borderRadius: "8px",
                                                border: "1px solid #d1d5db",
                                                paddingLeft: "30px",
                                            }}
                                        />
                                        <button
                                            onClick={() => {
                                                if (showCustomerList) {
                                                    setShowCustomerList(false);
                                                    setCustomerSearchTerm("");
                                                } else {
                                                    setShowCustomerList(true);
                                                }
                                            }}
                                            style={{
                                                position: "absolute",
                                                left: "10px",
                                                background: "none",
                                                border: "none",
                                                color: "#6b7280",
                                                cursor: "pointer",
                                            }}
                                        >
                                            ▼
                                        </button>
                                    </div>

                                    {showCustomerList && filteredCustomers.length > 0 && (
                                        <div
                                            ref={customerListRef}
                                            style={{
                                                position: "absolute",
                                                top: "100%",
                                                left: 0,
                                                right: 0,
                                                backgroundColor: "white",
                                                border: "1px solid #e5e7eb",
                                                borderRadius: "8px",
                                                marginTop: "5px",
                                                maxHeight: "200px",
                                                overflowY: "auto",
                                                zIndex: 100,
                                                boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                                            }}
                                        >
                                            {filteredCustomers.map((customer, index) => (
                                                <div
                                                    key={customer.id}
                                                    data-customer-index={index}
                                                    onClick={() => {
                                                        updateInvoice({ customer });
                                                        setCustomerSearchTerm("");
                                                        setShowCustomerList(false);
                                                        setSelectedCustomerIndex(-1);
                                                    }}
                                                    style={{
                                                        padding: "10px",
                                                        borderBottom: "1px solid #f3f4f6",
                                                        cursor: "pointer",
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        backgroundColor:
                                                            selectedCustomerIndex === index
                                                                ? "#fef08a"
                                                                : "white",
                                                        transition: "background-color 0.2s",
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        setSelectedCustomerIndex(index);
                                                        e.currentTarget.style.backgroundColor = "#fef08a";
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        setSelectedCustomerIndex(-1);
                                                        e.currentTarget.style.backgroundColor = "white";
                                                    }}
                                                >
                                                    <span style={{ fontWeight: "bold" }}>
                                                        {highlightMatch(customer.name, customerSearchTerm)}
                                                    </span>
                                                    <span style={{ color: "#6b7280", fontSize: "12px" }}>
                                                        {highlightMatch(
                                                            customer.phone || "",
                                                            customerSearchTerm,
                                                        )}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setNewCustomer({
                                            name: "",
                                            phone: "",
                                            phone2: "",
                                            address: "",
                                            city: "",
                                            district: "",
                                            notes: "",
                                            creditLimit: 0,
                                            customerType: "عادي",
                                        });
                                        setShowNewCustomerModal(true);
                                    }}
                                    style={{
                                        padding: "10px 15px",
                                        backgroundColor: "#e0e7ff",
                                        color: "#4338ca",
                                        border: "none",
                                        borderRadius: "8px",
                                        fontWeight: "bold",
                                        cursor: "pointer",
                                    }}
                                >
                                    جديد +
                                </button>
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    backgroundColor: "#eff6ff",
                                    padding: "10px",
                                    borderRadius: "8px",
                                    border: "1px solid #bfdbfe",
                                }}
                            >
                                <div>
                                    <span style={{ fontWeight: "bold", color: "#1e40af" }}>
                                        {activeInvoice.customer.name}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: "12px",
                                            color: "#6b7280",
                                            marginRight: "10px",
                                        }}
                                    >
                                        {activeInvoice.customer.phone}
                                    </span>
                                </div>
                                <div>
                                    <span style={{ fontSize: "13px", color: "#6b7280" }}>
                                        الرصيد السابق:{" "}
                                    </span>
                                    <span
                                        style={{
                                            fontWeight: "bold",
                                            color:
                                                (activeInvoice.customer.balance || 0) > 0
                                                    ? "#dc2626"
                                                    : "#059669",
                                            direction: "ltr",
                                            display: "inline-block",
                                        }}
                                    >
                                        {(activeInvoice.customer.balance || 0).toFixed(2)}
                                    </span>
                                </div>
                                <div style={{ display: "flex", gap: "5px" }}>
                                    <button
                                        onClick={() =>
                                            setShowCustomerLedger(activeInvoice.customer.id)
                                        }
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "#3b82f6",
                                            cursor: "pointer",
                                            fontSize: "16px",
                                            padding: "2px 6px",
                                            borderRadius: "4px",
                                            backgroundColor: "#e0f2fe",
                                        }}
                                        title="عرض كشف حساب العميل"
                                    >
                                        <i className="fas fa-info-circle" style={{ color: "#3b82f6", fontSize: "20px" }}></i>
                                    </button>
                                    <button
                                        onClick={() => {
                                            updateInvoice({ customer: null });
                                            setCustomerSearchTerm("");
                                        }}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "#ef4444",
                                            cursor: "pointer",
                                            fontSize: "20px",
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 2: Shopping Cart */}
                    <div
                        style={{
                            flex: 1,
                            backgroundColor: "white",
                            borderRadius: "12px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <div style={{ overflowY: "auto", flex: 1 }}>
                            <table
                                style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    minWidth: "500px",
                                }}
                            >
                                <thead
                                    style={{
                                        backgroundColor: "#f9fafb",
                                        position: "sticky",
                                        top: 0,
                                        zIndex: 10,
                                    }}
                                >
                                    <tr>
                                        <th
                                            style={{
                                                padding: "12px",
                                                textAlign: "right",
                                                fontSize: "13px",
                                                color: "#4b5563",
                                            }}
                                        >
                                            المنتج
                                        </th>
                                        <th
                                            style={{
                                                padding: "12px",
                                                textAlign: "center",
                                                fontSize: "13px",
                                                color: "#4b5563",
                                            }}
                                        >
                                            السعر
                                        </th>
                                        <th
                                            style={{
                                                padding: "12px",
                                                textAlign: "center",
                                                fontSize: "13px",
                                                color: "#4b5563",
                                            }}
                                        >
                                            الكمية
                                        </th>
                                        <th
                                            style={{
                                                padding: "12px",
                                                textAlign: "center",
                                                fontSize: "13px",
                                                color: "#4b5563",
                                            }}
                                        >
                                            الإجمالي
                                        </th>
                                        <th
                                            style={{
                                                padding: "12px",
                                                textAlign: "center",
                                                fontSize: "13px",
                                                color: "#4b5563",
                                            }}
                                        ></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeInvoice.cart.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="5"
                                                style={{
                                                    textAlign: "center",
                                                    padding: "30px",
                                                    color: "#9ca3af",
                                                }}
                                            >
                                                لا توجد منتجات في السلة
                                            </td>
                                        </tr>
                                    ) : (
                                        activeInvoice.cart.map((item) => (
                                            <CartItemRow
                                                key={item.variantId}
                                                item={item}
                                                onUpdate={(updates) =>
                                                    updateCartItem(item.variantId, updates)
                                                }
                                                onRemove={() => removeFromCart(item.variantId)}
                                                onShowDetails={() =>
                                                    setProductDetailsModal({ open: true, item })
                                                }
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========== Payment Section (Redesigned) ========== */}
            <div
                style={{
                    display: "flex",
                    gap: "15px",
                    marginTop: "15px",
                    alignItems: "stretch",
                    marginLeft: "15px",
                }}
            >



                {/* Container for Middle & Right Sections - 80% */}
                <div style={{ flex: "0 0 80%", display: "flex", flexDirection: "column", gap: "10px" }}>

                    {/* Upper Row: Middle & Right */}
                    <div style={{ display: "flex", gap: "15px", flex: 1 }}>

                        {/* Section 3: Right Panel (Payment Methods, Discount, Paid Input) */}
                        <div
                            style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                            }}
                        >
                            {/* Row 1: Payment Methods & Discount (Merged) */}
                            <div style={{ display: "flex", gap: "10px" }}>
                                {/* Payment Methods (No Label) */}
                                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

                                    <label style={{ fontSize: "12px", color: "#6b7280", width: "100px" }}>طريقة الدفع:</label>

                                    <div style={{ display: "flex", gap: "5px", flex: 2 }}>
                                        {[
                                            { id: "Cash", label: "نقدى", color: "#10b981", bg: "#ecfdf5", text: "#047857" },
                                            { id: "VodafoneCash", label: "فودافون", color: "#dc2626", bg: "#fef2f2", text: "#991b1b" },
                                            { id: "InstaPay", label: "إنستاباي", color: "#6366f1", bg: "#eef2ff", text: "#4338ca" },
                                        ].map((method) => (
                                            <button
                                                key={method.id}
                                                onClick={() => updateInvoice({ paymentMethod: method.id })}
                                                style={{
                                                    flex: 1,
                                                    padding: "11px", // Increased padding
                                                    borderRadius: "6px",
                                                    border: `2px solid ${activeInvoice.paymentMethod === method.id ? method.color : "#e5e7eb"}`,
                                                    backgroundColor: activeInvoice.paymentMethod === method.id ? method.bg : "white",
                                                    color: activeInvoice.paymentMethod === method.id ? method.text : "#374151",
                                                    fontWeight: "bold",
                                                    fontSize: "13px", // Increased font size
                                                    cursor: "pointer",
                                                    transition: "all 0.2s",

                                                }}
                                                title={method.label}
                                            >
                                                {method.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Discount (No Label) */}
                                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

                                    <label style={{ fontSize: "12px", color: "#6b7280", width: "50px" }}>الخصم:</label>
                                    <div style={{ display: "flex", gap: "5px", flex: 1 }}>
                                        <input
                                            type="number"
                                            value={activeInvoice.discount}
                                            onChange={(e) => updateInvoice({ discount: e.target.value })}
                                            min="0"
                                            step={activeInvoice.discountType === "percent" ? "1" : "0.01"}
                                            placeholder="الخصم"
                                            style={{
                                                flex: 1,
                                                padding: "8px",
                                                borderRadius: "6px",
                                                border: "1px solid #d1d5db",
                                                fontSize: "14px",
                                                textAlign: "center",
                                            }}
                                            onFocus={(e) => e.target.select()}
                                        />
                                        <select
                                            value={activeInvoice.discountType || "value"}
                                            onChange={(e) => updateInvoice({ discountType: e.target.value })}
                                            style={{
                                                padding: "0 5px",
                                                borderRadius: "6px",
                                                border: "1px solid #d1d5db",
                                                backgroundColor: "#f9fafb",
                                                fontSize: "13px",
                                                cursor: "pointer",
                                                width: "60px"
                                            }}
                                        >

                                            <option value="value">قيمة</option>
                                            <option value="percent">نسبه</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                                <label style={{ fontSize: "14px", color: "#111827", fontWeight: "bold" }}>المدفوع:</label>
                                <input
                                    type="number"
                                    value={activeInvoice.paidAmount}
                                    onChange={(e) => updateInvoice({ paidAmount: e.target.value })}
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    style={{
                                        flex: 1,
                                        width: "100%",
                                        padding: "15px",
                                        fontSize: "20px",
                                        fontWeight: "bold",
                                        textAlign: "center",
                                        borderRadius: "8px",
                                        border: "2px solid #3b82f6",
                                        color: "#1e40af",
                                        backgroundColor: "#eff6ff",
                                    }}
                                    onFocus={(e) => e.target.select()}
                                />
                            </div>

                            {/* Action Buttons (Moved Here) */}
                            <div style={{ display: "flex", gap: "10px", marginTop: "0px" }}>
                                <button
                                    onClick={() => handleCheckout(false)}
                                    disabled={activeInvoice.cart.length === 0}
                                    style={{
                                        flex: 1,
                                        padding: "14px", // Increased padding
                                        backgroundColor: activeInvoice.cart.length === 0 ? "#9ca3af" : "#3b82f6",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "6px",
                                        fontSize: "14px", // Increased font size slightly
                                        fontWeight: "bold",
                                        cursor: activeInvoice.cart.length === 0 ? "not-allowed" : "pointer",
                                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                    }}
                                >
                                    حفظ (F1)
                                </button>
                                <button
                                    onClick={() => handleCheckout(true)}
                                    disabled={activeInvoice.cart.length === 0}
                                    style={{
                                        flex: 1,
                                        padding: "16px", // Increased padding
                                        backgroundColor: activeInvoice.cart.length === 0 ? "#9ca3af" : "#10b981",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "6px",
                                        fontSize: "14px", // Increased font size slightly
                                        fontWeight: "bold",
                                        cursor: activeInvoice.cart.length === 0 ? "not-allowed" : "pointer",
                                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                    }}
                                >
                                    حفظ وطباعة (F2)
                                </button>
                                <button
                                    onClick={() => handleCheckout(false, true)}
                                    disabled={activeInvoice.cart.length === 0}

                                    style={{
                                        flex: 1,
                                        padding: "14px", // Increased padding
                                        backgroundColor: activeInvoice.cart.length === 0 ? "#9ca3af" : "#f59e0b",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "6px",
                                        fontSize: "14px", // Increased font size slightly
                                        fontWeight: "bold",
                                        cursor: activeInvoice.cart.length === 0 ? "not-allowed" : "pointer",
                                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                    }}
                                >
                                    حفظ ومعاينة (F3)
                                </button>

                            </div>
                        </div>

                        {/* Section 2: Middle Panel (Notes & Profit) */}
                        <div
                            style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                            }}
                        >
                            {/* Notes Input */}
                            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                                <label style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>ملاحظات:</label>
                                <textarea
                                    value={activeInvoice.notes}
                                    onChange={(e) => updateInvoice({ notes: e.target.value })}
                                    style={{
                                        flex: 1,
                                        width: "100%",
                                        padding: "8px",
                                        borderRadius: "6px",
                                        border: "1px solid #d1d5db",
                                        fontSize: "13px",
                                        resize: "none",
                                    }}
                                    placeholder="ملاحظات الفاتورة..."
                                />
                            </div>

                            {/* Profit Section & Balances (Side by Side) */}
                            <div style={{ display: "flex", gap: "10px" }}>
                                {/* Profit Section */}
                                <div
                                    style={{
                                        flex: 1,
                                        backgroundColor: "#dcfce7",
                                        border: "1px dashed #86efac",
                                        borderRadius: "6px",
                                        padding: "8px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        height: "80px", // Increased height to match balance card
                                    }}
                                >
                                    <button
                                        onClick={() => setShowInvoiceDetails(!showInvoiceDetails)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "5px",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "#166534",
                                            fontWeight: "bold",
                                            fontSize: "13px",
                                        }}
                                    >
                                        <span>👁️</span>
                                        <span>عرض الربح</span>
                                    </button>
                                    {showInvoiceDetails && (
                                        <span style={{ fontWeight: "bold", fontSize: "15px", color: "#15803d" }}>
                                            {calculations.profit.toFixed(2)}
                                        </span>
                                    )}
                                </div>

                                {/* Balances Card (Moved Here) */}
                                <div
                                    style={{
                                        flex: 1,
                                        backgroundColor: "white",
                                        padding: "8px",
                                        borderRadius: "8px",
                                        border: "1px solid #e5e7eb",
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "center",
                                        gap: "5px",
                                        height: "80px",
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontSize: "13px", color: "#6b7280" }}>الرصيد السابق :</span>
                                        <span style={{ fontSize: "13px", fontWeight: "bold", color: "#4b5563" }}>
                                            {activeInvoice.customer ? (activeInvoice.customer.balance || 0).toFixed(2) : "0.00"}
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "5px", borderTop: "1px dashed #e5e7eb" }}>
                                        <span style={{ fontSize: "13px", color: "#6b7280" }}>الرصيد الحالي :</span>
                                        <span style={{ fontSize: "13px", fontWeight: "bold", color: "#d97706" }}>
                                            {activeInvoice.customer
                                                ? ((activeInvoice.customer.balance || 0) + calculations.remaining).toFixed(2)
                                                : "---"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                </div>

                {/* Section 1: left Panel (Totals) - Now Last - 20% */}
                <div
                    style={{
                        flex: "0 0 20%",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                    }}
                >


                    {/* Invoice Totals Card */}
                    <div
                        style={{
                            backgroundColor: "white",
                            padding: "15px",
                            borderRadius: "8px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: "8px",
                        }}
                    >
                        {/* Subtotal */}
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "13px", color: "#6b7280" }}>الإجمالي:</span>
                            <span style={{ fontWeight: "bold" }}>{(calculations.subTotal - calculations.totalDiscount).toFixed(2)}</span>
                        </div>

                        {/* Discount Display */}
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#ef4444" }}>
                            <span style={{ fontSize: "13px" }}>الخصم:</span>
                            <span style={{ fontWeight: "bold" }}>- {calculations.billDiscount ? calculations.billDiscount.toFixed(2) : "0.00"}</span>
                        </div>

                        <div style={{ height: "1px", backgroundColor: "#e5e7eb", margin: "2px 0" }}></div>

                        {/* Net Total */}
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#111827" }}>الصافي:</span>
                            <span style={{ fontSize: "16px", fontWeight: "bold", color: "#111827" }}>{calculations.total.toFixed(2)}</span>
                        </div>

                        {/* Paid */}
                        <div style={{ display: "flex", justifyContent: "space-between", backgroundColor: "#f0fdf4", padding: "5px", borderRadius: "4px" }}>
                            <span style={{ fontSize: "13px", color: "#166534" }}>المدفوع:</span>
                            <span style={{ fontWeight: "bold", color: "#166534" }}>{calculations.paid.toFixed(2)}</span>
                        </div>

                        {/* Remaining */}
                        <div style={{ display: "flex", justifyContent: "space-between", backgroundColor: "#fef2f2", padding: "5px", borderRadius: "4px" }}>
                            <span style={{ fontSize: "13px", color: "#991b1b" }}>المتبقي:</span>
                            <span style={{ fontWeight: "bold", color: "#dc2626" }}>{calculations.remaining.toFixed(2)}</span>
                        </div>
                    </div>


                </div>
            </div>

            {/* === Modals === */}
            {/* Variant Selection Modal */}
            <VariantModal
                selectedProductForVariant={selectedProductForVariant}
                selectedVariantIndex={selectedVariantIndex}
                onClose={() => {
                    setSelectedProductForVariant(null);
                    setSelectedVariantIndex(-1);
                }}
                onSelectVariant={(variant) => {
                    addToCart(variant);
                    setSelectedProductForVariant(null);
                    setSelectedVariantIndex(-1);
                }}
                onVariantIndexChange={(index) => setSelectedVariantIndex(index)}
            />

            <NewCustomerModal
                isOpen={showNewCustomerModal}
                customer={newCustomer}
                onChange={setNewCustomer}
                onSave={handleAddCustomer}
                existingCustomers={customers}
                onClose={() => {
                    setShowNewCustomerModal(false);
                    setNewCustomer({
                        name: "",
                        phone: "",
                        phone2: "",
                        address: "",
                        city: "",
                        district: "",
                        notes: "",
                        creditLimit: 0,
                        customerType: "عادي",
                    });
                }}
                zIndex={1200}
            />

            {/* Product Details Modal */}
            {productDetailsModal.open && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        zIndex: 1100,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    onClick={() => setProductDetailsModal({ open: false, item: null })}
                >
                    <div
                        style={{
                            backgroundColor: "white",
                            borderRadius: "12px",
                            padding: "25px",
                            width: "400px",
                            boxShadow:
                                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                marginBottom: "20px",
                                borderBottom: "1px solid #e5e7eb",
                                paddingBottom: "10px",
                            }}
                        >
                            <h3 style={{ margin: 0, color: "#111827" }}>تفاصيل المنتج</h3>
                            <div
                                style={{ fontSize: "14px", color: "#6b7280", marginTop: "5px" }}
                            >
                                {productDetailsModal.item.productName}
                            </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "10px",
                                    backgroundColor: "#f9fafb",
                                    borderRadius: "8px",
                                }}
                            >
                                <span style={{ color: "#4b5563" }}>💰 سعر التكلفة:</span>
                                <span style={{ fontWeight: "bold", color: "#111827" }}>
                                    {(productDetailsModal.item.costPrice || 0).toFixed(2)}
                                </span>
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "10px",
                                    backgroundColor: "#f9fafb",
                                    borderRadius: "8px",
                                }}
                            >
                                <span style={{ color: "#4b5563" }}>🏷️ سعر البيع:</span>
                                <span style={{ fontWeight: "bold", color: "#111827" }}>
                                    {productDetailsModal.item.price.toFixed(2)}
                                </span>
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "10px",
                                    backgroundColor: "#ecfdf5",
                                    borderRadius: "8px",
                                    border: "1px solid #d1fae5",
                                }}
                            >
                                <span style={{ color: "#059669", fontWeight: "bold" }}>
                                    📈 الربح المتوقع:
                                </span>
                                <span style={{ fontWeight: "bold", color: "#059669" }}>
                                    {(
                                        (productDetailsModal.item.price -
                                            (productDetailsModal.item.costPrice || 0)) *
                                        productDetailsModal.item.quantity
                                    ).toFixed(2)}{" "}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginTop: "25px" }}>
                            <button
                                onClick={() => setProductDetailsModal({ open: false, item: null })}
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    backgroundColor: "#3b82f6",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    fontWeight: "bold",
                                }}
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Customer Ledger Modal */}
            {
                showCustomerLedger && (
                    <CustomerLedger
                        customerId={showCustomerLedger}
                        onClose={() => setShowCustomerLedger(null)}
                    />
                )
            }

            {/* Invoice Preview Modal */}
            {
                showInvoicePreview && previewData && (
                    <InvoicePreview
                        sale={previewData}
                        onClose={() => {
                            setShowInvoicePreview(false);
                            setPreviewData(null);
                        }}
                        onPrint={async () => {
                            try {
                                if (window.api.printSale) {
                                    await window.api.printSale(previewData.id);
                                } else {
                                    window.print();
                                }

                                setShowInvoicePreview(false);
                                setPreviewData(null);

                                setTimeout(() => {
                                    if (searchInputRef.current) searchInputRef.current.focus();
                                }, 100);
                            } catch (err) {
                                console.error(err);
                                showToast("خطأ: " + err.message, "error");
                            }
                        }}
                    />
                )
            }
        </div >
    );
}

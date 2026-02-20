import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { safeAlert, safeConfirm } from '../utils/safeAlert';
import { filterPosPaymentMethods } from '../utils/paymentMethodFilters';

// ─── Helpers ───
const toNumber = (val) => { const n = parseFloat(val); return isNaN(n) ? 0 : n; };
const generateId = () => `RET-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const RETURN_REASONS = [
    { value: 'defective', label: 'منتج تالف / معيب' },
    { value: 'wrong_item', label: 'خطأ في الطلب' },
    { value: 'changed_mind', label: 'العميل غيّر رأيه' },
    { value: 'expired', label: 'منتهي الصلاحية' },
    { value: 'size_issue', label: 'مقاس غير مناسب' },
    { value: 'other', label: 'أخرى' },
];

const createEmptySession = () => ({
    id: generateId(),
    cart: [],
    customerId: null,
    customerName: '',
    selectedSaleId: null,
    returnReason: '',
    returnNotes: '',
    refundMode: 'cashOut',
    paymentMethodId: '',
});

// ─── Toast ───
function Toast({ message, type = 'info', onClose }) {
    useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
    const bg = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    return (
        <div style={{ position: 'fixed', bottom: '30px', left: '30px', zIndex: 9999, padding: '12px 20px', borderRadius: '8px', color: 'white', backgroundColor: bg[type] || bg.info, fontSize: '14px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '400px', cursor: 'pointer' }} onClick={onClose}>
            <span>{icons[type]}</span><span>{message}</span>
        </div>
    );
}

// ─── Tab Component (Same style as EnhancedPOS InvoiceTab) ───
const ReturnTab = ({ session, isActive, onSelect, onClose, canClose }) => {
    const label = session.customerName ? `مرتجع: ${session.customerName}` : `مرتجع ${session.id.slice(-4)}`;
    const hasItems = session.cart && session.cart.length > 0;
    return (
        <div onClick={onSelect} style={{
            padding: '8px 15px', backgroundColor: isActive ? '#dc2626' : '#e5e7eb',
            color: isActive ? 'white' : '#374151', borderRadius: '8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px',
            justifyContent: 'space-between',
            boxShadow: isActive ? '0 4px 6px -1px rgba(220, 38, 38, 0.3)' : 'none',
            transition: 'all 0.2s'
        }}>
            <span style={{ fontSize: '13px' }}>
                {label}
                {hasItems && <span style={{ marginRight: '5px', fontSize: '11px', opacity: 0.8 }}>({session.cart.length})</span>}
            </span>
            {canClose && (
                <span onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ fontSize: '18px', lineHeight: '1', opacity: 0.7 }}>×</span>
            )}
        </div>
    );
};

// ─── Highlight Match ───
function highlightMatch(text, term) {
    if (!term || !text) return text;
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return text;
    return (<>{text.slice(0, idx)}<span style={{ backgroundColor: '#fef08a', fontWeight: 'bold' }}>{text.slice(idx, idx + term.length)}</span>{text.slice(idx + term.length)}</>);
}

export default function Returns() {
    // ─── Multi-Tab Sessions (localStorage persisted) ───
    const [sessions, setSessions] = useState(() => {
        try {
            const saved = localStorage.getItem('returns_sessions');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) { /* ignore */ }
        return [createEmptySession()];
    });

    const [activeSessionId, setActiveSessionId] = useState(() => {
        return localStorage.getItem('returns_activeId') || (sessions[0] ? sessions[0].id : '');
    });

    // ─── Persist to localStorage ───
    useEffect(() => {
        localStorage.setItem('returns_sessions', JSON.stringify(sessions));
        localStorage.setItem('returns_activeId', activeSessionId);
    }, [sessions, activeSessionId]);

    // ─── Active Session ───
    const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

    const updateSession = useCallback((updates) => {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, ...updates } : s));
    }, [activeSessionId]);

    // ─── Tab Management ───
    const addTab = () => {
        const newSession = createEmptySession();
        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newSession.id);
        showToast('تم فتح تبويب مرتجع جديد', 'info');
    };

    const closeTab = (sessionId) => {
        if (sessions.length === 1) { showToast('لا يمكن إغلاق التبويب الوحيد', 'warning'); return; }
        const newSessions = sessions.filter(s => s.id !== sessionId);
        setSessions(newSessions);
        if (activeSessionId === sessionId) {
            setActiveSessionId(newSessions[newSessions.length - 1].id);
        }
    };

    // ─── Global States ───
    const [loading, setLoading] = useState(true);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [toast, setToast] = useState(null);

    // ─── UI-only states (not persisted per tab) ───
    const searchInputRef = useRef(null);
    const customerDropdownRef = useRef(null);
    const customerListRef = useRef(null);
    const [barcodeMode, setBarcodeMode] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [showCustomerList, setShowCustomerList] = useState(false);
    const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);

    // ─── Derived from active session + customers ───
    const selectedCustomer = useMemo(() => {
        if (!activeSession?.customerId) return null;
        return customers.find(c => c.id === activeSession.customerId) || null;
    }, [activeSession?.customerId, customers]);

    const [customerSales, setCustomerSales] = useState([]);
    const [selectedSale, setSelectedSale] = useState(null);
    const [saleItems, setSaleItems] = useState([]);

    const showToast = useCallback((message, type = 'info') => { setToast({ message, type }); }, []);

    // Cart derived vals
    const cart = activeSession?.cart || [];
    const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.returnQty, 0), [cart]);
    const cartItemCount = useMemo(() => cart.reduce((s, i) => s + i.returnQty, 0), [cart]);

    // ─── Load Initial Data ───
    useEffect(() => { loadInitialData(); }, []);

    // ─── Keyboard Shortcuts ───
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'F1') { e.preventDefault(); document.getElementById('btn-confirm-return')?.click(); }
            else if (e.key === 'F3') { e.preventDefault(); setBarcodeMode(p => !p); }
            else if (e.key === 'F4') { e.preventDefault(); searchInputRef.current?.focus(); }
            else if (e.key === 'F5') { e.preventDefault(); const ci = document.querySelector('input[placeholder*="ابحث عن عميل"]'); if (ci) ci.focus(); }
            else if (e.key === 'Escape' && cart.length > 0) {
                e.preventDefault();
                safeConfirm('هل تريد إفراغ السلة؟').then(ok => { if (ok) { updateSession({ cart: [] }); showToast('تم إفراغ السلة', 'warning'); } });
            }
        };
        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [cart, updateSession]);

    // ─── Close customer dropdown on outside click ───
    useEffect(() => {
        const h = (e) => { if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) setShowCustomerList(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    useEffect(() => { setSelectedCustomerIndex(-1); }, [customerSearchTerm]);

    useEffect(() => {
        if (selectedCustomerIndex >= 0 && customerListRef.current) {
            const items = customerListRef.current.querySelectorAll('[data-customer-index]');
            if (items[selectedCustomerIndex]) items[selectedCustomerIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedCustomerIndex]);

    // ─── Reset UI when switching tabs ───
    useEffect(() => {
        setSearchTerm('');
        setCustomerSearchTerm('');
        setShowCustomerList(false);
        setSelectedSale(null);
        setSaleItems([]);
    }, [activeSessionId]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [custRes, methodsRes] = await Promise.all([window.api.getCustomers(), window.api.getPaymentMethods()]);
            if (!custRes?.error) setCustomers(Array.isArray(custRes) ? custRes : (custRes?.data || []));
            if (!methodsRes?.error) setPaymentMethods(filterPosPaymentMethods(methodsRes || []));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    // ─── Filtered Customers ───
    const filteredCustomers = useMemo(() => {
        if (!Array.isArray(customers)) return [];
        if (showCustomerList && !customerSearchTerm) return customers.slice(0, 50);
        if (!customerSearchTerm) return [];
        const t = customerSearchTerm.toLowerCase();
        return customers.filter(c => c.name.toLowerCase().includes(t) || c.phone?.includes(t)).slice(0, 20);
    }, [customers, customerSearchTerm, showCustomerList]);

    const handleCustomerKeyDown = (e) => {
        if (!showCustomerList || filteredCustomers.length === 0) return;
        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); setSelectedCustomerIndex(p => p < filteredCustomers.length - 1 ? p + 1 : p); break;
            case 'ArrowUp': e.preventDefault(); setSelectedCustomerIndex(p => p > 0 ? p - 1 : -1); break;
            case 'Enter':
                e.preventDefault();
                if (selectedCustomerIndex >= 0 && filteredCustomers[selectedCustomerIndex]) {
                    const c = filteredCustomers[selectedCustomerIndex];
                    updateSession({ customerId: c.id, customerName: c.name });
                    setCustomerSearchTerm(''); setShowCustomerList(false); setSelectedCustomerIndex(-1);
                }
                break;
            case 'Escape': e.preventDefault(); setShowCustomerList(false); setSelectedCustomerIndex(-1); break;
            default: break;
        }
    };

    // ─── Load Customer History ───
    useEffect(() => {
        const load = async () => {
            if (!activeSession?.customerId) { setCustomerSales([]); setSelectedSale(null); setSaleItems([]); return; }
            try {
                const sales = await window.api.getSales({ customerId: activeSession.customerId, limit: 20 });
                if (!sales?.error) setCustomerSales(sales);
            } catch (err) { console.error(err); }
        };
        load();
    }, [activeSession?.customerId]);

    // ─── Load Sale Items (with returned qty deduction) ───
    useEffect(() => {
        if (!selectedSale) { setSaleItems([]); return; }
        const returnedQtyMap = {};
        if (selectedSale.returns && Array.isArray(selectedSale.returns)) {
            for (const ret of selectedSale.returns) {
                if (ret.items && Array.isArray(ret.items)) {
                    for (const ri of ret.items) { returnedQtyMap[ri.variantId] = (returnedQtyMap[ri.variantId] || 0) + ri.quantity; }
                }
            }
        }
        setSaleItems(selectedSale.items.map(item => {
            const ar = returnedQtyMap[item.variantId] || 0;
            return {
                itemId: `${selectedSale.id}-${item.variantId}`, saleId: selectedSale.id, variantId: item.variantId,
                productName: item.variant?.product?.name || 'منتج محذوف', size: item.variant?.productSize || '-',
                color: item.variant?.color || '-', price: item.price, barcode: item.variant?.barcode || '',
                soldQty: item.quantity, alreadyReturned: ar, maxQuantity: Math.max(0, item.quantity - ar),
                dbSku: item.variant?.product?.sku || ''
            };
        }));
    }, [selectedSale]);

    const getInvoiceAgeDays = (sale) => Math.floor((new Date() - new Date(sale.createdAt)) / 86400000);

    // ─── Search ───
    const handleSearchSubmit = async (e) => {
        e.preventDefault();
        const term = searchTerm.trim();
        if (!term) return;
        setSearchLoading(true);
        try {
            if (selectedSale && saleItems.length > 0) {
                const m = saleItems.find(i => (i.barcode && String(i.barcode) === String(term)) || (i.dbSku && String(i.dbSku).toLowerCase() === String(term).toLowerCase()));
                if (m) {
                    if (m.maxQuantity <= 0) showToast('تم إرجاع كل الكمية مسبقاً', 'warning');
                    else addToCart(m);
                    setSearchTerm(''); setSearchLoading(false); searchInputRef.current?.focus(); return;
                }
            }
            const res = await window.api.getProducts({ searchTerm: term, limit: 10 });
            const products = Array.isArray(res) ? res : (res?.data || []);
            let mv = null;
            for (const p of products) { if (p.variants?.length > 0) { mv = p.variants.find(v => String(v.barcode) === String(term)); if (mv) { mv.product = p; break; } } }
            if (!mv && products.length === 1 && products[0].variants?.length > 0) { mv = products[0].variants[0]; mv.product = products[0]; }
            if (mv) {
                addToCart({ itemId: `free-${mv.id}`, saleId: null, variantId: mv.id, productName: mv.product.name, size: mv.productSize || '-', color: mv.color || '-', price: mv.price, maxQuantity: Infinity });
                setSearchTerm('');
            } else { showToast('لم يتم العثور على المنتج!', 'error'); }
        } catch (err) { console.error(err); }
        finally { setSearchLoading(false); if (barcodeMode) searchInputRef.current?.focus(); }
    };

    // ─── Cart (updates session) ───
    const addToCart = (item) => {
        const prev = activeSession.cart || [];
        const existing = prev.find(c => c.itemId === item.itemId);
        if (existing) {
            if (existing.returnQty >= item.maxQuantity) { showToast(`الحد الأقصى: ${item.maxQuantity}`, 'warning'); return; }
            updateSession({ cart: prev.map(c => c.itemId === item.itemId ? { ...c, returnQty: c.returnQty + 1 } : c) });
        } else {
            showToast(`+ ${item.productName}`, 'success');
            updateSession({ cart: [...prev, { ...item, returnQty: 1 }] });
        }
    };

    const updateCartQty = (itemId, val, maxQty) => {
        const q = parseInt(val) || 0;
        if (q < 1) return;
        if (q > maxQty && maxQty !== Infinity) { showToast(`الحد الأقصى: ${maxQty}`, 'warning'); return; }
        updateSession({ cart: cart.map(c => c.itemId === itemId ? { ...c, returnQty: q } : c) });
    };

    const updateCartPrice = (itemId, val) => {
        updateSession({ cart: cart.map(c => c.itemId === itemId ? { ...c, price: Math.max(0, toNumber(val)) } : c) });
    };

    const removeFromCart = (itemId) => { updateSession({ cart: cart.filter(c => c.itemId !== itemId) }); };

    // ─── Checkout ───
    const handleCheckout = async () => {
        if (cart.length === 0) { showToast('السلة فارغة!', 'warning'); return; }
        if (!activeSession.returnReason) { showToast('اختر سبب المرتجع!', 'error'); return; }
        const ok = await safeConfirm('هل أنت متأكد من حفظ المرتجع؟', 'تأكيد المرتجع');
        if (!ok) return;
        setLoading(true);
        const reasonLabel = RETURN_REASONS.find(r => r.value === activeSession.returnReason)?.label || activeSession.returnReason;
        const notesStr = activeSession.returnNotes ? `سبب: ${reasonLabel} | ${activeSession.returnNotes}` : `سبب: ${reasonLabel}`;
        const returnData = {
            saleId: cart.find(c => c.saleId)?.saleId || null,
            customerId: activeSession.customerId || null,
            total: cartTotal, notes: notesStr,
            items: cart.map(item => ({ variantId: item.variantId, quantity: item.returnQty, price: item.price }))
        };
        const rm = activeSession.refundMode;
        const pmId = activeSession.paymentMethodId;
        if (activeSession.customerId) {
            if (rm === 'cashOut') {
                if (!pmId) { showToast('اختر طريقة الدفع', 'error'); setLoading(false); return; }
                returnData.refundAmount = cartTotal; returnData.paymentMethodId = pmId; returnData.refundMode = 'CASH_ONLY';
            } else { returnData.refundAmount = 0; }
        } else {
            if (!pmId) { showToast('اختر طريقة الدفع', 'error'); setLoading(false); return; }
            returnData.refundAmount = cartTotal; returnData.paymentMethodId = pmId; returnData.refundMode = 'CASH_ONLY';
        }
        try {
            const res = await window.api.createReturn(returnData);
            if (res?.error) { await safeAlert('خطأ: ' + res.error); }
            else {
                const doPrint = await safeConfirm('تم الحفظ بنجاح! طباعة الإيصال؟', 'نجاح');
                if (doPrint) await window.api.printHTML({ html: buildReceiptHTML(res, reasonLabel), title: 'إيصال مرتجع' });
                showToast('✅ تم حفظ المرتجع', 'success');
                // Reset this session
                updateSession({ cart: [], returnReason: '', returnNotes: '', selectedSaleId: null });
                setSelectedSale(null);
                if (activeSession.customerId) {
                    const sales = await window.api.getSales({ customerId: activeSession.customerId, limit: 20 });
                    if (!sales?.error) setCustomerSales(sales);
                }
            }
        } catch (err) { console.error(err); await safeAlert('تعذر الحفظ'); }
        finally { setLoading(false); searchInputRef.current?.focus(); }
    };

    const buildReceiptHTML = (res, reasonLabel) => `<html dir="rtl"><head><title>إيصال مرتجع</title><style>body{font-family:'Segoe UI',Tahoma,sans-serif;padding:20px;font-size:14px;color:#000}.header{text-align:center;margin-bottom:20px;border-bottom:2px dashed #000;padding-bottom:15px}.title{font-size:20px;font-weight:bold;margin-bottom:5px}.info{margin-bottom:15px}.info div{display:flex;justify-content:space-between;padding:4px 0}table{width:100%;border-collapse:collapse;margin-bottom:20px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:right}th{background:#f8f9fa}.total{font-size:18px;font-weight:bold;text-align:left;margin-top:15px;border-top:2px dashed #000;padding-top:15px}.footer{text-align:center;margin-top:30px;font-size:12px;color:#555}</style></head><body><div class="header"><div class="title">إيصال مرتجع مبيعات</div><div>رقم: ${res.data?.id || '-'}</div><div>${new Date().toLocaleString('ar-EG')}</div></div><div class="info"><div><span>العميل:</span><span>${selectedCustomer ? selectedCustomer.name : 'عميل عابر'}</span></div><div><span>السبب:</span><span>${reasonLabel}</span></div><div><span>طريقة الرد:</span><span>${activeSession.refundMode === 'creditNote' ? 'إيداع في الرصيد' : 'نقدي'}</span></div></div><table><thead><tr><th>الصنف</th><th style="text-align:center">الكمية</th><th style="text-align:center">السعر</th><th style="text-align:left">الإجمالي</th></tr></thead><tbody>${cart.map(i => `<tr><td>${i.productName} (${i.size})</td><td style="text-align:center">${i.returnQty}</td><td style="text-align:center">${parseFloat(i.price).toFixed(2)}</td><td style="text-align:left">${(i.returnQty * i.price).toFixed(2)}</td></tr>`).join('')}</tbody></table><div class="total">إجمالي المرتجع: ${cartTotal.toFixed(2)} ج.م</div><div class="footer">شكراً لثقتكم بنا</div></body></html>`;

    if (loading && customers.length === 0) {
        return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9ca3af', fontSize: '18px', fontWeight: 'bold' }}><div><div style={{ fontSize: '48px', marginBottom: '10px', textAlign: 'center' }}>🔄</div><div>جاري التحميل...</div></div></div>);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden', padding: '15px', boxSizing: 'border-box' }}>
            <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
            {loading && (<div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner"></div></div>)}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* ========== Header & Tabs (Same as EnhancedPOS) ========== */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div className="hide-scrollbar" style={{ display: 'flex', gap: '5px', overflowX: 'auto', flex: 1, paddingBottom: '5px' }}>
                    {sessions.map(s => (
                        <ReturnTab key={s.id} session={s} isActive={activeSessionId === s.id} onSelect={() => setActiveSessionId(s.id)} onClose={() => closeTab(s.id)} canClose={sessions.length > 1} />
                    ))}
                    <button onClick={addTab} style={{ padding: '8px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>+</button>
                </div>
            </div>

            {/* ========== Main Content ========== */}
            <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>

                {/* ========== LEFT SIDE: Search & Invoice History ========== */}
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' }}>
                    {/* Search */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center' }}>
                        <input ref={searchInputRef} type="text" placeholder="🔍 ابحث عن منتج بالاسم أو الباركود..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSearchSubmit(e); }} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', flex: 1, minWidth: '200px' }} autoFocus />
                        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '4px' }}>
                            <button onClick={() => { setBarcodeMode(false); searchInputRef.current?.focus(); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: !barcodeMode ? 'white' : 'transparent', color: !barcodeMode ? '#3b82f6' : '#6b7280', cursor: 'pointer', fontWeight: 'bold', boxShadow: !barcodeMode ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s', fontSize: '13px' }}>📝 اسم</button>
                            <button onClick={() => { setBarcodeMode(true); searchInputRef.current?.focus(); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: barcodeMode ? 'white' : 'transparent', color: barcodeMode ? '#dc2626' : '#6b7280', cursor: 'pointer', fontWeight: 'bold', boxShadow: barcodeMode ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s', fontSize: '13px' }}>📦 باركود</button>
                        </div>
                    </div>

                    {/* Invoice History or Empty */}
                    {selectedCustomer ? (
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <div style={{ fontSize: '13px', color: '#4b5563', fontWeight: 'bold', marginBottom: '10px' }}>📋 سجل الفواتير ({customerSales.length})</div>
                            {customerSales.length === 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: '16px', fontWeight: 'bold', textAlign: 'center', padding: '40px' }}><div><div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div><div>لا يوجد فواتير سابقة</div></div></div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {customerSales.map(sale => {
                                        const ageDays = getInvoiceAgeDays(sale);
                                        const isOld = ageDays > 14;
                                        const isSel = selectedSale?.id === sale.id;
                                        return (
                                            <div key={sale.id} style={{ border: `2px solid ${isSel ? '#3b82f6' : '#e5e7eb'}`, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s', borderLeft: isSel ? '4px solid #3b82f6' : undefined }}>
                                                <div onClick={() => setSelectedSale(isSel ? null : sale)} style={{ padding: '10px 14px', backgroundColor: isSel ? '#eff6ff' : 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background-color 0.2s' }} onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = '#f9fafb'; }} onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = 'white'; }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontWeight: 'bold', color: isSel ? '#1e40af' : '#1f2937', fontSize: '13px' }}>فاتورة #{sale.id}</span>
                                                        <span style={{ fontSize: '11px', color: '#6b7280' }}>{new Date(sale.createdAt).toLocaleDateString('ar-EG')}</span>
                                                        {isOld && <span style={{ fontSize: '10px', backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px' }}>⚠️ {ageDays} يوم</span>}
                                                    </div>
                                                    <span style={{ fontWeight: 'bold', color: '#059669', fontSize: '13px' }}>{sale.total?.toFixed(2)} ج.م</span>
                                                </div>
                                                {isSel && (
                                                    <div style={{ backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                                                        {isOld && <div style={{ padding: '8px 14px', backgroundColor: '#fef3c7', fontSize: '12px', color: '#92400e', borderBottom: '1px solid #fde68a' }}>⚠️ فاتورة قديمة ({ageDays} يوم)</div>}
                                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                            <thead style={{ backgroundColor: '#f9fafb' }}><tr>
                                                                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', color: '#4b5563' }}>المنتج</th>
                                                                <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#4b5563' }}>البيع / المرتجع</th>
                                                                <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#4b5563' }}>السعر</th>
                                                                <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#4b5563' }}></th>
                                                            </tr></thead>
                                                            <tbody>
                                                                {saleItems.map(item => (
                                                                    <tr key={item.itemId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                                        <td style={{ padding: '8px 12px', fontSize: '13px' }}><div style={{ fontWeight: 'bold' }}>{item.productName}</div><div style={{ fontSize: '11px', color: '#6b7280' }}>{item.size} - {item.color}</div></td>
                                                                        <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px' }}>{item.soldQty}{item.alreadyReturned > 0 && <span style={{ color: '#ef4444', fontSize: '11px' }}> ({item.alreadyReturned} مرتجع)</span>}</td>
                                                                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#059669', fontWeight: 'bold', fontSize: '13px' }}>{item.price} ج.م</td>
                                                                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                                            {item.maxQuantity > 0 ? (
                                                                                <button onClick={(e) => { e.stopPropagation(); addToCart(item); }} style={{ padding: '5px 12px', backgroundColor: '#e0f2fe', border: '1px solid #93c5fd', color: '#1e40af', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bfdbfe'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}>+ إرجاع ({item.maxQuantity})</button>
                                                                            ) : <span style={{ fontSize: '11px', color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>✓ تم الإرجاع</span>}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#9ca3af', fontSize: '18px', fontWeight: 'bold', textAlign: 'center', padding: '40px' }}><div><div style={{ fontSize: '48px', marginBottom: '10px' }}>👤</div><div>اختر عميل لعرض فواتيره</div><div style={{ fontSize: '12px', marginTop: '10px', color: '#d1d5db' }}>أو ابحث بالباركود لمرتجع بدون فاتورة</div></div></div>
                    )}
                </div>

                {/* ========== RIGHT SIDE: Cart, Customer & Payment ========== */}
                <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '15px', overflow: 'hidden' }}>
                    {/* Customer Selection */}
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {!selectedCustomer ? (
                            <div ref={customerDropdownRef} style={{ display: 'flex', gap: '10px', position: 'relative' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                        <input type="text" placeholder="👤 ابحث عن عميل (الاسم أو الهاتف)..." value={customerSearchTerm} onChange={(e) => { setCustomerSearchTerm(e.target.value); setShowCustomerList(true); setSelectedCustomerIndex(-1); }} onFocus={() => setShowCustomerList(true)} onKeyDown={handleCustomerKeyDown} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', paddingLeft: '30px' }} />
                                        <button onClick={() => { setShowCustomerList(!showCustomerList); setCustomerSearchTerm(''); }} style={{ position: 'absolute', left: '10px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>▼</button>
                                    </div>
                                    {showCustomerList && filteredCustomers.length > 0 && (
                                        <div ref={customerListRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', marginTop: '5px', maxHeight: '200px', overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                            {filteredCustomers.map((customer, index) => (
                                                <div key={customer.id} data-customer-index={index} onClick={() => { updateSession({ customerId: customer.id, customerName: customer.name }); setCustomerSearchTerm(''); setShowCustomerList(false); setSelectedCustomerIndex(-1); }} style={{ padding: '10px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', backgroundColor: selectedCustomerIndex === index ? '#fef08a' : 'white', transition: 'background-color 0.2s' }} onMouseEnter={(e) => { setSelectedCustomerIndex(index); e.currentTarget.style.backgroundColor = '#fef08a'; }} onMouseLeave={(e) => { setSelectedCustomerIndex(-1); e.currentTarget.style.backgroundColor = 'white'; }}>
                                                    <span style={{ fontWeight: 'bold' }}>{highlightMatch(customer.name, customerSearchTerm)}</span>
                                                    <span style={{ color: '#6b7280', fontSize: '12px' }}>{highlightMatch(customer.phone || '', customerSearchTerm)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', padding: '10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                                <div>
                                    <span style={{ fontWeight: 'bold', color: '#1e40af' }}>{selectedCustomer.name}</span>
                                    <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '10px' }}>{selectedCustomer.phone}</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '13px', color: '#6b7280' }}>الرصيد: </span>
                                    <span style={{ fontWeight: 'bold', color: (selectedCustomer.balance || 0) > 0 ? '#dc2626' : '#059669', direction: 'ltr', display: 'inline-block' }}>{(selectedCustomer.balance || 0).toFixed(2)}</span>
                                </div>
                                <button onClick={() => { updateSession({ customerId: null, customerName: '' }); setCustomerSearchTerm(''); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '20px' }}>×</button>
                            </div>
                        )}
                    </div>

                    {/* Cart Table */}
                    <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
                                <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr>
                                        <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: '#4b5563' }}>المنتج</th>
                                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#4b5563' }}>السعر</th>
                                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#4b5563' }}>الكمية</th>
                                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#4b5563' }}>الإجمالي</th>
                                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#4b5563' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.length === 0 ? (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#9ca3af' }}>لا توجد منتجات في سلة المرتجع</td></tr>
                                    ) : cart.map(item => (
                                        <tr key={item.itemId} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background-color 0.2s' }}>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.productName}</div>
                                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                                    {item.size} - {item.color}
                                                    {item.saleId ? <span style={{ marginRight: '6px', backgroundColor: '#fef2f2', color: '#dc2626', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>فاتورة #{item.saleId}</span>
                                                        : <span style={{ marginRight: '6px', backgroundColor: '#f0fdf4', color: '#059669', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>سعر حالي</span>}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <input type="number" step="0.5" min="0" value={item.price || ''} onChange={(e) => updateCartPrice(item.itemId, e.target.value)} disabled={!!item.saleId} style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', textAlign: 'center', backgroundColor: item.saleId ? '#f9fafb' : 'white', color: item.saleId ? '#6b7280' : '#374151' }} onFocus={(e) => e.target.select()} />
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                    <button onClick={() => updateCartQty(item.itemId, item.returnQty - 1, item.maxQuantity)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#f9fafb', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                                                    <input type="number" min="1" value={item.returnQty || ''} onChange={(e) => updateCartQty(item.itemId, e.target.value, item.maxQuantity)} style={{ width: '50px', padding: '6px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', textAlign: 'center', fontWeight: 'bold' }} onFocus={(e) => e.target.select()} />
                                                    <button onClick={() => updateCartQty(item.itemId, item.returnQty + 1, item.maxQuantity)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#f9fafb', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                                                </div>
                                                {item.maxQuantity !== Infinity && <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '3px' }}>أقصى: {item.maxQuantity}</div>}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}><span style={{ color: '#059669', fontWeight: 'bold' }}>{(item.price * item.returnQty).toFixed(2)}</span></td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}><button onClick={() => removeFromCart(item.itemId)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}><i className="fas fa-trash" style={{ color: '#ef4444' }}></i></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========== Bottom Payment Bar ========== */}
            <div style={{ display: 'flex', gap: '15px', marginTop: '15px', alignItems: 'stretch' }}>
                <div style={{ flex: '0 0 80%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '15px', flex: 1 }}>
                        {/* Controls */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>سبب المرتجع: *</label>
                                    <select value={activeSession.returnReason} onChange={(e) => updateSession({ returnReason: e.target.value })} style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '14px', border: `1px solid ${!activeSession.returnReason && cart.length > 0 ? '#ef4444' : '#d1d5db'}`, backgroundColor: 'white', cursor: 'pointer' }}>
                                        <option value="">-- اختر السبب --</option>
                                        {RETURN_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>ملاحظات:</label>
                                    <input type="text" value={activeSession.returnNotes} onChange={(e) => updateSession({ returnNotes: e.target.value })} placeholder="ملاحظات إضافية..." style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {selectedCustomer && (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>طريقة الرد:</label>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <button onClick={() => updateSession({ refundMode: 'creditNote' })} style={{ flex: 1, padding: '11px', borderRadius: '6px', border: `2px solid ${activeSession.refundMode === 'creditNote' ? '#f59e0b' : '#e5e7eb'}`, backgroundColor: activeSession.refundMode === 'creditNote' ? '#fefce8' : 'white', color: activeSession.refundMode === 'creditNote' ? '#92400e' : '#374151', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>📝 إيداع بالرصيد</button>
                                            <button onClick={() => updateSession({ refundMode: 'cashOut' })} style={{ flex: 1, padding: '11px', borderRadius: '6px', border: `2px solid ${activeSession.refundMode === 'cashOut' ? '#10b981' : '#e5e7eb'}`, backgroundColor: activeSession.refundMode === 'cashOut' ? '#ecfdf5' : 'white', color: activeSession.refundMode === 'cashOut' ? '#047857' : '#374151', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>💵 إرجاع نقدي</button>
                                        </div>
                                    </div>
                                )}
                                {(!selectedCustomer || activeSession.refundMode === 'cashOut') && (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>الخزينة: *</label>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            {paymentMethods.map(pm => (
                                                <button key={pm.id} onClick={() => updateSession({ paymentMethodId: String(pm.id) })} style={{ flex: 1, padding: '11px', borderRadius: '6px', border: `2px solid ${String(activeSession.paymentMethodId) === String(pm.id) ? '#3b82f6' : '#e5e7eb'}`, backgroundColor: String(activeSession.paymentMethodId) === String(pm.id) ? '#eff6ff' : 'white', color: String(activeSession.paymentMethodId) === String(pm.id) ? '#1d4ed8' : '#374151', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>{pm.name}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button id="btn-confirm-return" onClick={handleCheckout} disabled={cart.length === 0} style={{ flex: 1, padding: '14px', backgroundColor: cart.length === 0 ? '#9ca3af' : '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: cart.length === 0 ? 'not-allowed' : 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>تأكيد المرتجع (F1)</button>
                                <button onClick={() => { updateSession({ cart: [] }); showToast('تم إفراغ السلة', 'warning'); }} disabled={cart.length === 0} style={{ padding: '14px 20px', backgroundColor: cart.length === 0 ? '#9ca3af' : '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: cart.length === 0 ? 'not-allowed' : 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>إفراغ (Esc)</button>
                            </div>
                        </div>

                        {/* Summary */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {selectedCustomer && (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ flex: 1, backgroundColor: '#f9fafb', borderRadius: '8px', padding: '10px', border: '1px solid #e5e7eb' }}>
                                        <div style={{ fontSize: '11px', color: '#6b7280' }}>الرصيد الحالي</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: (selectedCustomer.balance || 0) > 0 ? '#dc2626' : '#059669' }}>{toNumber(selectedCustomer.balance).toFixed(2)}</div>
                                    </div>
                                    <div style={{ flex: 1, backgroundColor: '#f9fafb', borderRadius: '8px', padding: '10px', border: '1px solid #e5e7eb' }}>
                                        <div style={{ fontSize: '11px', color: '#6b7280' }}>بعد المرتجع</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669' }}>{(toNumber(selectedCustomer.balance) - (activeSession.refundMode === 'creditNote' ? cartTotal : 0)).toFixed(2)}</div>
                                    </div>
                                </div>
                            )}
                            <div style={{ flex: 1, backgroundColor: '#fef2f2', borderRadius: '8px', padding: '15px', border: '2px solid #fecaca', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                                <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '5px' }}>إجمالي المرتجع</div>
                                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#dc2626' }}>{cartTotal.toFixed(2)}</div>
                                <div style={{ fontSize: '12px', color: '#6b7280' }}>{cartItemCount} وحدة · {cart.length} صنف</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{ flex: '0 0 20%' }}></div>
            </div>
        </div>
    );
}

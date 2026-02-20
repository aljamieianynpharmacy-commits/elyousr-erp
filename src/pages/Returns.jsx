import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { safeAlert, safeConfirm } from '../utils/safeAlert';
import { filterPosPaymentMethods } from '../utils/paymentMethodFilters';

const toNumber = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const genId = () => `R-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const REASONS = [
    { value: 'defective', label: 'منتج تالف / معيب' },
    { value: 'wrong_item', label: 'خطأ في الطلب' },
    { value: 'changed_mind', label: 'العميل غيّر رأيه' },
    { value: 'expired', label: 'منتهي الصلاحية' },
    { value: 'size_issue', label: 'مقاس غير مناسب' },
    { value: 'other', label: 'أخرى' },
];

const emptySession = () => ({ id: genId(), cart: [], customerId: null, customerName: '', selectedSaleId: null, returnReason: '', returnNotes: '', refundMode: 'cashOut', paymentMethodId: '', autoPrint: false });

// ─── Toast ───
function Toast({ message, type = 'info', onClose }) {
    useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose]);
    const bg = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    const ic = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    return <div style={{ position: 'fixed', bottom: 30, left: 30, zIndex: 9999, padding: '12px 20px', borderRadius: 8, color: '#fff', backgroundColor: bg[type] || bg.info, fontSize: 14, boxShadow: '0 4px 6px rgba(0,0,0,.1)', display: 'flex', alignItems: 'center', gap: 8, maxWidth: 400, cursor: 'pointer' }} onClick={onClose}><span>{ic[type]}</span><span>{message}</span></div>;
}

// ─── Tab ───
const ReturnTab = ({ session, isActive, onSelect, onClose, canClose }) => {
    const label = session.customerName ? `مرتجع: ${session.customerName}` : `مرتجع ${session.id.slice(-4)}`;
    const n = session.cart?.length || 0;
    return <div onClick={onSelect} style={{ padding: '8px 15px', backgroundColor: isActive ? '#dc2626' : '#e5e7eb', color: isActive ? '#fff' : '#374151', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, minWidth: 120, justifyContent: 'space-between', boxShadow: isActive ? '0 4px 6px -1px rgba(220,38,38,.3)' : 'none', transition: 'all .2s' }}>
        <span style={{ fontSize: 13 }}>{label}{n > 0 && <span style={{ marginRight: 5, fontSize: 11, opacity: .8 }}>({n})</span>}</span>
        {canClose && <span onClick={e => { e.stopPropagation(); onClose() }} style={{ fontSize: 18, lineHeight: '1', opacity: .7 }}>×</span>}
    </div>;
};

// ─── Highlight ───
function hl(text, term) { if (!term || !text) return text; const i = text.toLowerCase().indexOf(term.toLowerCase()); if (i === -1) return text; return <>{text.slice(0, i)}<span style={{ backgroundColor: '#fef08a', fontWeight: 'bold' }}>{text.slice(i, i + term.length)}</span>{text.slice(i + term.length)}</>; }

// ─── Confirmation Modal ───
function ConfirmModal({ cart, cartTotal, customer, reason, refundMode, onConfirm, onCancel }) {
    const reasonLabel = REASONS.find(r => r.value === reason)?.label || reason;
    return <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 25, width: 500, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <h3 style={{ margin: '0 0 15px', color: '#1f2937', fontSize: 18 }}>📋 ملخص المرتجع</h3>
            <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: '#6b7280' }}>العميل:</span><span style={{ fontWeight: 'bold' }}>{customer?.name || 'عميل عابر'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: '#6b7280' }}>السبب:</span><span style={{ fontWeight: 'bold' }}>{reasonLabel}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>طريقة الرد:</span><span style={{ fontWeight: 'bold' }}>{refundMode === 'creditNote' ? 'إيداع في الرصيد' : 'إرجاع نقدي'}</span></div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 15, fontSize: 13 }}>
                <thead><tr style={{ backgroundColor: '#f9fafb' }}><th style={{ padding: 8, textAlign: 'right' }}>الصنف</th><th style={{ padding: 8, textAlign: 'center' }}>الكمية</th><th style={{ padding: 8, textAlign: 'center' }}>السعر</th><th style={{ padding: 8, textAlign: 'left' }}>الإجمالي</th></tr></thead>
                <tbody>{cart.map(i => <tr key={i.itemId} style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: 8 }}>{i.productName} ({i.size})</td><td style={{ padding: 8, textAlign: 'center' }}>{i.returnQty}</td><td style={{ padding: 8, textAlign: 'center' }}>{parseFloat(i.price).toFixed(2)}</td><td style={{ padding: 8, textAlign: 'left', fontWeight: 'bold' }}>{(i.returnQty * i.price).toFixed(2)}</td></tr>)}</tbody>
            </table>
            <div style={{ backgroundColor: '#fef2f2', borderRadius: 8, padding: 12, textAlign: 'center', marginBottom: 20, border: '2px solid #fecaca' }}>
                <div style={{ fontSize: 12, color: '#991b1b' }}>إجمالي المرتجع</div>
                <div style={{ fontSize: 28, fontWeight: 'bold', color: '#dc2626' }}>{cartTotal.toFixed(2)} ج.م</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onConfirm} style={{ flex: 1, padding: 14, backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,.1)' }}>✅ تأكيد وحفظ</button>
                <button onClick={onCancel} style={{ flex: 1, padding: 14, backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15, fontWeight: 'bold', cursor: 'pointer' }}>إلغاء</button>
            </div>
        </div>
    </div>;
}

export default function Returns() {
    // ─── Sessions ───
    const [sessions, setSessions] = useState(() => { try { const s = localStorage.getItem('ret_s'); if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length > 0) return p; } } catch (e) { } return [emptySession()] });
    const [activeId, setActiveId] = useState(() => localStorage.getItem('ret_a') || (sessions[0] ? sessions[0].id : ''));
    useEffect(() => { localStorage.setItem('ret_s', JSON.stringify(sessions)); localStorage.setItem('ret_a', activeId) }, [sessions, activeId]);
    const sess = sessions.find(s => s.id === activeId) || sessions[0];
    const upd = useCallback((u) => setSessions(p => p.map(s => s.id === activeId ? { ...s, ...u } : s)), [activeId]);
    const addTab = () => { const n = emptySession(); setSessions(p => [...p, n]); setActiveId(n.id); showToast('تبويب جديد', 'info'); };
    const closeTab = (id) => { if (sessions.length === 1) return; const ns = sessions.filter(s => s.id !== id); setSessions(ns); if (activeId === id) setActiveId(ns[ns.length - 1].id); };

    // ─── Global ───
    const [loading, setLoading] = useState(true);
    const [paymentMethods, setPM] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [toast, setToast] = useState(null);
    const showToast = useCallback((m, t = 'info') => setToast({ message: m, type: t }), []);

    // ─── UI ───
    const searchRef = useRef(null);
    const custDDRef = useRef(null);
    const custListRef = useRef(null);
    const [barcodeMode, setBarcode] = useState(true);
    const [searchTerm, setSearch] = useState('');
    const [custSearch, setCustSearch] = useState('');
    const [showCustList, setShowCL] = useState(false);
    const [custIdx, setCustIdx] = useState(-1);
    const [showConfirm, setShowConfirm] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);

    const selCust = useMemo(() => sess?.customerId ? customers.find(c => c.id === sess.customerId) || null : null, [sess?.customerId, customers]);
    const [custSales, setCustSales] = useState([]);
    const [selSale, setSelSale] = useState(null);
    const [saleItems, setSaleItems] = useState([]);

    const cart = sess?.cart || [];
    const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.returnQty, 0), [cart]);
    const cartCount = useMemo(() => cart.reduce((s, i) => s + i.returnQty, 0), [cart]);

    // ─── Init ───
    useEffect(() => { (async () => { setLoading(true); try { const [c, m] = await Promise.all([window.api.getCustomers(), window.api.getPaymentMethods()]); if (!c?.error) setCustomers(Array.isArray(c) ? c : (c?.data || [])); if (!m?.error) setPM(filterPosPaymentMethods(m || [])); } catch (e) { console.error(e) } finally { setLoading(false) } })() }, []);

    // ─── Keys ───
    useEffect(() => { const h = (e) => { if (showConfirm) return; if (e.key === 'F1') { e.preventDefault(); handleCheckoutFlow(); } else if (e.key === 'F3') { e.preventDefault(); setBarcode(p => !p); } else if (e.key === 'F4') { e.preventDefault(); searchRef.current?.focus(); } else if (e.key === 'F5') { e.preventDefault(); const ci = document.querySelector('input[placeholder*="ابحث عن عميل"]'); if (ci) ci.focus(); } else if (e.key === 'Escape' && cart.length > 0) { e.preventDefault(); upd({ cart: [] }); showToast('تم إفراغ السلة', 'warning'); } }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h) }, [cart, showConfirm, upd]);

    // ─── Click outside ───
    useEffect(() => { const h = (e) => { if (custDDRef.current && !custDDRef.current.contains(e.target)) setShowCL(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, []);
    useEffect(() => { setCustIdx(-1) }, [custSearch]);
    useEffect(() => { if (custIdx >= 0 && custListRef.current) { const it = custListRef.current.querySelectorAll('[data-ci]'); if (it[custIdx]) it[custIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } }, [custIdx]);
    useEffect(() => { setSearch(''); setCustSearch(''); setShowCL(false); setSelSale(null); setSaleItems([]); setSearchResults([]); setShowSearchResults(false); }, [activeId]);

    // ─── Filtered Customers ───
    const filtCust = useMemo(() => { if (!Array.isArray(customers)) return []; if (showCustList && !custSearch) return customers.slice(0, 50); if (!custSearch) return []; const t = custSearch.toLowerCase(); return customers.filter(c => c.name.toLowerCase().includes(t) || c.phone?.includes(t)).slice(0, 20); }, [customers, custSearch, showCustList]);

    const handleCustKey = (e) => { if (!showCustList || filtCust.length === 0) return; if (e.key === 'ArrowDown') { e.preventDefault(); setCustIdx(p => p < filtCust.length - 1 ? p + 1 : p); } else if (e.key === 'ArrowUp') { e.preventDefault(); setCustIdx(p => p > 0 ? p - 1 : -1); } else if (e.key === 'Enter') { e.preventDefault(); if (custIdx >= 0 && filtCust[custIdx]) { const c = filtCust[custIdx]; upd({ customerId: c.id, customerName: c.name }); setCustSearch(''); setShowCL(false); setCustIdx(-1); } } else if (e.key === 'Escape') { e.preventDefault(); setShowCL(false); setCustIdx(-1); } };

    // ─── Customer history ───
    useEffect(() => { (async () => { if (!sess?.customerId) { setCustSales([]); setSelSale(null); setSaleItems([]); return; } try { const s = await window.api.getSales({ customerId: sess.customerId, limit: 20 }); if (!s?.error) setCustSales(s); } catch (e) { console.error(e) } })() }, [sess?.customerId]);

    // ─── Sale items ───
    useEffect(() => { if (!selSale) { setSaleItems([]); return; } const rMap = {}; if (selSale.returns && Array.isArray(selSale.returns)) for (const r of selSale.returns) if (r.items) for (const ri of r.items) rMap[ri.variantId] = (rMap[ri.variantId] || 0) + ri.quantity; setSaleItems(selSale.items.map(item => { const ar = rMap[item.variantId] || 0; return { itemId: `${selSale.id}-${item.variantId}`, saleId: selSale.id, variantId: item.variantId, productName: item.variant?.product?.name || 'محذوف', size: item.variant?.productSize || '-', color: item.variant?.color || '-', price: item.price, barcode: item.variant?.barcode || '', soldQty: item.quantity, alreadyReturned: ar, maxQuantity: Math.max(0, item.quantity - ar), dbSku: item.variant?.product?.sku || '' }; })); }, [selSale]);

    const ageDays = (s) => Math.floor((new Date() - new Date(s.createdAt)) / 86400000);

    // ─── Return progress for invoice ───
    const getReturnProgress = (sale) => { if (!sale.items || !sale.returns) return 0; let total = 0, returned = 0; for (const it of sale.items) total += it.quantity; if (sale.returns) for (const r of sale.returns) if (r.items) for (const ri of r.items) returned += ri.quantity; return total > 0 ? Math.round((returned / total) * 100) : 0; };

    // ─── Search with invoice# support + multi-result ───
    const handleSearchSubmit = async (e) => {
        e.preventDefault();
        const term = searchTerm.trim();
        if (!term) return;
        // Invoice number search: #123
        if (term.startsWith('#')) {
            const id = parseInt(term.slice(1));
            if (!id) { showToast('رقم فاتورة غير صالح', 'error'); return; }
            setLoading(true);
            try {
                const sale = await window.api.getSaleById(id);
                if (sale?.error) { showToast(sale.error, 'error'); } else {
                    // Auto-set customer
                    if (sale.customer) { upd({ customerId: sale.customer.id, customerName: sale.customer.name }); }
                    // Auto-set payment method
                    if (sale.paymentMethod) { upd({ paymentMethodId: String(sale.paymentMethod.id) }); }
                    setSelSale(sale);
                    setCustSales(prev => { const exists = prev.find(s => s.id === sale.id); return exists ? prev : [sale, ...prev]; });
                    showToast(`تم تحميل فاتورة #${id}`, 'success');
                }
            } catch (er) { console.error(er); showToast('خطأ في جلب الفاتورة', 'error'); }
            finally { setLoading(false); setSearch(''); searchRef.current?.focus(); }
            return;
        }
        // Product search
        setLoading(true);
        try {
            // Search in selected invoice first
            if (selSale && saleItems.length > 0) {
                const m = saleItems.find(i => (i.barcode && String(i.barcode) === term) || (i.dbSku && String(i.dbSku).toLowerCase() === term.toLowerCase()));
                if (m) { if (m.maxQuantity <= 0) showToast('تم إرجاع كل الكمية مسبقاً', 'warning'); else addToCart(m); setSearch(''); setLoading(false); searchRef.current?.focus(); playBeep(true); return; }
            }
            const res = await window.api.getProducts({ searchTerm: term, limit: 10 });
            const products = Array.isArray(res) ? res : (res?.data || []);
            // Exact barcode match
            let mv = null;
            for (const p of products) if (p.variants?.length > 0) { mv = p.variants.find(v => String(v.barcode) === term); if (mv) { mv.product = p; break; } }
            if (mv) { addToCart({ itemId: `free-${mv.id}`, saleId: null, variantId: mv.id, productName: mv.product.name, size: mv.productSize || '-', color: mv.color || '-', price: mv.price, maxQuantity: Infinity }); setSearch(''); playBeep(true); }
            else if (products.length === 1 && products[0].variants?.length === 1) {
                const v = products[0].variants[0];
                addToCart({ itemId: `free-${v.id}`, saleId: null, variantId: v.id, productName: products[0].name, size: v.productSize || '-', color: v.color || '-', price: v.price, maxQuantity: Infinity });
                setSearch(''); playBeep(true);
            } else if (products.length > 0) {
                // Show multi-result dropdown
                const results = [];
                for (const p of products) if (p.variants) for (const v of p.variants) results.push({ itemId: `free-${v.id}`, saleId: null, variantId: v.id, productName: p.name, size: v.productSize || '-', color: v.color || '-', price: v.price, barcode: v.barcode, maxQuantity: Infinity });
                setSearchResults(results.slice(0, 15));
                setShowSearchResults(true);
            } else { showToast('لم يتم العثور على المنتج!', 'error'); playBeep(false); }
        } catch (er) { console.error(er); }
        finally { setLoading(false); if (barcodeMode) searchRef.current?.focus(); }
    };

    // ─── Sound ───
    const playBeep = (success) => { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = success ? 800 : 300; g.gain.value = 0.15; o.start(); o.stop(ctx.currentTime + (success ? 0.1 : 0.3)); setTimeout(() => ctx.close(), 500); } catch (e) { } };

    // ─── Cart ───
    const addToCart = (item) => { const prev = sess.cart || []; const ex = prev.find(c => c.itemId === item.itemId); if (ex) { if (ex.returnQty >= item.maxQuantity) { showToast(`الحد الأقصى: ${item.maxQuantity}`, 'warning'); return; } upd({ cart: prev.map(c => c.itemId === item.itemId ? { ...c, returnQty: c.returnQty + 1 } : c) }); } else { showToast(`+ ${item.productName}`, 'success'); upd({ cart: [...prev, { ...item, returnQty: 1 }] }); } };
    const updQty = (id, val, max) => { const q = parseInt(val) || 0; if (q < 1) return; if (q > max && max !== Infinity) { showToast(`الحد الأقصى: ${max}`, 'warning'); return; } upd({ cart: cart.map(c => c.itemId === id ? { ...c, returnQty: q } : c) }); };
    const updPrice = (id, val) => upd({ cart: cart.map(c => c.itemId === id ? { ...c, price: Math.max(0, toNumber(val)) } : c) });
    const rmCart = (id) => upd({ cart: cart.filter(c => c.itemId !== id) });

    // ─── Return ALL items from invoice ───
    const returnAllItems = () => { if (!saleItems.length) return; let added = 0; const prev = [...(sess.cart || [])]; for (const item of saleItems) { if (item.maxQuantity <= 0) continue; const ex = prev.find(c => c.itemId === item.itemId); if (!ex) { prev.push({ ...item, returnQty: item.maxQuantity }); added++; } else if (ex.returnQty < item.maxQuantity) { ex.returnQty = item.maxQuantity; added++; } } upd({ cart: prev }); showToast(`تم إضافة ${added} صنف للسلة`, 'success'); };

    // ─── Checkout Flow (shows confirmation modal) ───
    const handleCheckoutFlow = () => { if (cart.length === 0) { showToast('السلة فارغة!', 'warning'); return; } if (!sess.returnReason) { showToast('اختر سبب المرتجع!', 'error'); return; } const rm = sess.refundMode; const pmId = sess.paymentMethodId; if ((!selCust || rm === 'cashOut') && !pmId) { showToast('اختر طريقة الدفع', 'error'); return; } setShowConfirm(true); };

    const doCheckout = async () => {
        setShowConfirm(false); setLoading(true);
        const rl = REASONS.find(r => r.value === sess.returnReason)?.label || sess.returnReason;
        const ns = sess.returnNotes ? `سبب: ${rl} | ${sess.returnNotes}` : `سبب: ${rl}`;
        const rd = { saleId: cart.find(c => c.saleId)?.saleId || null, customerId: sess.customerId || null, total: cartTotal, notes: ns, items: cart.map(i => ({ variantId: i.variantId, quantity: i.returnQty, price: i.price })) };
        if (sess.customerId) { if (sess.refundMode === 'cashOut') { rd.refundAmount = cartTotal; rd.paymentMethodId = sess.paymentMethodId; rd.refundMode = 'CASH_ONLY'; } else { rd.refundAmount = 0; } }
        else { rd.refundAmount = cartTotal; rd.paymentMethodId = sess.paymentMethodId; rd.refundMode = 'CASH_ONLY'; }
        try {
            const res = await window.api.createReturn(rd);
            if (res?.error) { await safeAlert('خطأ: ' + res.error); } else {
                if (sess.autoPrint) { await window.api.printHTML({ html: buildReceipt(res, rl), title: 'إيصال مرتجع' }); }
                else { const dp = await safeConfirm('تم الحفظ! طباعة؟', 'نجاح'); if (dp) await window.api.printHTML({ html: buildReceipt(res, rl), title: 'إيصال مرتجع' }); }
                showToast('✅ تم حفظ المرتجع', 'success'); playBeep(true);
                upd({ cart: [], returnReason: '', returnNotes: '', selectedSaleId: null }); setSelSale(null);
                if (sess.customerId) { const s = await window.api.getSales({ customerId: sess.customerId, limit: 20 }); if (!s?.error) setCustSales(s); }
            }
        } catch (er) { console.error(er); await safeAlert('تعذر الحفظ'); }
        finally { setLoading(false); searchRef.current?.focus(); }
    };

    const buildReceipt = (res, rl) => `<html dir="rtl"><head><style>body{font-family:'Segoe UI',Tahoma,sans-serif;padding:20px;font-size:14px}.header{text-align:center;margin-bottom:20px;border-bottom:2px dashed #000;padding-bottom:15px}.title{font-size:20px;font-weight:bold}.info div{display:flex;justify-content:space-between;padding:3px 0}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:right}th{background:#f8f9fa}.total{font-size:18px;font-weight:bold;text-align:left;border-top:2px dashed #000;padding-top:15px;margin-top:15px}.footer{text-align:center;margin-top:30px;font-size:12px;color:#555}</style></head><body><div class="header"><div class="title">إيصال مرتجع</div><div>رقم: ${res.data?.id || '-'}</div><div>${new Date().toLocaleString('ar-EG')}</div></div><div class="info"><div><span>العميل:</span><span>${selCust ? selCust.name : 'عميل عابر'}</span></div><div><span>السبب:</span><span>${rl}</span></div></div><table><thead><tr><th>الصنف</th><th style="text-align:center">كمية</th><th style="text-align:center">سعر</th><th style="text-align:left">إجمالي</th></tr></thead><tbody>${cart.map(i => `<tr><td>${i.productName} (${i.size})</td><td style="text-align:center">${i.returnQty}</td><td style="text-align:center">${parseFloat(i.price).toFixed(2)}</td><td style="text-align:left">${(i.returnQty * i.price).toFixed(2)}</td></tr>`).join('')}</tbody></table><div class="total">الإجمالي: ${cartTotal.toFixed(2)} ج.م</div><div class="footer">شكراً لثقتكم</div></body></html>`;

    if (loading && customers.length === 0) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9ca3af', fontSize: 18 }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 10 }}>🔄</div><div>جاري التحميل...</div></div></div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden', padding: 15, boxSizing: 'border-box' }}>
            <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
            {loading && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner"></div></div>}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {showConfirm && <ConfirmModal cart={cart} cartTotal={cartTotal} customer={selCust} reason={sess.returnReason} refundMode={sess.refundMode} onConfirm={doCheckout} onCancel={() => setShowConfirm(false)} />}

            {/* ═══ Tabs ═══ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <div className="hide-scrollbar" style={{ display: 'flex', gap: 5, overflowX: 'auto', flex: 1, paddingBottom: 5 }}>
                    {sessions.map(s => <ReturnTab key={s.id} session={s} isActive={activeId === s.id} onSelect={() => setActiveId(s.id)} onClose={() => closeTab(s.id)} canClose={sessions.length > 1} />)}
                    <button onClick={addTab} style={{ padding: '8px 12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 18, fontWeight: 'bold' }}>+</button>
                </div>
            </div>

            {/* ═══ Main ═══ */}
            <div style={{ display: 'flex', gap: 20, flex: 1, overflow: 'hidden' }}>
                {/* ── LEFT: Search + Invoices ── */}
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', backgroundColor: '#fff', padding: 15, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
                    {/* Search */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 15, alignItems: 'center', position: 'relative' }}>
                        <input ref={searchRef} type="text" placeholder="🔍 اكتب #رقم_فاتورة أو اسم/باركود منتج..." value={searchTerm} onChange={e => { setSearch(e.target.value); setShowSearchResults(false); }} onKeyDown={e => { if (e.key === 'Enter') handleSearchSubmit(e); if (e.key === 'Escape') { setShowSearchResults(false); setSearch(''); } }} style={{ padding: 12, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 16, flex: 1, minWidth: 200 }} autoFocus />
                        <div style={{ display: 'flex', gap: 4, backgroundColor: '#f3f4f6', borderRadius: 8, padding: 4 }}>
                            <button onClick={() => { setBarcode(false); searchRef.current?.focus(); }} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', backgroundColor: !barcodeMode ? '#fff' : 'transparent', color: !barcodeMode ? '#3b82f6' : '#6b7280', cursor: 'pointer', fontWeight: 'bold', boxShadow: !barcodeMode ? '0 1px 2px rgba(0,0,0,.1)' : 'none', transition: 'all .2s', fontSize: 13 }}>📝 اسم</button>
                            <button onClick={() => { setBarcode(true); searchRef.current?.focus(); }} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', backgroundColor: barcodeMode ? '#fff' : 'transparent', color: barcodeMode ? '#dc2626' : '#6b7280', cursor: 'pointer', fontWeight: 'bold', boxShadow: barcodeMode ? '0 1px 2px rgba(0,0,0,.1)' : 'none', transition: 'all .2s', fontSize: 13 }}>📦 باركود</button>
                        </div>
                        {/* Multi-result dropdown */}
                        {showSearchResults && searchResults.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 5, maxHeight: 250, overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 6px rgba(0,0,0,.1)' }}>
                            <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>اختر المنتج ({searchResults.length} نتيجة)</div>
                            {searchResults.map((r, i) => <div key={i} onClick={() => { addToCart(r); setShowSearchResults(false); setSearch(''); searchRef.current?.focus(); }} style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', transition: 'background .15s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f9ff'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                                <div><div style={{ fontWeight: 'bold', fontSize: 13 }}>{r.productName}</div><div style={{ fontSize: 11, color: '#6b7280' }}>{r.size} - {r.color} {r.barcode ? `| ${r.barcode}` : ''}</div></div>
                                <span style={{ fontWeight: 'bold', color: '#059669' }}>{r.price} ج.م</span>
                            </div>)}
                        </div>}
                    </div>

                    {/* Invoice History or Empty */}
                    {selCust ? (
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <div style={{ fontSize: 13, color: '#4b5563', fontWeight: 'bold', marginBottom: 10 }}>📋 سجل الفواتير ({custSales.length})</div>
                            {custSales.length === 0 ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 16, fontWeight: 'bold', textAlign: 'center', padding: 40 }}><div><div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>لا يوجد فواتير</div></div>
                                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{custSales.map(sale => {
                                    const ag = ageDays(sale), old = ag > 14, isSel = selSale?.id === sale.id, prog = getReturnProgress(sale);
                                    return <div key={sale.id} style={{ border: `2px solid ${isSel ? '#3b82f6' : '#e5e7eb'}`, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', transition: 'all .2s', borderLeft: isSel ? '4px solid #3b82f6' : undefined }}>
                                        <div onClick={() => { setSelSale(isSel ? null : sale); if (!isSel && sale.paymentMethod) upd({ paymentMethodId: String(sale.paymentMethod.id) }); }} style={{ padding: '10px 14px', backgroundColor: isSel ? '#eff6ff' : '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background .2s' }} onMouseEnter={e => { if (!isSel) e.currentTarget.style.backgroundColor = '#f9fafb' }} onMouseLeave={e => { if (!isSel) e.currentTarget.style.backgroundColor = '#fff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                                                <span style={{ fontWeight: 'bold', color: isSel ? '#1e40af' : '#1f2937', fontSize: 13 }}>#{sale.id}</span>
                                                <span style={{ fontSize: 11, color: '#6b7280' }}>{new Date(sale.createdAt).toLocaleDateString('ar-EG')}</span>
                                                {old && <span style={{ fontSize: 10, backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 4 }}>⚠️ {ag} يوم</span>}
                                                {prog > 0 && <div style={{ flex: 1, maxWidth: 80, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginRight: 5 }}><div style={{ width: `${prog}%`, height: '100%', backgroundColor: prog >= 100 ? '#10b981' : '#f59e0b', borderRadius: 3, transition: 'width .3s' }} /></div>}
                                                {prog > 0 && <span style={{ fontSize: 10, color: prog >= 100 ? '#10b981' : '#f59e0b' }}>{prog}%</span>}
                                            </div>
                                            <span style={{ fontWeight: 'bold', color: '#059669', fontSize: 13 }}>{sale.total?.toFixed(2)}</span>
                                        </div>
                                        {isSel && <div style={{ backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                                            {old && <div style={{ padding: '8px 14px', backgroundColor: '#fef3c7', fontSize: 12, color: '#92400e', borderBottom: '1px solid #fde68a' }}>⚠️ فاتورة قديمة ({ag} يوم)</div>}
                                            <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'flex-end' }}><button onClick={e => { e.stopPropagation(); returnAllItems(); }} style={{ padding: '5px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>↩ إرجاع كل الفاتورة</button></div>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead style={{ backgroundColor: '#f9fafb' }}><tr><th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#4b5563' }}>المنتج</th><th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: '#4b5563' }}>بيع/مرتجع</th><th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: '#4b5563' }}>سعر</th><th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: '#4b5563' }}></th></tr></thead>
                                                <tbody>{saleItems.map(it => <tr key={it.itemId} style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '8px 12px', fontSize: 13 }}><div style={{ fontWeight: 'bold' }}>{it.productName}</div><div style={{ fontSize: 11, color: '#6b7280' }}>{it.size} - {it.color}</div></td><td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12 }}>{it.soldQty}{it.alreadyReturned > 0 && <span style={{ color: '#ef4444', fontSize: 11 }}> ({it.alreadyReturned}↩)</span>}</td><td style={{ padding: '8px 12px', textAlign: 'center', color: '#059669', fontWeight: 'bold', fontSize: 13 }}>{it.price}</td><td style={{ padding: '8px 12px', textAlign: 'center' }}>{it.maxQuantity > 0 ? <button onClick={e => { e.stopPropagation(); addToCart(it); }} style={{ padding: '5px 12px', backgroundColor: '#e0f2fe', border: '1px solid #93c5fd', color: '#1e40af', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', transition: 'all .2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#bfdbfe'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#e0f2fe'}>+ ({it.maxQuantity})</button> : <span style={{ fontSize: 11, color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>✓ تم</span>}</td></tr>)}</tbody></table>
                                        </div>}
                                    </div>;
                                })}</div>}
                        </div>
                    ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#9ca3af', fontSize: 18, fontWeight: 'bold', textAlign: 'center', padding: 40 }}><div><div style={{ fontSize: 48, marginBottom: 10 }}>👤</div><div>اختر عميل أو اكتب <span style={{ color: '#3b82f6' }}>#رقم_فاتورة</span></div><div style={{ fontSize: 12, marginTop: 10, color: '#d1d5db' }}>مثال: #1234</div></div></div>}
                </div>

                {/* ── RIGHT: Cart + Customer ── */}
                <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: 15, overflow: 'hidden' }}>
                    {/* Customer */}
                    <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 15, boxShadow: '0 1px 3px rgba(0,0,0,.1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {!selCust ? <div ref={custDDRef} style={{ display: 'flex', gap: 10, position: 'relative' }}><div style={{ flex: 1, position: 'relative' }}><div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}><input type="text" placeholder="👤 ابحث عن عميل (الاسم أو الهاتف)..." value={custSearch} onChange={e => { setCustSearch(e.target.value); setShowCL(true); setCustIdx(-1); }} onFocus={() => setShowCL(true)} onKeyDown={handleCustKey} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #d1d5db', paddingLeft: 30 }} /><button onClick={() => { setShowCL(!showCustList); setCustSearch(''); }} style={{ position: 'absolute', left: 10, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>▼</button></div>
                            {showCustList && filtCust.length > 0 && <div ref={custListRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 5, maxHeight: 200, overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 6px rgba(0,0,0,.1)' }}>{filtCust.map((c, i) => <div key={c.id} data-ci={i} onClick={() => { upd({ customerId: c.id, customerName: c.name }); setCustSearch(''); setShowCL(false); setCustIdx(-1); }} style={{ padding: 10, borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', backgroundColor: custIdx === i ? '#fef08a' : '#fff', transition: 'background .2s' }} onMouseEnter={e => { setCustIdx(i); e.currentTarget.style.backgroundColor = '#fef08a' }} onMouseLeave={e => { setCustIdx(-1); e.currentTarget.style.backgroundColor = '#fff' }}><span style={{ fontWeight: 'bold' }}>{hl(c.name, custSearch)}</span><span style={{ color: '#6b7280', fontSize: 12 }}>{hl(c.phone || '', custSearch)}</span></div>)}</div>}
                        </div></div>
                            : <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', padding: 10, borderRadius: 8, border: '1px solid #bfdbfe' }}><div><span style={{ fontWeight: 'bold', color: '#1e40af' }}>{selCust.name}</span><span style={{ fontSize: 12, color: '#6b7280', marginRight: 10 }}>{selCust.phone}</span></div><div><span style={{ fontSize: 13, color: '#6b7280' }}>الرصيد: </span><span style={{ fontWeight: 'bold', color: (selCust.balance || 0) > 0 ? '#dc2626' : '#059669' }}>{(selCust.balance || 0).toFixed(2)}</span></div><button onClick={() => { upd({ customerId: null, customerName: '' }); setCustSearch(''); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 20 }}>×</button></div>}
                    </div>

                    {/* Cart */}
                    <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                                <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0, zIndex: 10 }}><tr><th style={{ padding: 12, textAlign: 'right', fontSize: 13, color: '#4b5563' }}>المنتج</th><th style={{ padding: 12, textAlign: 'center', fontSize: 13, color: '#4b5563' }}>السعر</th><th style={{ padding: 12, textAlign: 'center', fontSize: 13, color: '#4b5563' }}>الكمية</th><th style={{ padding: 12, textAlign: 'center', fontSize: 13, color: '#4b5563' }}>الإجمالي</th><th style={{ padding: 12, textAlign: 'center', fontSize: 13, color: '#4b5563' }}></th></tr></thead>
                                <tbody>
                                    {cart.length === 0 ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: 30, color: '#9ca3af' }}>لا توجد منتجات في سلة المرتجع</td></tr>
                                        : cart.map(item => <tr key={item.itemId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: 12 }}><div style={{ fontWeight: 'bold', fontSize: 14 }}>{item.productName}</div><div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{item.size} - {item.color} {item.saleId ? <span style={{ marginRight: 6, backgroundColor: '#fef2f2', color: '#dc2626', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>#{item.saleId}</span> : <span style={{ marginRight: 6, backgroundColor: '#f0fdf4', color: '#059669', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>حالي</span>}</div></td>
                                            <td style={{ padding: 12, textAlign: 'center' }}><input type="number" step="0.5" min="0" value={item.price || ''} onChange={e => updPrice(item.itemId, e.target.value)} disabled={!!item.saleId} style={{ width: 80, padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, textAlign: 'center', backgroundColor: item.saleId ? '#f9fafb' : '#fff' }} onFocus={e => e.target.select()} /></td>
                                            <td style={{ padding: 12, textAlign: 'center' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><button onClick={() => updQty(item.itemId, item.returnQty - 1, item.maxQuantity)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #d1d5db', backgroundColor: '#f9fafb', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button><input type="number" min="1" value={item.returnQty || ''} onChange={e => updQty(item.itemId, e.target.value, item.maxQuantity)} style={{ width: 50, padding: 6, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, textAlign: 'center', fontWeight: 'bold' }} onFocus={e => e.target.select()} /><button onClick={() => updQty(item.itemId, item.returnQty + 1, item.maxQuantity)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #d1d5db', backgroundColor: '#f9fafb', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button></div>{item.maxQuantity !== Infinity && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>أقصى: {item.maxQuantity}</div>}</td>
                                            <td style={{ padding: 12, textAlign: 'center' }}><span style={{ color: '#059669', fontWeight: 'bold' }}>{(item.price * item.returnQty).toFixed(2)}</span></td>
                                            <td style={{ padding: 12, textAlign: 'center' }}><button onClick={() => rmCart(item.itemId)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button></td>
                                        </tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ Bottom Bar ═══ */}
            <div style={{ display: 'flex', gap: 15, marginTop: 15, alignItems: 'stretch' }}>
                <div style={{ flex: '0 0 80%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 15, flex: 1 }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>سبب المرتجع: *</label><select value={sess.returnReason} onChange={e => upd({ returnReason: e.target.value })} style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 14, border: `1px solid ${!sess.returnReason && cart.length > 0 ? '#ef4444' : '#d1d5db'}`, backgroundColor: '#fff', cursor: 'pointer' }}><option value="">-- اختر --</option>{REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>ملاحظات:</label><input type="text" value={sess.returnNotes} onChange={e => upd({ returnNotes: e.target.value })} placeholder="ملاحظات..." style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} /></div>
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                {selCust && <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>طريقة الرد:</label><div style={{ display: 'flex', gap: 5 }}><button onClick={() => upd({ refundMode: 'creditNote' })} style={{ flex: 1, padding: 11, borderRadius: 6, border: `2px solid ${sess.refundMode === 'creditNote' ? '#f59e0b' : '#e5e7eb'}`, backgroundColor: sess.refundMode === 'creditNote' ? '#fefce8' : '#fff', color: sess.refundMode === 'creditNote' ? '#92400e' : '#374151', fontWeight: 'bold', fontSize: 13, cursor: 'pointer', transition: 'all .2s' }}>📝 رصيد</button><button onClick={() => upd({ refundMode: 'cashOut' })} style={{ flex: 1, padding: 11, borderRadius: 6, border: `2px solid ${sess.refundMode === 'cashOut' ? '#10b981' : '#e5e7eb'}`, backgroundColor: sess.refundMode === 'cashOut' ? '#ecfdf5' : '#fff', color: sess.refundMode === 'cashOut' ? '#047857' : '#374151', fontWeight: 'bold', fontSize: 13, cursor: 'pointer', transition: 'all .2s' }}>💵 نقدي</button></div></div>}
                                {(!selCust || sess.refundMode === 'cashOut') && <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>الخزينة: *</label><div style={{ display: 'flex', gap: 5 }}>{paymentMethods.map(pm => <button key={pm.id} onClick={() => upd({ paymentMethodId: String(pm.id) })} style={{ flex: 1, padding: 11, borderRadius: 6, border: `2px solid ${String(sess.paymentMethodId) === String(pm.id) ? '#3b82f6' : '#e5e7eb'}`, backgroundColor: String(sess.paymentMethodId) === String(pm.id) ? '#eff6ff' : '#fff', color: String(sess.paymentMethodId) === String(pm.id) ? '#1d4ed8' : '#374151', fontWeight: 'bold', fontSize: 13, cursor: 'pointer', transition: 'all .2s' }}>{pm.name}</button>)}</div></div>}
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <button id="btn-confirm-return" onClick={handleCheckoutFlow} disabled={cart.length === 0} style={{ flex: 1, padding: 14, backgroundColor: cart.length === 0 ? '#9ca3af' : '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 'bold', cursor: cart.length === 0 ? 'not-allowed' : 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,.1)' }}>تأكيد المرتجع (F1)</button>
                                <button onClick={() => { upd({ cart: [] }); showToast('تم الإفراغ', 'warning'); }} disabled={cart.length === 0} style={{ padding: '14px 20px', backgroundColor: cart.length === 0 ? '#9ca3af' : '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 'bold', cursor: cart.length === 0 ? 'not-allowed' : 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,.1)' }}>إفراغ</button>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}><input type="checkbox" checked={sess.autoPrint || false} onChange={e => upd({ autoPrint: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#3b82f6' }} />طباعة تلقائية</label>
                            </div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {selCust && <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1, backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, border: '1px solid #e5e7eb' }}><div style={{ fontSize: 11, color: '#6b7280' }}>الرصيد الحالي</div><div style={{ fontSize: 18, fontWeight: 'bold', color: (selCust.balance || 0) > 0 ? '#dc2626' : '#059669' }}>{toNumber(selCust.balance).toFixed(2)}</div></div><div style={{ flex: 1, backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, border: '1px solid #e5e7eb' }}><div style={{ fontSize: 11, color: '#6b7280' }}>بعد المرتجع</div><div style={{ fontSize: 18, fontWeight: 'bold', color: '#059669' }}>{(toNumber(selCust.balance) - (sess.refundMode === 'creditNote' ? cartTotal : 0)).toFixed(2)}</div></div></div>}
                            <div style={{ flex: 1, backgroundColor: '#fef2f2', borderRadius: 8, padding: 15, border: '2px solid #fecaca', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}><div style={{ fontSize: 12, color: '#991b1b', marginBottom: 5 }}>إجمالي المرتجع</div><div style={{ fontSize: 32, fontWeight: 'bold', color: '#dc2626' }}>{cartTotal.toFixed(2)}</div><div style={{ fontSize: 12, color: '#6b7280' }}>{cartCount} وحدة · {cart.length} صنف</div></div>
                        </div>
                    </div>
                </div>
                <div style={{ flex: '0 0 20%' }}></div>
            </div>
        </div>
    );
}

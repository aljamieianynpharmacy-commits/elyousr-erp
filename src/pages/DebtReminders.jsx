import React, { useState, useEffect } from 'react';

export default function DebtReminders() {
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPaymentPlan, setShowPaymentPlan] = useState(false);
    const [paymentPlan, setPaymentPlan] = useState({
        installments: 3,
        startDate: new Date().toISOString().split('T')[0],
        notes: ''
    });

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            const data = await window.api.getCustomers();
            if (!data.error) {
                // ترتيب حسب الديون الأعلى
                const debtors = data
                    .filter(c => c.balance > 0)
                    .sort((a, b) => b.balance - a.balance);
                setCustomers(debtors);
            }
        } catch (err) {
            console.error('فشل تحميل العملاء');
        } finally {
            setLoading(false);
        }
    };

    const getDaysOverdue = (lastPurchaseDate) => {
        if (!lastPurchaseDate) return 0;
        const today = new Date();
        const lastDate = new Date(lastPurchaseDate);
        const diffTime = Math.abs(today - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const getUrgencyLevel = (balance, daysOverdue) => {
        if (balance > 10000 || daysOverdue > 60) return { level: 'عاجل جداً', color: '#ef4444', bg: '#fee2e2' };
        if (balance > 5000 || daysOverdue > 30) return { level: 'عاجل', color: '#f59e0b', bg: '#fef3c7' };
        if (balance > 2000 || daysOverdue > 15) return { level: 'متوسط', color: '#3b82f6', bg: '#dbeafe' };
        return { level: 'عادي', color: '#10b981', bg: '#d1fae5' };
    };

    const generatePaymentPlan = (customer) => {
        setSelectedCustomer(customer);
        setShowPaymentPlan(true);
    };

    const calculateInstallments = () => {
        if (!selectedCustomer) return [];

        const { balance } = selectedCustomer;
        const { installments, startDate } = paymentPlan;

        const installmentAmount = balance / installments;
        const plans = [];

        for (let i = 0; i < installments; i++) {
            const dueDate = new Date(startDate);
            dueDate.setDate(dueDate.getDate() + (i * 30)); // كل 30 يوم

            plans.push({
                number: i + 1,
                amount: installmentAmount,
                dueDate: dueDate.toLocaleDateString('ar-EG'),
                status: 'مستحق'
            });
        }

        return plans;
    };

    const printPaymentPlan = () => {
        const plans = calculateInstallments();
        const printWindow = window.open('', '_blank');
        const html = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>جدول سداد - ${selectedCustomer?.name}</title>
        <style>
          body { font-family: Arial; padding: 20px; direction: rtl; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .info { background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #000; padding: 10px; text-align: right; }
          th { background-color: #f0f0f0; }
          .total { font-size: 18px; font-weight: bold; text-align: left; margin-top: 20px; padding: 15px; background: #f0fdf4; border-radius: 8px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⚡ ERP SYSTEM</h1>
          <h2>جدول سداد مقترح</h2>
        </div>
        
        <div class="info">
          <h3>بيانات العميل:</h3>
          <p><strong>الاسم:</strong> ${selectedCustomer?.name}</p>
          <p><strong>الهاتف:</strong> ${selectedCustomer?.phone || '-'}</p>
          <p><strong>إجمالي الدين:</strong> ${selectedCustomer?.balance.toFixed(2)} ج.م</p>
          <p><strong>التقييم:</strong> ${selectedCustomer?.rating ? '⭐'.repeat(Math.round(selectedCustomer.rating)) : '-'}</p>
          <p><strong>تاريخ الجدول:</strong> ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>القسط</th>
              <th>المبلغ</th>
              <th>تاريخ الاستحقاق</th>
              <th>الحالة</th>
              <th>التوقيع</th>
            </tr>
          </thead>
          <tbody>
            ${plans.map(plan => `
              <tr>
                <td>القسط ${plan.number}</td>
                <td>${plan.amount.toFixed(2)} ج.م</td>
                <td>${plan.dueDate}</td>
                <td>${plan.status}</td>
                <td style="width: 150px;"></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="total">
          <p><strong>إجمالي المبلغ:</strong> ${selectedCustomer?.balance.toFixed(2)} ج.م</p>
          <p><strong>عدد الأقساط:</strong> ${paymentPlan.installments}</p>
          <p><strong>قيمة القسط:</strong> ${(selectedCustomer?.balance / paymentPlan.installments).toFixed(2)} ج.م</p>
        </div>
        
        <div style="margin-top: 50px; display: flex; justify-content: space-between;">
          <div style="text-align: center;">
            <p>توقيع العميل</p>
            <p>_________________</p>
          </div>
          <div style="text-align: center;">
            <p>توقيع الإدارة</p>
            <p>_________________</p>
          </div>
        </div>
        
        <p style="text-align: center; font-size: 12px; color: #6b7280; margin-top: 30px;">
          تم الطباعة في: ${new Date().toLocaleString('ar-EG')}
        </p>
        
        <button onclick="window.print()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; cursor: pointer; border-radius: 5px; margin-top: 20px;">طباعة</button>
      </body>
      </html>
    `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const sendWhatsAppReminder = (customer) => {
        const daysOverdue = getDaysOverdue(customer.lastPurchaseDate);
        const message = encodeURIComponent(
            `السلام عليكم ${customer.name}\n\n` +
            `تذكير ودي بخصوص رصيدكم لدينا:\n` +
            `💰 المبلغ: ${customer.balance.toFixed(2)} ج.م\n` +
            `📅 مضى على آخر عملية شراء: ${daysOverdue} يوم\n\n` +
            `نرجو منكم التكرم بالسداد في أقرب وقت ممكن.\n` +
            `أو التواصل معنا لترتيب جدول سداد مناسب.\n\n` +
            `شكراً لتعاونكم 🙏`
        );

        if (customer.phone) {
            const phone = customer.phone.replace(/[^0-9]/g, '');
            window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
        } else {
            alert('لا يوجد رقم هاتف مسجل للعميل');
        }
    };

    if (loading) return <div>جاري التحميل...</div>;

    return (
        <div>
            <h1 style={{ marginBottom: '20px' }}>⚠️ تذكيرات الديون وجداول السداد</h1>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', backgroundColor: '#fee2e2' }}>
                    <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>إجمالي الديون</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                        {customers.reduce((sum, c) => sum + c.balance, 0).toFixed(2)} ج.م
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', backgroundColor: '#fef3c7' }}>
                    <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>عدد العملاء المدينين</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                        {customers.length}
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', backgroundColor: '#fee2e2' }}>
                    <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>ديون عاجلة ({'>'}10,000)</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                        {customers.filter(c => c.balance > 10000).length}
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', backgroundColor: '#dbeafe' }}>
                    <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>متوسط الدين</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                        {customers.length > 0 ? (customers.reduce((sum, c) => sum + c.balance, 0) / customers.length).toFixed(2) : '0.00'} ج.م
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                        <tr>
                            <th style={{ padding: '15px', textAlign: 'right' }}>العميل</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>التقييم</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>المبلغ المستحق</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>آخر شراء</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>الأولوية</th>
                            <th style={{ padding: '15px', textAlign: 'center' }}>إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>
                                    🎉 لا توجد ديون! جميع العملاء سددوا
                                </td>
                            </tr>
                        ) : (
                            customers.map((customer) => {
                                const daysOverdue = getDaysOverdue(customer.lastPurchaseDate);
                                const urgency = getUrgencyLevel(customer.balance, daysOverdue);

                                return (
                                    <tr key={customer.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '15px' }}>
                                            <div style={{ fontWeight: 'bold' }}>{customer.name}</div>
                                            <div style={{ fontSize: '12px', color: '#6b7280' }}>{customer.phone || '-'}</div>
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            <div style={{ color: '#f59e0b', fontSize: '16px' }}>
                                                {'⭐'.repeat(Math.round(customer.rating || 0))}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                                {customer.rating ? customer.rating.toFixed(1) : '0.0'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#ef4444' }}>
                                                {customer.balance.toFixed(2)} ج.م
                                            </div>
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            <div>{customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate).toLocaleDateString('ar-EG') : '-'}</div>
                                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                                منذ {daysOverdue} يوم
                                            </div>
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            <span style={{
                                                padding: '6px 12px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                backgroundColor: urgency.bg,
                                                color: urgency.color
                                            }}>
                                                {urgency.level}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => generatePaymentPlan(customer)}
                                                style={{
                                                    padding: '6px 12px',
                                                    backgroundColor: '#3b82f6',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    marginLeft: '5px',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                📅 جدول سداد
                                            </button>
                                            <button
                                                onClick={() => sendWhatsAppReminder(customer)}
                                                style={{
                                                    padding: '6px 12px',
                                                    backgroundColor: '#10b981',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                📱 تذكير
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Payment Plan Modal */}
            {showPaymentPlan && selectedCustomer && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={() => setShowPaymentPlan(false)}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            padding: '30px',
                            width: '700px',
                            maxHeight: '90vh',
                            overflowY: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ marginBottom: '20px' }}>📅 جدول سداد مقترح</h2>

                        <div style={{
                            padding: '15px',
                            backgroundColor: '#f0fdf4',
                            borderRadius: '8px',
                            marginBottom: '20px'
                        }}>
                            <div style={{ marginBottom: '8px' }}>
                                <strong>العميل:</strong> {selectedCustomer.name}
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                                <strong>التقييم:</strong> {'⭐'.repeat(Math.round(selectedCustomer.rating || 0))}
                            </div>
                            <div>
                                <strong>إجمالي الدين:</strong>
                                <span style={{ color: '#ef4444', fontWeight: 'bold', marginRight: '5px' }}>
                                    {selectedCustomer.balance.toFixed(2)} ج.م
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>عدد الأقساط</label>
                                <select
                                    value={paymentPlan.installments}
                                    onChange={(e) => setPaymentPlan({ ...paymentPlan, installments: parseInt(e.target.value) })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db'
                                    }}
                                >
                                    <option value="2">قسطين</option>
                                    <option value="3">3 أقساط</option>
                                    <option value="4">4 أقساط</option>
                                    <option value="6">6 أقساط</option>
                                    <option value="12">12 قسط</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>تاريخ البدء</label>
                                <input
                                    type="date"
                                    value={paymentPlan.startDate}
                                    onChange={(e) => setPaymentPlan({ ...paymentPlan, startDate: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db'
                                    }}
                                />
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                            <thead style={{ backgroundColor: '#f9fafb' }}>
                                <tr>
                                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e5e7eb' }}>القسط</th>
                                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e5e7eb' }}>المبلغ</th>
                                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e5e7eb' }}>تاريخ الاستحقاق</th>
                                </tr>
                            </thead>
                            <tbody>
                                {calculateInstallments().map(plan => (
                                    <tr key={plan.number}>
                                        <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>القسط {plan.number}</td>
                                        <td style={{ padding: '10px', border: '1px solid #e5e7eb', fontWeight: 'bold', color: '#3b82f6' }}>
                                            {plan.amount.toFixed(2)} ج.م
                                        </td>
                                        <td style={{ padding: '10px', border: '1px solid #e5e7eb' }}>{plan.dueDate}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>ملاحظات</label>
                            <textarea
                                value={paymentPlan.notes}
                                onChange={(e) => setPaymentPlan({ ...paymentPlan, notes: e.target.value })}
                                rows="3"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={printPaymentPlan}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                🖨️ طباعة الجدول
                            </button>
                            <button
                                onClick={() => setShowPaymentPlan(false)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    backgroundColor: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

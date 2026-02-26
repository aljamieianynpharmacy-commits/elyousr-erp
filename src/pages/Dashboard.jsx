import React, { useCallback, useMemo } from 'react';
import { APP_NAVIGATE_EVENT } from '../utils/posEditorBridge';
import './Dashboard.css';

const getTodayLabel = () => new Date().toLocaleDateString('ar-EG', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

export default function Dashboard({ user }) {
  const handleNavigate = useCallback((page) => {
    window.dispatchEvent(
      new CustomEvent(APP_NAVIGATE_EVENT, {
        detail: { page, reason: 'dashboard-shortcut' }
      })
    );
  }, []);

  const quickActions = useMemo(() => {
    const base = [
      { page: 'pos', icon: '🛒', title: 'فاتورة البيع', subtitle: 'إنشاء فاتورة بيع جديدة', tone: 'sales' },
      { page: 'purchases', icon: '📥', title: 'فاتورة المشتريات', subtitle: 'تسجيل مشتريات جديدة', tone: 'purchases' },
      { page: 'customers', icon: '👥', title: 'العملاء', subtitle: 'بحث وإدارة حسابات العملاء', tone: 'customers' },
      { page: 'products', icon: '📦', title: 'المنتجات', subtitle: 'إضافة وتعديل الأصناف', tone: 'products' },
      { page: 'returns', icon: '↩️', title: 'مرتجع المبيعات', subtitle: 'إدخال مرتجعات العملاء', tone: 'returns' },
      { page: 'purchaseReturns', icon: '🔁', title: 'مرتجع المشتريات', subtitle: 'إدخال مرتجعات الموردين', tone: 'returns' },
      { page: 'treasury', icon: '🏦', title: 'الحسابات', subtitle: 'متابعة الخزنة والتقارير', tone: 'finance' },
      { page: 'warehouses', icon: '🏭', title: 'المخازن', subtitle: 'إدارة المخزون والتحويلات', tone: 'warehouse' }
    ];

    if (user?.role === 'ADMIN') {
      base.push({ page: 'users', icon: '👤', title: 'المستخدمين', subtitle: 'إدارة الصلاحيات والحسابات', tone: 'settings' });
    }

    return base;
  }, [user?.role]);

  return (
    <div className="dashboard-home">
      <section className="dashboard-hero card">
        <div>
          <p className="dashboard-hero-eyebrow">الشاشة الافتتاحية</p>
          <h1>مرحبًا {user?.name || 'بك'} في نظام ERP</h1>
          <p>ابدأ من الاختصارات السريعة للمهام الأساسية.</p>
        </div>
        <div className="dashboard-hero-actions">
          <div className="dashboard-hero-date">{getTodayLabel()}</div>
          <button type="button" className="dashboard-btn dashboard-btn-primary" onClick={() => handleNavigate('pos')}>
            بدء فاتورة بيع
          </button>
          <button type="button" className="dashboard-btn dashboard-btn-light" onClick={() => handleNavigate('purchases')}>
            بدء فاتورة مشتريات
          </button>
        </div>
      </section>

      <section className="card dashboard-shortcuts">
        <div className="dashboard-section-head">
          <h2>اختصارات سريعة</h2>
          <span>تنقل مباشر للمهام الأساسية</span>
        </div>
        <div className="dashboard-shortcuts-grid">
          {quickActions.map((action) => (
            <button
              key={action.page}
              type="button"
              className={`dashboard-shortcut tone-${action.tone}`}
              onClick={() => handleNavigate(action.page)}
            >
              <span className="dashboard-shortcut-icon">{action.icon}</span>
              <span className="dashboard-shortcut-text">
                <strong>{action.title}</strong>
                <small>{action.subtitle}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

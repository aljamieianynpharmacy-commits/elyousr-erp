import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import EnhancedPOS from './pages/EnhancedPOS';
import Sales, { prefetchSalesPage } from './pages/Sales';
import Purchases from './pages/Purchases';
import Returns from './pages/Returns';
import PurchaseReturns from './pages/PurchaseReturns';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Users from './pages/Users';
import DebtReminders from './pages/DebtReminders';
import Treasury from './pages/Treasury';
import { APP_NAVIGATE_EVENT } from './utils/posEditorBridge';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentPage, setCurrentPage] = useState('pos');

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      setUser(JSON.parse(localStorage.getItem('user')));
    }
  }, []);

  useEffect(() => {
    const allowedPages = new Set([
      'pos',
      'dashboard',
      'sales',
      'purchases',
      'purchaseReturns',
      'returns',
      'products',
      'customers',
      'suppliers',
      'treasury',
      'debtreminders',
      'users'
    ]);

    const handleNavigate = (event) => {
      const targetPage = event?.detail?.page;
      if (!allowedPages.has(targetPage)) return;
      setCurrentPage(targetPage);
    };

    window.addEventListener(APP_NAVIGATE_EVENT, handleNavigate);
    return () => window.removeEventListener(APP_NAVIGATE_EVENT, handleNavigate);
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;
    const schedule = window.requestIdleCallback
      ? window.requestIdleCallback
      : (callback) => setTimeout(callback, 0);
    const cancelSchedule = window.cancelIdleCallback
      ? window.cancelIdleCallback
      : clearTimeout;

    const handle = schedule(() => {
      if (cancelled) return;
      prefetchSalesPage({ page: 1 }).catch((error) => {
        console.error('Sales prefetch failed:', error);
      });
    });

    return () => {
      cancelled = true;
      cancelSchedule(handle);
    };
  }, [token]);

  const handleLogin = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard token={token} />;
      case 'pos':
        return <EnhancedPOS />;
      case 'sales':
        return <Sales />;
      case 'purchases':
        return <Purchases />;
      case 'returns':
        return <Returns />;
      case 'purchaseReturns':
        return <PurchaseReturns />;
      case 'products':
        return <Products />;
      case 'customers':
        return <Customers />;
      case 'suppliers':
        return <Suppliers />;
      case 'treasury':
        return <Treasury />;
      case 'debtreminders':
        return <DebtReminders />;
      case 'users':
        return user?.role === 'ADMIN' ? <Users /> : <div>ليس لديك صلاحية</div>;
      default:
        return <Dashboard token={token} />;
    }
  };

  const NavItem = ({ page, icon, label }) => (
    <li
      onClick={() => setCurrentPage(page)}
      style={{
        padding: '12px',
        cursor: 'pointer',
        backgroundColor: currentPage === page ? '#334155' : 'transparent',
        borderRadius: '5px',
        marginBottom: '8px',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(event) => {
        if (currentPage !== page) event.currentTarget.style.backgroundColor = '#2d3748';
      }}
      onMouseLeave={(event) => {
        if (currentPage !== page) event.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {icon} {label}
    </li>
  );

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', overflow: 'hidden', direction: 'rtl' }}>
      <div
        className="sidebar"
        style={{
          width: '250px',
          backgroundColor: '#1e293b',
          color: 'white',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <h2
          style={{
            fontSize: '20px',
            marginBottom: '30px',
            textAlign: 'center',
            borderBottom: '2px solid #334155',
            paddingBottom: '15px'
          }}
        >
          ⚡ ERP SYSTEM
        </h2>

        <nav style={{ flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <NavItem page="pos" icon="🛒" label="فاتورة البيع" />
            <NavItem page="purchases" icon="📥" label="فاتوره المشتريات" />
            <NavItem page="dashboard" icon="📊" label="لوحة التحكم" />
            <NavItem page="sales" icon="📋" label="المبيعات" />
            <NavItem page="purchaseReturns" icon="🔁" label="مرتجع المشتريات" />
            <NavItem page="returns" icon="↩️" label="مرتجع المبيعات" />
            <NavItem page="products" icon="📦" label="المنتجات" />
            <NavItem page="customers" icon="👥" label="العملاء" />
            <NavItem page="suppliers" icon="🚚" label="الموردين" />
            <NavItem page="treasury" icon="🏦" label="الحسابات" />
            <NavItem page="debtreminders" icon="⚠️" label="تذكيرات الديون" />
            {user?.role === 'ADMIN' && <NavItem page="users" icon="👤" label="المستخدمين" />}
          </ul>
        </nav>

        <div style={{ borderTop: '1px solid #334155', paddingTop: '20px' }}>
          <div
            style={{
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: '#334155',
              borderRadius: '8px'
            }}
          >
            <div style={{ fontSize: '14px', marginBottom: '5px', fontWeight: 'bold' }}>{user?.name}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              {user?.role === 'ADMIN' ? 'مدير' : user?.role === 'CASHIER' ? 'أمين صندوق' : 'أمين مخزن'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '10px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            تسجيل خروج
          </button>
        </div>
      </div>

      <div
        className="main-content"
        style={{
          flex: 1,
          padding: '30px 30px 10px 30px',
          backgroundColor: '#f9fafb',
          overflowY: currentPage === 'sales' || currentPage === 'products' ? 'hidden' : 'auto'
        }}
      >
        {renderPage()}
      </div>
    </div>
  );
}

export default App;

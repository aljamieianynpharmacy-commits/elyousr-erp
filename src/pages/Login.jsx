import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!window.api) {
        setError('يجب تشغيل التطبيق عبر Electron وليس المتصفح');
        setLoading(false);
        return;
      }
      const result = await window.api.login({ username, password, rememberMe });
      if (result.error) {
        setError(result.error);
      } else {
        onLogin(result.token, result.user);
      }
    } catch (err) {
      setError('خطأ في الاتصال بالنظام: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <style>{`
        .login-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 36px 24px;
          background:
            radial-gradient(900px 400px at 85% -10%, rgba(20, 184, 166, 0.18), transparent 60%),
            radial-gradient(700px 350px at 10% 10%, rgba(59, 130, 246, 0.12), transparent 60%),
            linear-gradient(160deg, #0b1220 0%, #0f172a 40%, #111827 100%);
          font-family: 'Segoe UI', 'Tahoma', 'Arial', system-ui, -apple-system, sans-serif;
          color: #e2e8f0;
        }

        .login-card {
          width: min(460px, 92vw);
          background: rgba(15, 23, 42, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 24px;
          box-shadow: 0 24px 70px rgba(2, 6, 23, 0.45);
          padding: 38px 36px 32px;
          backdrop-filter: blur(10px);
          animation: cardIn 550ms ease-out;
        }

        .login-badge {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, #38bdf8, #22c55e);
          display: grid;
          place-items: center;
          color: white;
          font-weight: 700;
          font-size: 20px;
          margin-bottom: 18px;
          box-shadow: 0 12px 28px rgba(14, 165, 233, 0.35);
        }

        .login-title {
          font-size: 25px;
          font-weight: 700;
          margin: 0 0 6px;
        }

        .login-subtitle {
          margin: 0 0 24px;
          color: #94a3b8;
          font-size: 14px;
        }

        .login-field {
          display: grid;
          gap: 8px;
          margin-bottom: 18px;
        }

        .login-field label {
          font-size: 14px;
          color: #cbd5f5;
        }

        .login-input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(15, 23, 42, 0.8);
          font-size: 15px;
          color: #e2e8f0;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        .login-input:focus {
          outline: none;
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
        }

        .login-error {
          background: rgba(190, 18, 60, 0.16);
          color: #fecdd3;
          padding: 10px 12px;
          border-radius: 10px;
          margin-bottom: 18px;
          font-size: 14px;
          border: 1px solid rgba(244, 63, 94, 0.35);
        }

        .login-button {
          width: 100%;
          padding: 12px 16px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #38bdf8, #2563eb);
          color: white;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: transform 160ms ease, box-shadow 160ms ease;
        }

        .login-button:hover:enabled {
          transform: translateY(-1px);
          box-shadow: 0 12px 25px rgba(37, 99, 235, 0.25);
        }

        .login-button:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .login-options {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 6px 0 18px;
          color: #cbd5f5;
          font-size: 13px;
        }

        .login-remember {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .login-remember input {
          accent-color: #38bdf8;
          width: 16px;
          height: 16px;
        }

        .login-footer {
          text-align: center;
          margin-top: 18px;
          color: #64748b;
          font-size: 12px;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="login-card">
        <div className="login-badge">ERP</div>
        <h2 className="login-title">تسجيل الدخول</h2>
        <p className="login-subtitle">لوحة تحكم موارد المؤسسة</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              placeholder="أدخل اسم المستخدم"
              required
            />
          </div>

          <div className="login-field">
            <label>كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              placeholder="أدخل كلمة المرور"
              required
            />
          </div>

          <div className="login-options">
            <label className="login-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              تذكرني
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="login-button"
          >
            {loading ? 'جاري التحقق...' : 'دخول'}
          </button>
        </form>
        <div className="login-footer">© 2026 ERP Desktop</div>
      </div>
    </div>
  );
}

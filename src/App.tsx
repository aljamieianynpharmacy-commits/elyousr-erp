import { useEffect, useState } from 'react';
import LicensePage from './pages/LicensePage';
import type { LicenseStatus } from './license/types';

function ERPAppShell() {
  return (
    <div style={{ padding: 24, direction: 'rtl' }}>
      <h1>ERP System</h1>
      <p>الترخيص مفعل. ضع هنا واجهة النظام الحالية.</p>
    </div>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);

  useEffect(() => {
    const checkLicense = async () => {
      try {
        const status = await window.licensing.getStatus();
        setLicenseStatus(status);
      } finally {
        setIsLoading(false);
      }
    };

    void checkLicense();
  }, []);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          direction: 'rtl',
          backgroundColor: '#0f172a',
          color: '#e2e8f0',
        }}
      >
        جاري التحقق من الترخيص...
      </div>
    );
  }

  if (licenseStatus?.status !== 'ACTIVE') {
    return (
      <LicensePage
        onStatusChanged={(status) => setLicenseStatus(status)}
        onActivated={(status) => setLicenseStatus(status)}
      />
    );
  }

  return <ERPAppShell />;
}

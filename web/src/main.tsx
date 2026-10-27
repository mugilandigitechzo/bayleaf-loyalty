import './styles/app.css';
import { createRoot } from 'react-dom/client';
import { lazy, Suspense, useEffect, useState } from 'react';
import { usePath } from './lib/router.ts';
import { api } from './lib/api.ts';
import { setLanguage, type Lang } from './i18n/index.ts';
import { ToastProvider } from './ui/kit.tsx';
import { CustomerApp, type PublicConfig } from './customer/CustomerApp.tsx';

// Staff and admin code only downloads for staff — the customer card stays light.
const StaffApp = lazy(() => import('./staff/StaffApp.tsx').then((m) => ({ default: m.StaffApp })));
const AdminApp = lazy(() => import('./admin/AdminApp.tsx').then((m) => ({ default: m.AdminApp })));

const FALLBACK: PublicConfig = { name: 'Bay Leaf', tagline: 'Restaurant', selfRegistration: true, arabicEnabled: false, phoneRegion: 'AE' };

function App() {
  const path = usePath();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  useEffect(() => {
    api.get<PublicConfig>('/api/public/config').then((c) => {
      setConfig(c);
      let saved: string | null = null;
      try { saved = localStorage.getItem('bl_lang'); } catch { /* ignore */ }
      setLanguage(c.arabicEnabled && saved === 'ar' ? 'ar' : 'en' as Lang);
    }, () => setConfig(FALLBACK));
  }, []);
  if (!config) return null;

  const fallback = <div className="center-state"><span className="spinner" style={{ color: 'var(--forest)' }} /></div>;
  if (path === '/staff' || path.startsWith('/staff/') || path.startsWith('/s/')) {
    return <Suspense fallback={fallback}><StaffApp path={path} config={config} /></Suspense>;
  }
  if (path === '/admin' || path.startsWith('/admin/')) {
    return <Suspense fallback={fallback}><AdminApp path={path} /></Suspense>;
  }
  return <CustomerApp path={path} config={config} />;
}

createRoot(document.getElementById('root')!).render(<ToastProvider><App /></ToastProvider>);

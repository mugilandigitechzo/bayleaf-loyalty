import { useEffect, useState } from 'react';
import type { LoyaltyState } from '../../../shared/types.ts';
import { api, ApiError } from '../lib/api.ts';
import { navigate } from '../lib/router.ts';
import { t } from '../i18n/index.ts';
import { Button, Skeleton } from '../ui/kit.tsx';
import { Welcome } from './Welcome.tsx';
import { AuthFlow } from './AuthFlow.tsx';
import { CardHome } from './CardHome.tsx';

export type PublicConfig = { name: string; tagline: string; selfRegistration: boolean; arabicEnabled: boolean; phoneRegion: string };
type Me = { scope: 'link' | 'verified'; state: LoyaltyState };

export function CustomerApp({ path, config }: { path: string; config: PublicConfig }) {
  const linkMatch = path.match(/^\/c\/([A-Za-z0-9_-]+)$/);
  if (linkMatch) return <OpenLink token={linkMatch[1]} />;
  if (path === '/join') return <AuthFlow mode="join" region={config.phoneRegion} onSignedIn={() => navigate('/', { replace: true })} />;
  if (path === '/sign-in') return <AuthFlow mode="sign_in" region={config.phoneRegion} onSignedIn={() => navigate('/', { replace: true })} />;
  return <Home config={config} />;
}

function Home({ config }: { config: PublicConfig }) {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'anon' | 'error'>('loading');
  const load = () => {
    setStatus('loading');
    api.get<Me>('/api/customer/me').then(
      (r) => { setMe(r); setStatus('ready'); },
      (e: ApiError) => setStatus(e.status === 401 ? 'anon' : 'error'),
    );
  };
  useEffect(load, []);

  if (status === 'loading') return <CardSkeleton />;
  if (status === 'anon') return <Welcome selfRegistration={config.selfRegistration} />;
  if (status === 'error') {
    return (
      <main className="center-state"><div className="center-state__inner">
        <h1>{t('error.cardTitle')}</h1><p className="muted">{t('error.cardLead')}</p>
        <Button onClick={load}>{t('common.tryAgain')}</Button>
      </div></main>
    );
  }
  return <CardHome me={me!} onSignedOut={() => { setMe(null); setStatus('anon'); }} />;
}

/** Opening the WhatsApp link: trade the link token for a session, then drop it from the address bar. */
function OpenLink({ token }: { token: string }) {
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    history.replaceState(null, '', '/'); // keep the token out of history and screenshots
    api.post('/api/customer/link', { token }).then(() => navigate('/', { replace: true }), setError);
  }, []);
  if (!error) return <CardSkeleton label={t('link.opening')} />;
  return (
    <main className="center-state"><div className="center-state__inner">
      <h1>{t('link.invalidTitle')}</h1>
      <p className="muted">{error.message}</p>
      <Button onClick={() => navigate('/sign-in')}>{t('signIn.title')}</Button>
    </div></main>
  );
}

function CardSkeleton({ label }: { label?: string }) {
  return (
    <div className="c-shell" aria-busy="true" aria-label={label ?? t('common.loading')}>
      <div className="c-top"><Skeleton w={120} h={24} /></div>
      <div className="c-greet stack-sm"><Skeleton w="70%" h={30} /><Skeleton w="45%" h={18} /></div>
      <div className="c-stack">
        <Skeleton h={330} r={20} />
        <Skeleton h={150} r={14} />
        <Skeleton h={220} r={14} />
      </div>
    </div>
  );
}

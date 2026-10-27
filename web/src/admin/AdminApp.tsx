import { useEffect, useState } from 'react';
import type { StaffMe } from '../../../shared/types.ts';
import { api, ApiError } from '../lib/api.ts';
import { linkProps, navigate } from '../lib/router.ts';
import { Button, Notice, OfflineBar, Wordmark } from '../ui/kit.tsx';
import { CardIcon, Cog, Counter, Gauge, ListIcon, Logout, Users, User } from '../ui/icons.tsx';
import { StaffLogin, ChangePassword } from '../staff/StaffApp.tsx';
import { Overview } from './Overview.tsx';
import { GuestList, GuestDetail } from './Guests.tsx';
import { Cards } from './Cards.tsx';
import { Team } from './Team.tsx';
import { Settings } from './Settings.tsx';
import { Activity } from './Activity.tsx';

export type AdminCtx = { me: StaffMe };

const NAV = [
  { to: '/admin', label: 'Overview', icon: Gauge, match: (p: string) => p === '/admin' },
  { to: '/admin/guests', label: 'Guests', icon: User, match: (p: string) => p.startsWith('/admin/guests') },
  { to: '/admin/cards', label: 'Cards & rewards', icon: CardIcon, match: (p: string) => p.startsWith('/admin/cards') },
  { to: '/admin/team', label: 'Team & outlets', icon: Users, match: (p: string) => p.startsWith('/admin/team') },
  { to: '/admin/settings', label: 'Settings', icon: Cog, match: (p: string) => p.startsWith('/admin/settings') },
  { to: '/admin/activity', label: 'Activity log', icon: ListIcon, match: (p: string) => p.startsWith('/admin/activity') },
];

export function AdminApp({ path }: { path: string }) {
  const [me, setMe] = useState<StaffMe | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'anon' | 'error'>('loading');
  const load = () => api.get<{ me: StaffMe }>('/api/staff/me').then(
    (r) => { setMe(r.me); setStatus('ready'); },
    (e: ApiError) => setStatus(e.status === 401 ? 'anon' : 'error'),
  );
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const page = NAV.find((n) => n.match(path));
    document.title = `${page?.label ?? 'Admin'} · Bay Leaf`;
    return () => { document.title = 'Bay Leaf Loyalty'; };
  }, [path]);

  if (status === 'loading') return <div className="login"><span className="spinner" style={{ color: 'var(--gold)' }} /></div>;
  if (status === 'error') return <div className="login"><div className="login__card"><Notice kind="error">Can’t reach Bay Leaf right now.</Notice><Button onClick={load}>Try again</Button></div></div>;
  if (status === 'anon' || !me) return <StaffLogin onDone={load} hasScan={false} />;
  if (me.mustChangePassword) return <ChangePassword onDone={load} />;
  if (!me.permissions.includes('reports.view')) {
    return (
      <main className="login"><div className="login__card">
        <Wordmark />
        <h1 style={{ fontSize: 22 }}>This area is for managers</h1>
        <p className="muted">Your account works at the counter. Ask a manager if you need admin access.</p>
        <Button onClick={() => navigate('/staff')}>Go to the counter</Button>
      </div></main>
    );
  }

  const guestId = path.match(/^\/admin\/guests\/([0-9a-f-]{36})$/)?.[1];
  let page;
  if (path === '/admin') page = <Overview />;
  else if (guestId) page = <GuestDetail id={guestId} me={me} />;
  else if (path.startsWith('/admin/guests')) page = <GuestList />;
  else if (path.startsWith('/admin/cards')) page = <Cards />;
  else if (path.startsWith('/admin/team')) page = <Team me={me} />;
  else if (path.startsWith('/admin/settings')) page = <Settings />;
  else if (path.startsWith('/admin/activity')) page = <Activity />;
  else page = <div className="empty"><p>That page doesn’t exist.</p><Button onClick={() => navigate('/admin')}>Back to overview</Button></div>;

  return (
    <div className="a-shell">
      <nav className="a-nav" aria-label="Admin">
        <div className="a-nav__brand"><Wordmark onDark /></div>
        {NAV.map((n) => (
          <a key={n.to} {...linkProps(n.to)} aria-current={n.match(path) ? 'page' : undefined}><n.icon />{n.label}</a>
        ))}
        <a {...linkProps('/staff')}><Counter />Open counter</a>
        <div className="a-nav__spacer" />
        <div className="a-nav__user">
          <div style={{ color: 'var(--ivory)', fontWeight: 600 }}>{me.fullName}</div>
          <div>{me.role === 'super_admin' ? 'Super admin' : 'Administrator'}</div>
          <button className="btn btn--ghost btn--sm" style={{ color: 'var(--ivory)', paddingInline: 0, marginTop: 6 }}
            onClick={async () => { await api.post('/api/staff/logout').catch(() => {}); setStatus('anon'); }}><Logout />Sign out</button>
        </div>
      </nav>
      <div className="a-main">
        <OfflineBar text="You’re offline. Changes can’t be saved until the connection is back." />
        {page}
      </div>
    </div>
  );
}

/** Shared admin bits. */
export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: any }) {
  return (
    <header className="a-head">
      <div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>
      {actions ? <div className="toolbar">{actions}</div> : null}
    </header>
  );
}

export function LoadError({ error, retry }: { error: any; retry: () => void }) {
  return <Notice kind="error">{error?.message ?? 'Couldn’t load this page.'} <button className="btn btn--ghost btn--sm" onClick={retry}>Try again</button></Notice>;
}

export const ACTION_LABELS: Record<string, string> = {
  'visit.recorded': 'Visit recorded',
  'visit.correction_added': 'Visit added (correction)',
  'visit.voided': 'Visit undone',
  'reward.unlocked': 'Reward unlocked',
  'reward.redeemed': 'Reward redeemed',
  'reward.revoked': 'Reward withdrawn',
  'reward.restored': 'Reward restored',
  'reward.created': 'Reward added',
  'reward.updated': 'Reward edited',
  'reward.archived': 'Reward removed',
  'card.created': 'Card created',
  'card.updated': 'Card edited',
  'card.published': 'Card published',
  'card.unpublished': 'Card unpublished',
  'card.activated': 'Card started',
  'card.completed': 'Card completed',
  'customer.registered': 'Guest registered',
  'customer.updated': 'Guest details changed',
  'customer.signed_in': 'Guest signed in',
  'customer.qr_rotated': 'QR code replaced',
  'customer.link_rotated': 'Card link replaced',
  'staff.created': 'Team member added',
  'staff.updated': 'Team member edited',
  'staff.role_changed': 'Role changed',
  'staff.signed_in': 'Staff signed in',
  'staff.password_changed': 'Password changed',
  'staff.locked_out': 'Account locked (wrong passwords)',
  'staff.outlet_selected': 'Outlet selected',
  'staff.admin_reset_cli': 'Admin reset from server',
  'outlet.created': 'Outlet added',
  'outlet.updated': 'Outlet edited',
  'settings.updated': 'Settings changed',
};

import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import { linkProps } from '../lib/router.ts';
import { fmtDateTime } from '../i18n/index.ts';
import { Button, Skeleton } from '../ui/kit.tsx';
import { ACTION_LABELS, LoadError, PageHead } from './AdminApp.tsx';

type Item = { id: string; at: string; actorType: string; actorName: string | null; action: string; customerId: string | null; customerName: string | null; reason: string | null; details: any };

const FILTERS = [['', 'Everything'], ['visit.', 'Visits'], ['reward.', 'Rewards'], ['card.', 'Cards'], ['customer.', 'Guests'], ['staff.', 'Team'], ['settings.', 'Settings']] as const;

export function Activity() {
  const params = new URLSearchParams(location.search);
  const customerId = params.get('customerId') ?? '';
  const [action, setAction] = useState('');
  const [items, setItems] = useState<Item[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<any>(null);

  const url = (before?: string) => `/api/admin/audit?${new URLSearchParams({ ...(customerId ? { customerId } : {}), ...(action ? { action } : {}), ...(before ? { before } : {}) })}`;
  const load = () => {
    setItems(null); setError(null);
    api.get<{ items: Item[]; nextCursor: string | null }>(url()).then((r) => { setItems(r.items); setCursor(r.nextCursor); }, setError);
  };
  useEffect(load, [action, customerId]);
  async function more() {
    const r = await api.get<{ items: Item[]; nextCursor: string | null }>(url(cursor!));
    setItems([...(items ?? []), ...r.items]); setCursor(r.nextCursor);
  }

  return (
    <div className="a-page">
      <PageHead title="Activity log" sub="Every visit, reward, correction and setting change — who did it and when. Entries can’t be edited or deleted." />
      <div className="seg" role="group" aria-label="Filter">
        {FILTERS.map(([k, label]) => <button key={k} aria-pressed={action === k} onClick={() => setAction(k)}>{label}</button>)}
      </div>
      {customerId ? <p className="muted">Showing one guest only. <a {...linkProps('/admin/activity')}>Show everyone</a></p> : null}
      {error ? <LoadError error={error} retry={load} /> : null}
      <section className="panel">
        {items === null ? <div className="panel__body stack-sm"><Skeleton h={40} /><Skeleton h={40} /><Skeleton h={40} /></div> :
          items.length === 0 ? <p className="panel__body muted">Nothing recorded yet for this filter.</p> :
          items.map((a) => (
            <div key={a.id} className="audit-item">
              <span>
                <strong>{ACTION_LABELS[a.action] ?? a.action}</strong>
                {a.customerName ? <> · <a {...linkProps(`/admin/guests/${a.customerId}`)}>{a.customerName}</a></> : null}
                {a.details?.reference ? <span className="muted"> · {a.details.reference}</span> : null}
              </span>
              <span className="audit-item__when">{fmtDateTime(a.at)}</span>
              <span className="audit-item__who">{a.actorName ?? (a.actorType === 'system' ? 'System' : a.actorType === 'customer' ? 'Guest' : '—')}</span>
              {a.reason ? <span className="audit-item__reason">“{a.reason}”</span> : null}
            </div>
          ))}
        {cursor ? <div className="panel__body"><Button variant="secondary" onClick={more}>Show older</Button></div> : null}
      </section>
    </div>
  );
}

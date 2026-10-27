import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { Button, Field, Notice, Skeleton, useLoad, useToast } from '../ui/kit.tsx';
import { LoadError, PageHead } from './AdminApp.tsx';

type S = {
  visitPolicy: { maxVisitsPerDay: number; timeZone: string; minimumBillAmount: number | null };
  business: { name: string; tagline: string; currency: string; selfRegistration: boolean; shareMessage: string };
};

const ZONES = ['Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Kuwait', 'Asia/Bahrain', 'Asia/Muscat', 'Asia/Kolkata'];

export function Settings() {
  const { data, error, reload } = useLoad<S>(() => api.get('/api/admin/settings'));
  if (error && !data) return <div className="a-page"><LoadError error={error} retry={reload} /></div>;
  if (!data) return <div className="a-page"><Skeleton h={40} w={200} /><Skeleton h={260} r={14} /></div>;
  return (
    <div className="a-page">
      <PageHead title="Settings" sub="Changes take effect immediately and are recorded in the activity log." />
      <div className="grid-2">
        <VisitPolicy initial={data.visitPolicy} onSaved={reload} />
        <Business initial={data.business} onSaved={reload} />
      </div>
    </div>
  );
}

function VisitPolicy({ initial, onSaved }: { initial: S['visitPolicy']; onSaved: () => void }) {
  const [max, setMax] = useState(String(initial.maxVisitsPerDay));
  const [tz, setTz] = useState(initial.timeZone);
  const [minBill, setMinBill] = useState(initial.minimumBillAmount === null ? '' : String(initial.minimumBillAmount));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const toast = useToast();
  useEffect(() => { setMax(String(initial.maxVisitsPerDay)); }, [initial.maxVisitsPerDay]);
  async function save(e: Event) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await api.patch('/api/admin/settings/visit-policy', { maxVisitsPerDay: Number(max), timeZone: tz, minimumBillAmount: minBill.trim() === '' ? null : Number(minBill), reason });
      toast('Visit rules saved'); setReason(''); onSaved();
    } catch (err: any) { setError(err); }
    setBusy(false);
  }
  const f = error?.fields ?? {};
  return (
    <form className="panel panel__body form" onSubmit={save}>
      <div><h2 className="section-title">Visit rules</h2><p className="section-sub">What counts as one stamp on a card.</p></div>
      {error && !Object.keys(f).length ? <Notice kind="error">{error.message}</Notice> : null}
      <Field label="Visits that count per guest per day" type="number" inputMode="numeric" value={max} onChange={setMax} hint="Default 1. A second visit the same day is refused with a clear message." error={f.maxVisitsPerDay} />
      <div className="field">
        <label className="field__label" htmlFor="tz">Restaurant time zone</label>
        <select id="tz" className="select" value={tz} onChange={(e: any) => setTz(e.target.value)}>
          {(ZONES.includes(tz) ? ZONES : [tz, ...ZONES]).map((z) => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}
        </select>
        <span className="field__hint">Decides when a new “day” starts for the one-visit rule and reports.</span>
      </div>
      <Field label="Minimum bill for a visit (optional)" inputMode="decimal" value={minBill} onChange={setMinBill} hint="Leave empty for no minimum. When set, staff enter the bill amount." error={f.minimumBillAmount} />
      <Field label="Reason (optional)" value={reason} onChange={setReason} hint="Helps others understand the change later." />
      <div><Button type="submit" loading={busy}>Save visit rules</Button></div>
      <Notice kind="info">Cards never expire and progress is never reset by date. There is no setting for this on purpose.</Notice>
    </form>
  );
}

function Business({ initial, onSaved }: { initial: S['business']; onSaved: () => void }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const toast = useToast();
  async function save(e: Event) {
    e.preventDefault(); setBusy(true); setError(null);
    try { await api.patch('/api/admin/settings/business', v); toast('Business details saved'); onSaved(); }
    catch (err: any) { setError(err); }
    setBusy(false);
  }
  const f = error?.fields ?? {};
  return (
    <form className="panel panel__body form" onSubmit={save}>
      <div><h2 className="section-title">Business &amp; sharing</h2><p className="section-sub">How Bay Leaf appears to guests.</p></div>
      {error && !Object.keys(f).length ? <Notice kind="error">{error.message}</Notice> : null}
      <Field label="Restaurant name" value={v.name} onChange={(x) => setV({ ...v, name: x })} error={f.name} />
      <Field label="Currency code" value={v.currency} onChange={(x) => setV({ ...v, currency: x.toUpperCase().slice(0, 3) })} hint="e.g. AED, SAR, QAR." error={f.currency} />
      <div className="field">
        <label className="field__label" htmlFor="share">WhatsApp message</label>
        <textarea id="share" className="textarea" value={v.shareMessage} onChange={(e: any) => setV({ ...v, shareMessage: e.target.value })} maxLength={400} />
        <span className={f.shareMessage ? 'field__error' : 'field__hint'}>{f.shareMessage ?? 'Use {name} for the guest’s first name and {link} for their card link.'}</span>
      </div>
      <label className="check">
        <input type="checkbox" checked={v.selfRegistration} onChange={(e: any) => setV({ ...v, selfRegistration: e.target.checked })} />
        <span><strong>Let guests sign up on their own phone</strong><br /><span className="muted">They confirm their number with a text code. Staff can always register guests at the counter.</span></span>
      </label>
      <div><Button type="submit" loading={busy}>Save business details</Button></div>
    </form>
  );
}

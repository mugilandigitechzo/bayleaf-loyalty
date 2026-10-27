import { useEffect, useState } from 'react';
import type { LoyaltyState, RedemptionHistoryItem, RewardView, ShareInfo, StaffMe, VisitHistoryItem } from '../../../shared/types.ts';
import { api, ApiError } from '../lib/api.ts';
import { linkProps, navigate } from '../lib/router.ts';
import { fmtDate, fmtDateTime } from '../i18n/index.ts';
import { Button, Field, Notice, PhoneField, Sheet, Skeleton, useLoad, useToast } from '../ui/kit.tsx';
import { Back, Edit, Plus, Search, Undo, Whatsapp, User } from '../ui/icons.tsx';
import { LoyaltyCard } from '../customer/LoyaltyCard.tsx';
import { ACTION_LABELS, LoadError, PageHead } from './AdminApp.tsx';

type Row = { id: string; fullName: string; memberCode: string; phone: string; status: string; createdAt: string; lastVisitAt: string | null; activeCard: { name: string; visitCount: number; requiredVisits: number } | null };

export function GuestList() {
  const initial = new URLSearchParams(location.search).get('q') ?? '';
  const [q, setQ] = useState(initial);
  const [term, setTerm] = useState(initial);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    history.replaceState(null, '', term ? `/admin/guests?q=${encodeURIComponent(term)}` : '/admin/guests');
    setError(null);
    api.get<{ items: Row[]; hasMore: boolean }>(`/api/admin/customers?q=${encodeURIComponent(term)}`)
      .then((r) => { setRows(r.items); setHasMore(r.hasMore); }, setError);
  }, [term]);

  async function more() {
    const r = await api.get<{ items: Row[]; hasMore: boolean }>(`/api/admin/customers?q=${encodeURIComponent(term)}&offset=${rows!.length}`);
    setRows([...rows!, ...r.items]); setHasMore(r.hasMore);
  }

  return (
    <div className="a-page">
      <PageHead title="Guests" sub="Find anyone by name, mobile number or member code." />
      <div className="search-big">
        <Search />
        <input className="input" type="search" value={q} onChange={(e: any) => setQ(e.target.value)} autoFocus
          placeholder="Name, 050 123 4567, or BL7K3Q9M" aria-label="Search guests" />
      </div>
      {error ? <LoadError error={error} retry={() => setTerm(term + '')} /> : null}
      <section className="panel">
        {rows === null ? <div className="panel__body stack-sm"><Skeleton h={48} /><Skeleton h={48} /><Skeleton h={48} /></div> :
          rows.length === 0 ? (
            <div className="empty"><User /><p>{term ? `No guests match “${term}”.` : 'No guests yet. Register the first one at the counter.'}</p></div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Guest</th><th className="hide-sm">Mobile</th><th>Card</th><th className="hide-sm">Last visit</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="is-link" onClick={() => navigate(`/admin/guests/${r.id}`)}>
                        <td>
                          <a {...linkProps(`/admin/guests/${r.id}`)} style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>{r.fullName}</a>
                          <div className="list-row__sub tnum">{r.memberCode}{r.status === 'suspended' ? ' · on hold' : ''}</div>
                          <div className="list-row__sub tnum show-sm" dir="ltr">{r.phone}</div>
                        </td>
                        <td className="tnum hide-sm" dir="ltr" style={{ whiteSpace: 'nowrap' }}>{r.phone}</td>
                        <td>{r.activeCard ? <span className="tnum" style={{ whiteSpace: 'nowrap' }}>{r.activeCard.visitCount}/{r.activeCard.requiredVisits}<span className="list-row__sub" style={{ display: 'block' }}>{r.activeCard.name}</span></span> : <span className="muted">All cards done</span>}</td>
                        <td className="muted hide-sm" style={{ whiteSpace: 'nowrap' }}>{r.lastVisitAt ? fmtDate(r.lastVisitAt) : 'No visits yet'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMore ? <div className="panel__body"><Button variant="secondary" onClick={more}>Show more</Button></div> : null}
            </>
          )}
      </section>
    </div>
  );
}

type Detail = {
  profile: { id: string; fullName: string; memberCode: string; phone: string; status: string; registeredVia: string; registeredBy: string | null; registeredOutlet: string | null; createdAt: string };
  state: LoyaltyState;
  visits: { items: VisitHistoryItem[]; nextCursor: string | null };
  redemptions: RedemptionHistoryItem[];
  audit: { items: { id: string; at: string; action: string; actorName: string | null; actorType: string; reason: string | null }[] };
};

type Dialog = null | 'edit' | 'undo' | 'add' | 'qr' | 'link' | { revoke: RewardView } | { restore: RewardView };

export function GuestDetail({ id, me }: { id: string; me: StaffMe }) {
  const { data, error, reload } = useLoad<Detail>(() => api.get(`/api/admin/customers/${id}`), [id]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [visits, setVisits] = useState<VisitHistoryItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [share, setShare] = useState<ShareInfo | null>(null);
  const toast = useToast();
  useEffect(() => { if (data) { setVisits(data.visits.items); setCursor(data.visits.nextCursor); } }, [data]);
  useEffect(() => { api.get<ShareInfo>(`/api/admin/customers/${id}/share`).then(setShare, () => {}); }, [id]);
  const canCorrect = me.permissions.includes('visit.correct');

  if (error && !data) return <div className="a-page"><LoadError error={error} retry={reload} /></div>;
  if (!data) return <div className="a-page"><Skeleton h={40} w={280} /><Skeleton h={320} r={20} /></div>;
  const { profile, state } = data;
  const card = state.activeCard ?? state.completedCards[0] ?? null;
  const done = (msg: string) => { setDialog(null); toast(msg); reload(); };

  async function more() {
    const r = await api.get<{ items: VisitHistoryItem[]; nextCursor: string | null }>(`/api/admin/customers/${id}/visits?before=${encodeURIComponent(cursor!)}`);
    setVisits([...(visits ?? []), ...r.items]); setCursor(r.nextCursor);
  }
  const allRewards = [...(state.activeCard?.milestones ?? []), ...state.completedCards.flatMap((c) => c.milestones)];

  return (
    <div className="a-page">
      <div><Button variant="ghost" onClick={() => history.length > 1 ? history.back() : navigate('/admin/guests')}><Back />Guests</Button></div>
      <PageHead
        title={profile.fullName}
        sub={`${profile.phone} · ${profile.memberCode} · joined ${fmtDate(profile.createdAt)}${profile.registeredBy ? ` by ${profile.registeredBy}` : profile.registeredVia === 'self' ? ' (self sign-up)' : ''}`}
        actions={<>
          {share ? <Button variant="whatsapp" href={share.whatsappUrl} target="_blank" rel="noopener"><Whatsapp />Send card link</Button> : null}
          <Button variant="secondary" onClick={() => setDialog('edit')}><Edit />Edit details</Button>
        </>}
      />
      {profile.status === 'suspended' ? <Notice kind="warn">This account is on hold: it can’t collect visits or redeem rewards until it’s reactivated.</Notice> : null}

      <div className="grid-2">
        <div className="stack">
          {card ? <LoyaltyCard card={card} firstName={state.customer.firstName} memberCode={profile.memberCode} /> : <Notice kind="info">No card yet — Card 1 isn’t published.</Notice>}
          {state.awaitingNextLevel ? <Notice kind="info">This guest completed every published card. They’ll move to the next card as soon as it’s published.</Notice> : null}
          <section className="panel">
            <div className="panel__body spread" style={{ paddingBottom: 8 }}>
              <h2 className="section-title">Visits</h2>
              {canCorrect ? (
                <div className="toolbar">
                  <Button size="sm" variant="secondary" onClick={() => setDialog('add')}><Plus />Add missed visit</Button>
                  <Button size="sm" variant="secondary" onClick={() => setDialog('undo')} disabled={!state.activeCard?.visitCount}><Undo />Undo last visit</Button>
                </div>
              ) : null}
            </div>
            {visits && visits.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>When</th><th>Visit</th><th>Recorded by</th></tr></thead>
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.id} style={v.status === 'voided' ? { opacity: .6 } : undefined}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(v.at)}{v.source === 'correction' ? <div className="list-row__sub">For {fmtDate(v.businessDate)}</div> : null}</td>
                        <td>
                          {v.status === 'voided' ? <s>{v.cardName} #{v.visitNumber}</s> : `${v.cardName} #${v.visitNumber}`}
                          {v.status === 'voided' ? <div className="list-row__sub">Undone: {v.voidReason}</div> : null}
                          {v.correctionReason ? <div className="list-row__sub">Correction: {v.correctionReason}</div> : null}
                        </td>
                        <td>{v.staffName}{v.outletName ? <div className="list-row__sub">{v.outletName}</div> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="panel__body muted">No visits yet.</p>}
            {cursor ? <div className="panel__body"><Button variant="ghost" onClick={more}>Show older visits</Button></div> : null}
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel__body" style={{ paddingBottom: 4 }}><h2 className="section-title">Rewards</h2></div>
            {allRewards.length ? allRewards.map((r) => (
              <div key={r.id} className="list-row">
                <div>
                  <div className="list-row__title">{r.name}</div>
                  <div className="list-row__sub">{r.cardName}, visit {r.milestone}
                    {r.status === 'redeemed' && r.redeemedAt ? ` · redeemed ${fmtDate(r.redeemedAt)} (${r.redemptionRef})` : ''}
                    {r.status === 'eligible' && r.eligibleAt ? ` · earned ${fmtDate(r.eligibleAt)}` : ''}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <span className={`chip ${r.status === 'eligible' ? 'chip--ready' : r.status === 'redeemed' ? 'chip--done' : r.status === 'revoked' ? 'chip--danger' : 'chip--locked'}`}>
                    {r.status === 'eligible' ? 'Earned' : r.status === 'redeemed' ? 'Redeemed' : r.status === 'revoked' ? 'Withdrawn' : 'Locked'}
                  </span>
                  {canCorrect && r.status === 'eligible' ? <Button size="sm" variant="ghost" onClick={() => setDialog({ revoke: r })}>Withdraw</Button> : null}
                  {canCorrect && r.status === 'revoked' ? <Button size="sm" variant="ghost" onClick={() => setDialog({ restore: r })}>Restore</Button> : null}
                </div>
              </div>
            )) : <p className="panel__body muted">No rewards on this card.</p>}
          </section>

          <section className="panel">
            <div className="panel__body" style={{ paddingBottom: 4 }}><h2 className="section-title">Card access</h2></div>
            <div className="panel__body stack-sm" style={{ paddingTop: 8 }}>
              <p className="muted" style={{ fontSize: 14.5 }}>If a guest’s phone is lost or their link was forwarded, replace it. The old one stops working immediately.</p>
              <div className="toolbar">
                <Button size="sm" variant="secondary" onClick={() => setDialog('qr')}>Replace QR code</Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog('link')}>Replace card link</Button>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__body spread" style={{ paddingBottom: 4 }}>
              <h2 className="section-title">History</h2>
              <a {...linkProps(`/admin/activity?customerId=${id}`)} style={{ fontSize: 14 }}>Full log</a>
            </div>
            {data.audit.items.slice(0, 12).map((a) => (
              <div key={a.id} className="audit-item">
                <span>{ACTION_LABELS[a.action] ?? a.action}</span>
                <span className="audit-item__when">{fmtDateTime(a.at)}</span>
                <span className="audit-item__who">{a.actorName ?? (a.actorType === 'system' ? 'System' : a.actorType === 'customer' ? 'Guest' : '')}</span>
                {a.reason ? <span className="audit-item__reason">“{a.reason}”</span> : null}
              </div>
            ))}
          </section>
        </div>
      </div>

      {dialog === 'edit' ? <EditGuest profile={profile} onClose={() => setDialog(null)} onDone={() => done('Guest details saved')} /> : null}
      {dialog === 'undo' ? (
        <ReasonDialog title="Undo the last visit?" confirm="Undo visit" danger
          body={`Removes visit ${state.activeCard?.visitCount} from ${state.activeCard?.name}. The record is kept and marked as undone.`}
          onClose={() => setDialog(null)}
          submit={(reason) => api.post(`/api/admin/customers/${id}/visits/undo`, { reason })} onDone={() => done('Visit undone')} />
      ) : null}
      {dialog === 'add' ? <AddVisit id={id} onClose={() => setDialog(null)} onDone={() => done('Visit added')} /> : null}
      {dialog === 'qr' || dialog === 'link' ? (
        <ReasonDialog title={dialog === 'qr' ? 'Replace the QR code?' : 'Replace the card link?'} confirm="Replace"
          body={dialog === 'qr' ? 'The guest’s old QR code will stop working at the counter. Their card shows the new one straight away.' : 'Anyone with the old link loses access. Send the guest the new link on WhatsApp afterwards.'}
          onClose={() => setDialog(null)}
          submit={(reason) => api.post(`/api/admin/customers/${id}/rotate`, { kind: dialog, reason })}
          onDone={() => { done(dialog === 'qr' ? 'QR code replaced' : 'Card link replaced'); api.get<ShareInfo>(`/api/admin/customers/${id}/share`).then(setShare, () => {}); }} />
      ) : null}
      {dialog && typeof dialog === 'object' && 'revoke' in dialog ? (
        <ReasonDialog title={`Withdraw “${dialog.revoke.name}”?`} confirm="Withdraw reward" danger
          body="The guest will see it as withdrawn and staff won’t be able to redeem it. You can restore it later."
          onClose={() => setDialog(null)} submit={(reason) => api.post(`/api/admin/customer-rewards/${dialog.revoke.id}/revoke`, { reason })} onDone={() => done('Reward withdrawn')} />
      ) : null}
      {dialog && typeof dialog === 'object' && 'restore' in dialog ? (
        <ReasonDialog title={`Restore “${dialog.restore.name}”?`} confirm="Restore reward" body="It becomes available to redeem again."
          onClose={() => setDialog(null)} submit={(reason) => api.post(`/api/admin/customer-rewards/${dialog.restore.id}/restore`, { reason })} onDone={() => done('Reward restored')} />
      ) : null}
    </div>
  );
}

export function ReasonDialog({ title, body, confirm, danger, submit, onClose, onDone }: {
  title: string; body: string; confirm: string; danger?: boolean;
  submit: (reason: string) => Promise<unknown>; onClose: () => void; onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  async function go() {
    setBusy(true); setError(null);
    try { await submit(reason); onDone(); } catch (e: any) { setError(e); setBusy(false); }
  }
  return (
    <Sheet title={title} onClose={onClose} actions={<>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant={danger ? 'danger' : 'primary'} loading={busy} disabled={reason.trim().length < 3} onClick={go}>{confirm}</Button>
    </>}>
      <div className="stack">
        <p>{body}</p>
        {error && !error.fields.reason ? <Notice kind="error">{error.message}</Notice> : null}
        <Field label="Reason" hint="Saved in the activity log." value={reason} onChange={setReason} autoFocus maxLength={300} error={error?.fields.reason} />
      </div>
    </Sheet>
  );
}

function AddVisit({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  async function go() {
    setBusy(true); setError(null);
    try { await api.post(`/api/admin/customers/${id}/visits/correction`, { date, reason }); onDone(); }
    catch (e: any) { setError(e); setBusy(false); }
  }
  return (
    <Sheet title="Add a missed visit" onClose={onClose} actions={<>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button loading={busy} disabled={reason.trim().length < 3 || !date} onClick={go}>Add visit</Button>
    </>}>
      <div className="stack">
        <p>For visits the counter couldn’t record — for example when the till was offline. The one-visit-per-day rule still applies to that date.</p>
        {error && !Object.keys(error.fields).length ? <Notice kind="error">{error.message}</Notice> : null}
        <Field label="Date of the visit" type="date" value={date} onChange={setDate} error={error?.fields.date} />
        <Field label="Reason" hint="Saved in the activity log." value={reason} onChange={setReason} maxLength={300} error={error?.fields.reason} />
      </div>
    </Sheet>
  );
}

function EditGuest({ profile, onClose, onDone }: { profile: Detail['profile']; onClose: () => void; onDone: () => void }) {
  const [fullName, setName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone);
  const [status, setStatus] = useState(profile.status);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  async function go() {
    setBusy(true); setError(null);
    const body: any = { reason };
    if (fullName !== profile.fullName) body.fullName = fullName;
    if (phone !== profile.phone) body.phone = phone;
    if (status !== profile.status) body.status = status;
    try { await api.patch(`/api/admin/customers/${profile.id}`, body); onDone(); }
    catch (e: any) { setError(e); setBusy(false); }
  }
  return (
    <Sheet title="Edit guest details" onClose={onClose} actions={<>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button loading={busy} disabled={reason.trim().length < 3} onClick={go}>Save changes</Button>
    </>}>
      <div className="stack">
        {error && !Object.keys(error.fields).length ? <Notice kind="error">{error.message}</Notice> : null}
        <Field label="Name" value={fullName} onChange={setName} error={error?.fields.name} />
        <PhoneField label="Mobile number" value={phone} onChange={setPhone} error={error?.fields.phone} hint="Changing it signs the guest out on their devices." />
        <label className="check">
          <input type="checkbox" checked={status === 'suspended'} onChange={(e: any) => setStatus(e.target.checked ? 'suspended' : 'active')} />
          <span><strong>Put account on hold</strong><br /><span className="muted">Stops visits and redemptions. Progress is kept.</span></span>
        </label>
        <Field label="Reason for the change" hint="Saved in the activity log." value={reason} onChange={setReason} maxLength={300} error={error?.fields.reason} />
      </div>
    </Sheet>
  );
}

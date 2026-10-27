import { useEffect, useRef, useState } from 'react';
import type { LoyaltyState, RewardView, ShareInfo, StaffMe, VisitResult, RedemptionResult } from '../../../shared/types.ts';
import { api, ApiError, newRequestKey } from '../lib/api.ts';
import { navigate } from '../lib/router.ts';
import { fmtDate, fmtTime, t } from '../i18n/index.ts';
import { Button, Field, Notice, OfflineBar, PhoneField, Sheet, Wordmark, useToast } from '../ui/kit.tsx';
import { Alert, Back, Check, Gauge, Gift, Logout, Scan, Search, Star, UserPlus, Whatsapp } from '../ui/icons.tsx';
import { Scanner, scannerSupported } from './Scanner.tsx';
import { stampColumns } from '../customer/LoyaltyCard.tsx';
import { formatCode } from '../customer/LoyaltyCard.tsx';
import type { PublicConfig } from '../customer/CustomerApp.tsx';

type Counter = { minimumBillAmount: number | null; currency: string; outletRequired: boolean };
type View =
  | { kind: 'idle' }
  | { kind: 'guest'; state: LoyaltyState }
  | { kind: 'visit-done'; result: VisitResult }
  | { kind: 'redeem-done'; result: RedemptionResult; name: string }
  | { kind: 'register' }
  | { kind: 'registered'; created: boolean; state: LoyaltyState; share: ShareInfo };

export function StaffApp({ path, config }: { path: string; config: PublicConfig }) {
  const [me, setMe] = useState<StaffMe | null>(null);
  const [counter, setCounter] = useState<Counter | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'anon' | 'error'>('loading');
  // A scanned QR link (/s/<token>) is kept in memory only, then dropped from the address bar.
  const pendingScan = useRef<string | null>(null);
  if (pendingScan.current === null && path.startsWith('/s/')) pendingScan.current = location.href;

  const load = () => api.get<{ me: StaffMe; counter: Counter }>('/api/staff/me').then(
    (r) => { setMe(r.me); setCounter(r.counter); setStatus('ready'); },
    (e: ApiError) => setStatus(e.status === 401 ? 'anon' : 'error'),
  );
  useEffect(() => { if (path.startsWith('/s/')) history.replaceState(null, '', '/staff'); load(); }, []);

  if (status === 'loading') return <div className="login"><span className="spinner" style={{ color: 'var(--gold)' }} /></div>;
  if (status === 'error') return <div className="login"><div className="login__card"><Notice kind="error">Can’t reach Bay Leaf right now.</Notice><Button onClick={load}>{t('common.tryAgain')}</Button></div></div>;
  if (status === 'anon' || !me) return <StaffLogin onDone={load} hasScan={!!pendingScan.current} />;
  if (me.mustChangePassword) return <ChangePassword onDone={load} />;
  if (!me.outlet && counter?.outletRequired) return <OutletPicker me={me} onDone={load} />;

  return <Counter me={me} counter={counter!} config={config} initialScan={pendingScan.current} onSignedOut={() => { setMe(null); setStatus('anon'); }} />;
}

// ---------------------------------------------------------------------------
export function StaffLogin({ onDone, hasScan }: { onDone: () => void; hasScan: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api.post('/api/staff/login', { username, password }); onDone(); }
    catch (err: any) { setError(err.message); setBusy(false); }
  }
  return (
    <main className="login">
      <form className="login__card" onSubmit={submit} noValidate>
        <Wordmark />
        <div>
          <h1 style={{ fontSize: 24 }}>{t('staff.signInTitle')}</h1>
          {hasScan ? <p className="muted" style={{ marginTop: 6 }}>This code is for Bay Leaf staff. Sign in to open the guest’s card.</p> : null}
        </div>
        {error ? <Notice kind="error">{error}</Notice> : null}
        <Field label={t('staff.username')} value={username} onChange={setUsername} autoComplete="username" autoFocus />
        <Field label={t('staff.password')} type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <Button type="submit" size="xl" block loading={busy} disabled={!username || !password}>{t('staff.signIn')}</Button>
      </form>
    </main>
  );
}

export function ChangePassword({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  async function submit(e: Event) {
    e.preventDefault(); setBusy(true); setError(null);
    try { await api.post('/api/staff/password', { current, next }); onDone(); }
    catch (err: any) { setError(err); setBusy(false); }
  }
  return (
    <main className="login">
      <form className="login__card" onSubmit={submit} noValidate>
        <Wordmark />
        <div><h1 style={{ fontSize: 24 }}>{t('staff.changePassword')}</h1><p className="muted" style={{ marginTop: 6 }}>{t('staff.changePasswordLead')}</p></div>
        {error && !Object.keys(error.fields).length ? <Notice kind="error">{error.message}</Notice> : null}
        <Field label={t('staff.currentPassword')} type="password" value={current} onChange={setCurrent} autoComplete="current-password" error={error?.fields.current} />
        <Field label={t('staff.newPassword')} type="password" value={next} onChange={setNext} autoComplete="new-password" error={error?.fields.password} />
        <Button type="submit" size="xl" block loading={busy} disabled={!current || next.length < 10}>{t('staff.savePassword')}</Button>
      </form>
    </main>
  );
}

function OutletPicker({ me, onDone }: { me: StaffMe; onDone: () => void }) {
  const [outlets, setOutlets] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { api.get<{ id: string; name: string }[]>('/api/staff/outlets').then(setOutlets); }, []);
  return (
    <main className="login">
      <div className="login__card">
        <Wordmark />
        <div><h1 style={{ fontSize: 24 }}>{t('staff.chooseOutlet')}</h1><p className="muted" style={{ marginTop: 6 }}>{t('staff.chooseOutletLead')}</p></div>
        <div className="stack-sm">
          {outlets.map((o) => <Button key={o.id} variant="secondary" size="xl" block onClick={async () => { await api.post('/api/staff/outlet', { outletId: o.id }); onDone(); }}>{o.name}</Button>)}
        </div>
        <p className="muted" style={{ fontSize: 14 }}>Signed in as {me.fullName}</p>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
function Counter({ me, counter, config, initialScan, onSignedOut }: { me: StaffMe; counter: Counter; config: PublicConfig; initialScan: string | null; onSignedOut: () => void }) {
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [scanning, setScanning] = useState(false);
  const toast = useToast();
  const isAdmin = me.permissions.includes('reports.view');

  async function lookup(input: string): Promise<string | null> {
    try {
      const r = await api.post<{ found: boolean; reason?: string; state?: LoyaltyState }>('/api/staff/lookup', { input });
      if (r.found) { setView({ kind: 'guest', state: r.state! }); return null; }
      return ({
        no_phone_match: t('staff.notFoundPhone'), no_code_match: t('staff.notFoundCode'), revoked: t('staff.revoked'),
        unknown_qr: t('staff.unknownQr'),
      } as Record<string, string>)[r.reason!] ?? t('staff.unrecognised');
    } catch (e: any) { return e.message; }
  }

  useEffect(() => {
    if (initialScan) lookup(initialScan).then((err) => { if (err) toast(err, 'error'); });
  }, []);

  async function signOut() { await api.post('/api/staff/logout').catch(() => {}); onSignedOut(); }

  return (
    <div className="s-shell">
      <OfflineBar text="Offline — visits can’t be recorded until the connection is back." />
      <header className="s-bar">
        <Wordmark onDark name={config.name} />
        <span className="s-bar__tag">{t('staff.title')}</span>
        <div className="s-bar__who"><strong>{me.fullName}</strong>{me.outlet?.name ?? ''}</div>
        {isAdmin ? <a className="icon-btn" href="/admin" onClick={(e: any) => { e.preventDefault(); navigate('/admin'); }} aria-label={t('staff.adminPortal')}><Gauge /></a> : null}
        <button className="icon-btn" onClick={signOut} aria-label={t('common.signOut')}><Logout /></button>
      </header>
      <main className="s-main">
        {view.kind === 'idle' ? <Idle onScan={() => setScanning(true)} onLookup={lookup} onRegister={() => setView({ kind: 'register' })} onOpen={(id) => api.get<{ state: LoyaltyState }>(`/api/staff/customers/${id}`).then((r) => setView({ kind: 'guest', state: r.state }))} /> : null}
        {view.kind === 'guest' ? (
          <Guest key={view.state.customer.id + ':' + (view.state.activeCard?.visitCount ?? '')} state={view.state} counter={counter}
            onBack={() => setView({ kind: 'idle' })}
            onVisit={(result) => setView({ kind: 'visit-done', result })}
            onRedeemed={(result) => setView({ kind: 'redeem-done', result, name: view.state.customer.firstName })}
            onState={(state) => setView({ kind: 'guest', state })} />
        ) : null}
        {view.kind === 'visit-done' ? <VisitDone result={view.result} onDone={() => setView({ kind: 'idle' })} onGuest={() => setView({ kind: 'guest', state: view.result.state })} /> : null}
        {view.kind === 'redeem-done' ? <RedeemDone result={view.result} name={view.name} onDone={() => setView({ kind: 'idle' })} onGuest={() => setView({ kind: 'guest', state: view.result.state })} /> : null}
        {view.kind === 'register' ? <Register region={config.phoneRegion} onBack={() => setView({ kind: 'idle' })} onDone={(r) => setView({ kind: 'registered', ...r })} /> : null}
        {view.kind === 'registered' ? <Registered {...view} onContinue={() => setView({ kind: 'guest', state: view.state })} onDone={() => setView({ kind: 'idle' })} /> : null}
      </main>
      {scanning ? (
        <Scanner onClose={() => setScanning(false)} onResult={async (text) => {
          setScanning(false);
          const err = await lookup(text);
          if (err) toast(err, 'error');
        }} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Idle({ onScan, onLookup, onRegister, onOpen }: { onScan: () => void; onLookup: (s: string) => Promise<string | null>; onRegister: () => void; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [recent, setRecent] = useState<{ customerId: string; name: string; memberCode: string; action: string; at: string; progress: string | null }[]>([]);
  useEffect(() => { api.get<any[]>('/api/staff/recent').then(setRecent, () => {}); }, []);
  const canScan = scannerSupported();

  async function find(e: Event) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setMsg(null);
    const err = await onLookup(q.trim());
    setBusy(false);
    if (err) setMsg(err);
  }
  return (
    <div className="s-idle">
      <div className="stack">
        <Button size="xl" block className="scan-btn" onClick={onScan}><Scan />{t('staff.scan')}</Button>
        {!canScan ? <p className="muted" style={{ fontSize: 14.5 }}>{t('scanner.unsupported')}</p> : null}
      </div>
      <div className="panel panel__body stack">
        <form className="stack-sm" onSubmit={find}>
          <label className="field__label" htmlFor="find">{t('staff.findLabel')}</label>
          <div className="find-row">
            {/* Also accepts input from a USB / Bluetooth QR scanner, which "types" the code. */}
            <input id="find" className="input" value={q} onChange={(e: any) => setQ(e.target.value)} placeholder={t('staff.findPlaceholder')}
              autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text" enterKeyHint="search" />
            <Button type="submit" loading={busy} aria-label={t('staff.find')}><Search />{t('staff.find')}</Button>
          </div>
        </form>
        {msg ? (
          <Notice kind="warn">
            {msg}
            {msg === t('staff.notFoundPhone') ? <div style={{ marginTop: 8 }}><Button size="sm" variant="secondary" onClick={onRegister}>{t('staff.newGuest')}</Button></div> : null}
          </Notice>
        ) : null}
        <Button variant="secondary" block onClick={onRegister}><UserPlus />{t('staff.newGuest')}</Button>
      </div>
      <section className="panel s-idle__wide" aria-labelledby="recent-h">
        <div className="panel__body" style={{ paddingBottom: 8 }}><h2 className="section-title" id="recent-h" style={{ fontSize: 17 }}>{t('staff.recent')}</h2></div>
        {recent.length ? (
          <ul className="recent">
            {recent.map((r) => (
              <li key={r.customerId}>
                <button onClick={() => onOpen(r.customerId)}>
                  <span><span className="list-row__title">{r.name}</span><br /><span className="list-row__sub">{actionLabel(r.action)} · {fmtTime(r.at)}</span></span>
                  {r.progress ? <span className="chip chip--next tnum">{r.progress}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="panel__body muted" style={{ paddingTop: 0 }}>{t('staff.recentEmpty')}</p>}
      </section>
    </div>
  );
}

function actionLabel(a: string) {
  return a === 'visit.recorded' ? 'Visit recorded' : a === 'reward.redeemed' ? 'Reward redeemed' : 'Registered';
}

// ---------------------------------------------------------------------------
function MiniStamps({ done, total, milestones }: { done: number; total: number; milestones: number[] }) {
  const set = new Set(milestones);
  return (
    <div className="mini-stamps" style={{ '--cols': stampColumns(total) }} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => <i key={i} data-done={String(i < done)} data-milestone={String(set.has(i + 1))} />)}
    </div>
  );
}

function Guest({ state, counter, onBack, onVisit, onRedeemed, onState }: {
  state: LoyaltyState; counter: Counter; onBack: () => void;
  onVisit: (r: VisitResult) => void; onRedeemed: (r: RedemptionResult) => void; onState: (s: LoyaltyState) => void;
}) {
  const card = state.activeCard;
  // One key per "confirm this visit" intent: a retry after a dropped connection reuses it,
  // so the server records the visit once no matter how many times the button is pressed.
  const visitKey = useRef(newRequestKey());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [bill, setBill] = useState('');
  const [redeeming, setRedeeming] = useState<RewardView | null>(null);
  const [share, setShare] = useState<ShareInfo | null>(null);
  const needsBill = counter.minimumBillAmount !== null;

  useEffect(() => { api.get<ShareInfo>(`/api/staff/customers/${state.customer.id}/share`).then(setShare, () => {}); }, [state.customer.id]);

  async function confirmVisit() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await api.post<VisitResult>(`/api/staff/customers/${state.customer.id}/visits`, {
        idempotencyKey: visitKey.current, billAmount: needsBill ? bill : undefined,
      });
      visitKey.current = newRequestKey();
      onVisit(r);
    } catch (e: any) {
      setError(e);
      // A definite refusal (not a network drop) means this intent is finished; a new attempt gets a new key.
      if (e.status && e.status !== 0 && e.status < 500) visitKey.current = newRequestKey();
      if (e.code === 'DAILY_LIMIT') api.get<{ state: LoyaltyState }>(`/api/staff/customers/${state.customer.id}`).then((r) => onState(r.state), () => {});
    } finally { setBusy(false); }
  }

  let blocked: string | null = null;
  if (state.customer.status === 'suspended') blocked = t('staff.suspended');
  else if (!card) blocked = t('staff.awaiting');
  else if (!state.today.canRecordVisit && state.today.lastVisitAt) blocked = t('staff.alreadyToday', { time: fmtTime(state.today.lastVisitAt) });

  return (
    <div className="guest">
      <div className="guest__head">
        <button className="icon-btn" onClick={onBack} aria-label={t('common.back')}><Back /></button>
        <div style={{ minWidth: 0 }}>
          <h1 className="guest__name">{state.customer.fullName}</h1>
          <div className="guest__meta">
            <span className="tnum" dir="ltr">{formatCode(state.customer.memberCode)}</span>
            <span dir="ltr">{state.customer.phoneMasked}</span>
            {card ? <span>{card.name} · {card.levelLabel}</span> : null}
          </div>
        </div>
      </div>

      <div className="guest__cols">
        <div className="stack">
          {card ? (
            <section className="panel guest__progress" aria-label={t('staff.cardProgress', { n: card.visitCount, total: card.requiredVisits, card: card.name })}>
              <div className="guest__count tnum">{card.visitCount}<small> / {card.requiredVisits}</small></div>
              <div className="stack-sm">
                <MiniStamps done={card.visitCount} total={card.requiredVisits} milestones={card.milestones.map((m) => m.milestone)} />
                {card.nextMilestone ? <p className="muted" style={{ fontSize: 14.5 }}>Next reward at visit {card.nextMilestone.visit}: <strong style={{ color: 'var(--ink)' }}>{card.nextMilestone.isPlaceholder ? 'not announced yet' : card.nextMilestone.rewardName}</strong></p> : null}
              </div>
            </section>
          ) : null}

          {error ? (
            <Notice kind={error.code === 'NETWORK' ? 'warn' : 'error'}>
              {error.message}
              {error.code === 'NETWORK' ? <div style={{ marginTop: 6 }}>It’s safe to press Confirm again — the visit will only be counted once.</div> : null}
            </Notice>
          ) : null}

          {blocked ? <Notice kind="warn">{blocked}</Notice> : (
            <div className="guest__actions">
              {needsBill ? (
                <Field label={t('staff.billLabel', { currency: counter.currency })} hint={t('staff.billHint', { min: counter.minimumBillAmount!, currency: counter.currency })}
                  value={bill} onChange={setBill} inputMode="decimal" error={error?.fields.billAmount} />
              ) : null}
              <Button size="xl" block className="confirm-btn" loading={busy} onClick={confirmVisit} disabled={needsBill && !bill}>
                <span>{t('staff.confirmVisit')}<small>{t('staff.confirmVisitSub', { n: card!.visitCount + 1, total: card!.requiredVisits })}</small></span>
              </Button>
            </div>
          )}
        </div>

        <div className="stack">
          <section className="panel" aria-labelledby="ready-h">
            <div className="panel__body" style={{ paddingBottom: state.rewardsReady.length ? 4 : undefined }}>
              <h2 className="section-title" id="ready-h" style={{ fontSize: 17 }}>{t('staff.rewardsReady')}</h2>
              {!state.rewardsReady.length ? <p className="section-sub">{card?.nextMilestone ? t('staff.noRewards', { n: card.nextMilestone.visit }) : t('staff.noRewardsNone')}</p> : null}
            </div>
            {state.rewardsReady.length ? (
              <ul className="rewards">
                {state.rewardsReady.map((r) => (
                  <li key={r.id} className="reward" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                    <div>
                      <div className="reward__visit">{t('rewards.visit', { n: r.milestone })} · {r.cardName}</div>
                      <div className="reward__name">{r.name}</div>
                      {r.isPlaceholder ? <div className="reward__desc">Earned. Bay Leaf hasn’t named this reward yet.</div> : !r.isAvailable ? <div className="reward__desc">{t('rewards.unavailable')}</div> : null}
                    </div>
                    <Button variant="gold" disabled={r.isPlaceholder || !r.isAvailable || state.customer.status !== 'active'} onClick={() => setRedeeming(r)}>
                      {r.isPlaceholder ? t('staff.redeemNotReady') : t('staff.redeem')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          {share ? <Button variant="secondary" block href={share.whatsappUrl} target="_blank" rel="noopener"><Whatsapp />{t('staff.sendWhatsapp')}</Button> : null}
          <p className="muted" style={{ fontSize: 14 }}>{t('staff.mistake')}</p>
        </div>
      </div>

      {redeeming ? <RedeemSheet reward={redeeming} name={state.customer.firstName} onClose={() => setRedeeming(null)} onDone={onRedeemed} /> : null}
    </div>
  );
}

function RedeemSheet({ reward, name, onClose, onDone }: { reward: RewardView; name: string; onClose: () => void; onDone: (r: RedemptionResult) => void }) {
  const key = useRef(newRequestKey());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  async function go() {
    if (busy) return;
    setBusy(true); setError(null);
    try { onDone(await api.post<RedemptionResult>(`/api/staff/rewards/${reward.id}/redeem`, { idempotencyKey: key.current })); }
    catch (e: any) { setError(e); setBusy(false); }
  }
  const d = error?.details ?? {};
  return (
    <Sheet title={t('staff.redeemTitle')} onClose={onClose} actions={<>
      <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      {error?.code === 'ALREADY_REDEEMED' ? null : <Button variant="gold" loading={busy} onClick={go}><Gift />{t('staff.redeemConfirm')}</Button>}
    </>}>
      <p style={{ fontSize: 17 }}>{t('staff.redeemBody', { reward: reward.name, name })}</p>
      {error ? (
        <div style={{ marginTop: 16 }}>
          <Notice kind="error">
            {error.code === 'ALREADY_REDEEMED' && d.reference
              ? t('staff.alreadyRedeemed', { date: fmtDate(d.redeemedAt), staff: d.staffName ?? '—', ref: d.reference })
              : error.message}
            {error.code === 'NETWORK' ? <div style={{ marginTop: 6 }}>It’s safe to try again — it will only be redeemed once.</div> : null}
          </Notice>
        </div>
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
function VisitDone({ result, onDone, onGuest }: { result: VisitResult; onDone: () => void; onGuest: () => void }) {
  const s = result.state;
  const completedCard = result.cardCompleted ? s.completedCards[0] : null;
  useEffect(() => { const id = setTimeout(onDone, 45000); return () => clearTimeout(id); }, []);
  return (
    <section className="panel result" aria-live="assertive">
      <div className="result__mark"><Check /></div>
      <h2>{completedCard ? t('staff.cardCompleted', { card: completedCard.name }) : t('staff.visitRecorded', { n: result.visit.visitNumber })}</h2>
      <p>
        {completedCard
          ? (result.nextCardActivated ? t('staff.cardCompletedNext', { name: s.customer.firstName, next: `${result.nextCardActivated.name} (${result.nextCardActivated.levelLabel})` }) : t('staff.cardCompletedSoon'))
          : t('staff.visitRecordedLead', { name: s.customer.firstName, n: s.activeCard!.visitCount, total: s.activeCard!.requiredVisits })}
      </p>
      {result.replayed ? <Notice kind="info">{t('staff.replayed')}</Notice> : null}
      {result.unlockedRewards.length ? (
        <div className="unlocked">
          <strong style={{ textAlign: 'start' }}>{t('staff.unlocked')}</strong>
          {result.unlockedRewards.map((r) => <div key={r.id}><Star filled />{r.name}{r.isPlaceholder ? ' (to be announced)' : ''}</div>)}
        </div>
      ) : null}
      <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
        {s.rewardsReady.some((r) => !r.isPlaceholder) ? <Button variant="secondary" onClick={onGuest}><Gift />{t('staff.rewardsReady')}</Button> : null}
        <Button size="xl" onClick={onDone} autoFocus>{t('staff.done')}</Button>
      </div>
      <p className="muted" style={{ fontSize: 13.5 }}>Reference {result.visit.reference}</p>
    </section>
  );
}

function RedeemDone({ result, name, onDone, onGuest }: { result: RedemptionResult; name: string; onDone: () => void; onGuest: () => void }) {
  return (
    <section className="panel result" aria-live="assertive">
      <div className="result__mark"><Gift /></div>
      <h2>{t('staff.redeemed')}</h2>
      <p>{t('staff.redeemedLead', { reward: result.redemption.rewardName, name, ref: result.redemption.reference })}</p>
      {result.replayed ? <Notice kind="info">{t('staff.replayed')}</Notice> : null}
      <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
        <Button variant="secondary" onClick={onGuest}>Back to {name}</Button>
        <Button size="xl" onClick={onDone} autoFocus>{t('staff.done')}</Button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
function Register({ region, onBack, onDone }: { region: string; onBack: () => void; onDone: (r: { created: boolean; state: LoyaltyState; share: ShareInfo }) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { onDone(await api.post('/api/staff/customers', { name, phone })); }
    catch (err: any) { setError(err); setBusy(false); }
  }
  return (
    <section className="panel panel__body" style={{ maxWidth: 520 }}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="row">
          <button type="button" className="icon-btn" onClick={onBack} aria-label={t('common.back')}><Back /></button>
          <div><h1 className="section-title" style={{ fontSize: 22 }}>{t('staff.registerTitle')}</h1><p className="section-sub">{t('staff.registerLead')}</p></div>
        </div>
        {error && !Object.keys(error.fields).length ? <Notice kind="error">{error.message}</Notice> : null}
        <Field label="Guest name" value={name} onChange={setName} autoFocus autoComplete="off" error={error?.fields.name} />
        <PhoneField label={t('join.phone')} value={phone} onChange={setPhone} region={region} placeholder="50 123 4567" error={error?.fields.phone} />
        <Button type="submit" size="xl" block loading={busy} disabled={name.trim().length < 2 || !phone.trim()}>{t('staff.register')}</Button>
      </form>
    </section>
  );
}

function Registered({ created, state, share, onContinue, onDone }: { created: boolean; state: LoyaltyState; share: ShareInfo; onContinue: () => void; onDone: () => void }) {
  const toast = useToast();
  return (
    <section className="panel result">
      <div className="result__mark">{created ? <Check /> : <Alert />}</div>
      <h2>{created ? t('staff.registeredTitle', { name: state.customer.firstName }) : t('staff.existingTitle', { name: state.customer.fullName })}</h2>
      {!created ? <p>{t('staff.existingLead')}</p> : <p className="tnum" dir="ltr">{formatCode(state.customer.memberCode)}</p>}
      <div className="stack-sm" style={{ width: '100%', maxWidth: 420, marginTop: 8 }}>
        <Button variant="whatsapp" size="xl" block href={share.whatsappUrl} target="_blank" rel="noopener"><Whatsapp />{t('staff.sendWhatsapp')}</Button>
        <p className="muted" style={{ fontSize: 14 }}>{t('staff.whatsappNote')}</p>
        <Button variant="secondary" block onClick={() => navigator.clipboard?.writeText(share.cardUrl).then(() => toast(t('staff.copied')), () => {})}>{t('staff.copyLink')}</Button>
        <Button size="xl" block onClick={onContinue}>{t('staff.openGuest')}</Button>
        <Button variant="ghost" block onClick={onDone}>{t('staff.done')}</Button>
      </div>
    </section>
  );
}

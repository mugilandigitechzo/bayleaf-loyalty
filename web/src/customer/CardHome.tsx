import { useEffect, useRef, useState } from 'react';
import type { LoyaltyState, RewardView, ShareInfo, VisitHistoryItem, RedemptionHistoryItem, CardView } from '../../../shared/types.ts';
import { api } from '../lib/api.ts';
import { navigate } from '../lib/router.ts';
import { fmtDate, t } from '../i18n/index.ts';
import { Button, Notice, OfflineBar, Sheet, Skeleton, Wordmark } from '../ui/kit.tsx';
import { Gift, Lock, Logout, Star, Whatsapp, Check } from '../ui/icons.tsx';
import { LoyaltyCard, formatCode } from './LoyaltyCard.tsx';

type Me = { scope: 'link' | 'verified'; state: LoyaltyState };

function greeting(name: string) {
  const h = new Date().getHours();
  return t(h < 12 ? 'home.greetMorning' : h < 17 ? 'home.greetAfternoon' : 'home.greetEvening', { name });
}

/** Remember the last stamp count this device saw, so newly added stamps animate in once. */
function useFreshFrom(card: CardView | null) {
  const [from, setFrom] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!card) return;
    const k = 'bl_seen_' + card.id;
    let seen: number | null = null;
    try { const v = localStorage.getItem(k); seen = v === null ? null : Number(v); } catch { /* storage blocked */ }
    if (seen !== null && seen < card.visitCount) setFrom(seen);
    try { localStorage.setItem(k, String(card.visitCount)); } catch { /* ignore */ }
  }, [card?.id, card?.visitCount]);
  return from;
}

export function CardHome({ me: initial, onSignedOut }: { me: Me; onSignedOut: () => void }) {
  const [me, setMe] = useState<Me>(initial);
  const [qrOpen, setQrOpen] = useState(false);
  const [share, setShare] = useState<ShareInfo | null>(null);
  const { state, scope } = me;
  const card = state.activeCard;
  const lastCompleted = state.completedCards[0] ?? null;
  const freshFrom = useFreshFrom(card);

  // The card is live: refresh when the guest comes back to the tab, and every 20 s while visible
  // (so the stamp appears moments after staff confirm the visit).
  useEffect(() => {
    let timer: any;
    const refresh = () => api.get<Me>('/api/customer/me').then(setMe, (e) => { if (e.status === 401) onSignedOut(); });
    const loop = () => { timer = setTimeout(() => { if (document.visibilityState === 'visible') refresh(); loop(); }, 20000); };
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    loop();
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => { api.get<ShareInfo>('/api/customer/share').then(setShare, () => {}); }, []);

  async function signOut() {
    await api.post('/api/customer/logout').catch(() => {});
    onSignedOut();
  }

  const subline = card
    ? (card.remaining === 1 ? t('home.toGoOne', { card: card.name }) : t('home.toGoMany', { n: card.remaining, card: card.name }))
    : t('home.allDone');

  return (
    <>
      <OfflineBar text={t('common.offline')} />
      <div className="c-shell">
        <header className="c-top">
          <Wordmark />
          <div className="c-top__actions">
            {share ? (
              <a className="icon-btn" href={share.whatsappUrl} target="_blank" rel="noopener" aria-label={t('home.share')}><Whatsapp /></a>
            ) : null}
          </div>
        </header>

        <div className="c-greet">
          <h1>{greeting(state.customer.firstName)}</h1>
          <p>{subline}</p>
        </div>

        <div className="c-stack">
          {state.rewardsReady.length ? (
            <div className="ready-banner" role="status">
              <Gift />
              <div>
                <strong>{state.rewardsReady.length === 1 ? t('home.readyOne') : t('home.readyMany', { n: state.rewardsReady.length })}</strong>
                <span>{state.rewardsReady.some((r) => !r.isPlaceholder)
                  ? `${state.rewardsReady.filter((r) => !r.isPlaceholder).map((r) => r.name).join(', ')}. ${t('home.readyHint')}`
                  : t('home.readySoon')}</span>
              </div>
            </div>
          ) : null}

          {card ? (
            <LoyaltyCard card={card} firstName={state.customer.firstName} memberCode={state.customer.memberCode} freshFrom={freshFrom} />
          ) : lastCompleted ? (
            <LoyaltyCard card={lastCompleted} firstName={state.customer.firstName} memberCode={state.customer.memberCode} />
          ) : null}

          <section className="panel qr-panel" aria-labelledby="qr-h">
            <button className="qr-panel__code" onClick={() => setQrOpen(true)} aria-label={t('qr.enlarge')}>
              <QrImage />
            </button>
            <div>
              <h2 id="qr-h">{t('qr.title')}</h2>
              <p>{t('qr.lead')}</p>
              <p className="member-code" aria-label={t('card.memberCode') + ' ' + state.customer.memberCode.split('').join(' ')}>{formatCode(state.customer.memberCode)}</p>
            </div>
          </section>

          <Rewards state={state} />
          <NextCard state={state} />
          <History scope={scope} state={state} />

          {share ? (
            <Button variant="whatsapp" block href={share.whatsappUrl} target="_blank" rel="noopener"><Whatsapp />{t('home.share')}</Button>
          ) : null}
        </div>

        <footer className="c-footer">
          {(card ?? lastCompleted)?.terms ? (
            <details>
              <summary>{t('terms.title')}</summary>
              <p style={{ whiteSpace: 'pre-line' }}>{(card ?? lastCompleted)!.terms}</p>
            </details>
          ) : null}
          <div><Button variant="ghost" onClick={signOut}><Logout />{t('common.signOut')}</Button></div>
        </footer>
      </div>

      {qrOpen ? (
        <Sheet title={t('qr.title')} onClose={() => setQrOpen(false)}>
          <div className="qr-full">
            <div className="qr-full__code"><QrImage /></div>
            <p className="member-code" style={{ fontSize: 22 }}>{formatCode(state.customer.memberCode)}</p>
            <p className="muted">{t('qr.fullLead')}</p>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

function QrImage() {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="muted" style={{ fontSize: 13, textAlign: 'center' }}>{t('qr.error')}</span>;
  return <img src="/api/customer/qr.svg" alt="" width="240" height="240" onError={() => setFailed(true)} />;
}

function rewardChip(r: RewardView, card: CardView | null) {
  if (r.status === 'eligible') {
    if (r.isPlaceholder) return <span className="chip chip--next"><Check />{t('rewards.unlockedSoon')}</span>;
    return r.isAvailable ? <span className="chip chip--ready"><Check />{t('rewards.ready')}</span>
      : <span className="chip chip--done">{t('rewards.unavailable')}</span>;
  }
  if (r.status === 'redeemed') return <span className="chip chip--done">{t('rewards.enjoyed', { date: fmtDate(r.redeemedAt!, { day: 'numeric', month: 'short' }) })}</span>;
  if (r.status === 'revoked') return <span className="chip chip--danger">{t('rewards.withdrawn')}</span>;
  if (r.inProgress && card) return <span className="chip chip--next">{t('rewards.next', { n: t(r.milestone - card.visitCount === 1 ? 'common.visitOne' : 'common.visitMany', { n: r.milestone - card.visitCount }) })}</span>;
  return <span className="chip chip--locked"><Lock />{t('rewards.locked')}</span>;
}

function Rewards({ state }: { state: LoyaltyState }) {
  const card = state.activeCard;
  const fromPrevious = state.rewardsReady.filter((r) => r.cardId !== card?.id);
  const list = [...fromPrevious, ...(card?.milestones ?? [])];
  if (!list.length) return null;
  return (
    <section className="panel" aria-labelledby="rw-h">
      <div className="panel__body" style={{ paddingBottom: 8 }}><h2 className="section-title" id="rw-h">{t('rewards.title')}</h2></div>
      <ul className="rewards">
        {list.map((r) => (
          <li key={r.id} className={`reward reward--${r.status}`}>
            <span className="reward__badge"><Star filled={r.status === 'eligible' || r.status === 'redeemed'} /></span>
            <div>
              <div className="reward__visit">
                {t('rewards.visit', { n: r.milestone })}{r.cardId !== card?.id ? ' · ' + t('rewards.fromCard', { card: r.cardName }) : ''}
              </div>
              <div className="reward__name">{r.name}</div>
              <div className="reward__desc">{r.isPlaceholder ? t('rewards.soon') : r.description}</div>
              <div className="reward__meta">{rewardChip(r, card)}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NextCard({ state }: { state: LoyaltyState }) {
  const n = state.nextCard;
  if (!n) return null;
  const current = state.activeCard?.name ?? state.completedCards[0]?.name ?? '';
  return (
    <section className="panel next-card" aria-label={n.state === 'locked' ? t('next.lockedTitle', { name: n.name!, level: n.levelLabel! }) : t('next.soonTitle')}>
      <div className="next-card__icon"><Lock /></div>
      <div>
        <h2 className="section-title" style={{ fontSize: 17 }}>
          {n.state === 'locked' ? t('next.lockedTitle', { name: n.name!, level: n.levelLabel! }) : t('next.soonTitle')}
        </h2>
        <p className="section-sub">
          {n.state === 'locked' ? t('next.lockedLead', { card: current })
            : state.awaitingNextLevel ? t('next.awaitLead', { card: current }) : t('next.soonLead')}
        </p>
      </div>
    </section>
  );
}

function History({ scope, state }: { scope: 'link' | 'verified'; state: LoyaltyState }) {
  const [tab, setTab] = useState<'visits' | 'rewards' | 'cards'>('visits');
  const [visits, setVisits] = useState<VisitHistoryItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionHistoryItem[]>([]);
  const [error, setError] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (scope !== 'verified' || loaded.current) return;
    loaded.current = true;
    api.get<{ visits: { items: VisitHistoryItem[]; nextCursor: string | null }; redemptions: RedemptionHistoryItem[] }>('/api/customer/history')
      .then((r) => { setVisits(r.visits.items); setCursor(r.visits.nextCursor); setRedemptions(r.redemptions); }, () => setError(true));
  }, [scope, state.activeCard?.visitCount]);

  async function more() {
    const r = await api.get<{ visits: { items: VisitHistoryItem[]; nextCursor: string | null } }>(`/api/customer/history?before=${encodeURIComponent(cursor!)}`);
    setVisits((v) => [...(v ?? []), ...r.visits.items]); setCursor(r.visits.nextCursor);
  }

  if (scope !== 'verified') {
    return (
      <section className="panel panel__body stack-sm">
        <h2 className="section-title">{t('history.verifyTitle')}</h2>
        <p className="section-sub">{t('history.verifyLead')}</p>
        <div style={{ marginTop: 8 }}><Button variant="secondary" onClick={() => navigate('/sign-in')}>{t('history.verify')}</Button></div>
      </section>
    );
  }

  const tabs = [['visits', t('history.visits')], ['rewards', t('history.rewards')], ['cards', t('history.cards')]] as const;
  return (
    <section className="panel" aria-labelledby="hist-h">
      <div className="panel__body" style={{ paddingBottom: 12 }}><h2 className="section-title" id="hist-h">{t('history.title')}</h2></div>
      <div className="tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k as any)}>{label}</button>
        ))}
      </div>
      {error ? <div className="panel__body"><Notice kind="error">{t('error.cardLead')}</Notice></div> : null}
      {tab === 'visits' ? (
        visits === null && !error ? <div className="panel__body stack-sm"><Skeleton /><Skeleton /><Skeleton /></div> :
        visits && visits.length ? (
          <>
            <ul className="history">
              {visits.map((v) => (
                <li key={v.id}>
                  <span className="history__what">{t('history.visitLine', { n: v.visitNumber, card: v.cardName })}</span>
                  <span className="history__when">{fmtDate(v.at)}</span>
                </li>
              ))}
            </ul>
            {cursor ? <div className="panel__body" style={{ paddingTop: 0 }}><Button variant="ghost" onClick={more}>{t('history.more')}</Button></div> : null}
          </>
        ) : <p className="panel__body muted">{t('history.noVisits')}</p>
      ) : null}
      {tab === 'rewards' ? (
        redemptions.length ? (
          <ul className="history">
            {redemptions.map((r) => (
              <li key={r.id}><span className="history__what">{r.rewardName}</span><span className="history__when">{fmtDate(r.at)}</span></li>
            ))}
          </ul>
        ) : <p className="panel__body muted">{t('history.noRewards')}</p>
      ) : null}
      {tab === 'cards' ? (
        state.completedCards.length ? (
          <ul className="history">
            {state.completedCards.map((c) => (
              <li key={c.id}>
                <span className="history__what">{c.name} · {c.levelLabel}</span>
                <span className="history__when">{t('history.cardDone', { date: fmtDate(c.completedAt!) })}</span>
              </li>
            ))}
          </ul>
        ) : <p className="panel__body muted">{t('history.noCards')}</p>
      ) : null}
    </section>
  );
}


import { useState } from 'react';
import type { CardTheme } from '../../../shared/types.ts';
import { api, ApiError } from '../lib/api.ts';
import { Button, Field, Notice, Sheet, Skeleton, useLoad, useToast } from '../ui/kit.tsx';
import { Edit, Info, Plus } from '../ui/icons.tsx';
import { LoyaltyCard } from '../customer/LoyaltyCard.tsx';
import { LoadError, PageHead } from './AdminApp.tsx';

type RewardDef = { id: string; milestoneVisit: number; name: string; description: string; terms: string; isPlaceholder: boolean; isAvailable: boolean; eligibleCount: number; redeemedCount: number };
type CardDef = { id: string; sequence: number; name: string; levelLabel: string; requiredVisits: number; description: string; terms: string; theme: CardTheme; status: 'draft' | 'published'; activeCustomers: number; completedCustomers: number; rewards: RewardDef[] };

export const THEMES: { id: CardTheme; label: string; bg: string }[] = [
  { id: 'forest', label: 'Forest', bg: 'linear-gradient(135deg,#123D32,#0B2923)' },
  { id: 'midnight', label: 'Midnight', bg: 'linear-gradient(135deg,#173543,#0D1F28)' },
  { id: 'saffron', label: 'Oud', bg: 'linear-gradient(135deg,#5A3417,#321C0C)' },
  { id: 'ivory', label: 'Ivory', bg: 'linear-gradient(135deg,#FBF8F1,#EFE7D6)' },
];

export function Cards() {
  const { data, error, reload } = useLoad<CardDef[]>(() => api.get('/api/admin/cards'));
  const [editing, setEditing] = useState<CardDef | 'new' | null>(null);
  const [reward, setReward] = useState<{ card: CardDef; reward: RewardDef | null } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const toast = useToast();

  if (error && !data) return <div className="a-page"><LoadError error={error} retry={reload} /></div>;
  if (!data) return <div className="a-page"><Skeleton h={40} w={240} /><Skeleton h={300} r={14} /></div>;
  const current = data.find((c) => c.id === selected) ?? data[0];
  const nextExists = data.length > 1;

  async function publish(c: CardDef) {
    try {
      const r = await api.post<{ activatedFor: number }>(`/api/admin/cards/${c.id}/publish`);
      toast(r.activatedFor ? `${c.name} is live. ${r.activatedFor} waiting guest${r.activatedFor === 1 ? '' : 's'} moved onto it.` : `${c.name} is live.`);
      reload();
    } catch (e: any) { toast(e.message, 'error'); }
  }
  async function unpublish(c: CardDef) {
    try { await api.post(`/api/admin/cards/${c.id}/unpublish`); toast(`${c.name} is back to draft.`); reload(); }
    catch (e: any) { toast(e.message, 'error'); }
  }

  return (
    <div className="a-page">
      <PageHead title="Cards & rewards" sub="Guests move to the next card only when they complete the current one. Cards never expire."
        actions={<Button onClick={() => setEditing('new')}><Plus />Add Card {data.length + 1}</Button>} />

      <section className="panel">
        {data.map((c) => (
          <button key={c.id} className="list-row card-row" onClick={() => setSelected(c.id)} aria-pressed={current?.id === c.id}
            style={current?.id === c.id ? { background: 'rgba(18,61,50,.05)' } : undefined}>
            <div className="card-thumb" style={{ background: THEMES.find((th) => th.id === c.theme)?.bg, color: c.theme === 'ivory' ? '#A88645' : undefined }}>{c.sequence}</div>
            <div>
              <div className="list-row__title">{c.name} · {c.levelLabel}</div>
              <div className="list-row__sub">{c.requiredVisits} visits · {c.rewards.length} reward{c.rewards.length === 1 ? '' : 's'} · {c.activeCustomers} on it now · {c.completedCustomers} completed</div>
            </div>
            <span className={`chip ${c.status === 'published' ? 'chip--ok' : 'chip--locked'}`}>{c.status === 'published' ? 'Live' : 'Draft'}</span>
          </button>
        ))}
        {!nextExists ? (
          <div className="panel__body"><Notice kind="info">Card 2 hasn’t been set up. Guests who finish Card 1 see “Next level coming soon” and keep any rewards they’ve earned. Add Card 2 when you’re ready.</Notice></div>
        ) : null}
      </section>

      {current ? (
        <div className="grid-2">
          <section className="panel">
            <div className="panel__body spread">
              <div>
                <h2 className="section-title">{current.name} rewards</h2>
                <p className="section-sub">Earned at a visit milestone. Staff redeem each one once.</p>
              </div>
              <div className="toolbar">
                <Button size="sm" variant="secondary" onClick={() => setEditing(current)}><Edit />Edit card</Button>
                <Button size="sm" variant="secondary" onClick={() => setReward({ card: current, reward: null })}><Plus />Add reward</Button>
              </div>
            </div>
            {current.rewards.map((r) => (
              <div key={r.id} className="reward-edit">
                <div className="reward-edit__m"><small>Visit</small>{r.milestoneVisit}</div>
                <div>
                  <div className="list-row__title">{r.name}{r.isPlaceholder ? <span className="chip chip--danger" style={{ marginInlineStart: 8 }}>Needs a name</span> : null}{!r.isAvailable ? <span className="chip chip--done" style={{ marginInlineStart: 8 }}>Paused</span> : null}</div>
                  <div className="list-row__sub">{r.description || 'No description'}</div>
                  <div className="list-row__sub">{r.eligibleCount} earned and waiting · {r.redeemedCount} redeemed</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setReward({ card: current, reward: r })}>Edit</Button>
              </div>
            ))}
            <div className="panel__body">
              {current.status === 'draft'
                ? <Button variant="gold" onClick={() => publish(current)}>Publish {current.name}</Button>
                : current.activeCustomers + current.completedCustomers === 0
                  ? <Button variant="ghost" onClick={() => unpublish(current)}>Move back to draft</Button> : null}
            </div>
          </section>
          <div className="stack">
            <LoyaltyCard firstName="Preview" memberCode="BL000000" card={{
              id: 'preview', sequence: current.sequence, name: current.name, levelLabel: current.levelLabel, theme: current.theme,
              requiredVisits: current.requiredVisits, visitCount: Math.min(current.rewards[0]?.milestoneVisit ?? 1, current.requiredVisits),
              remaining: current.requiredVisits - Math.min(current.rewards[0]?.milestoneVisit ?? 1, current.requiredVisits),
              status: 'active', terms: current.terms, activatedAt: '', completedAt: null,
              milestones: current.rewards.map((r) => ({ id: r.id, milestone: r.milestoneVisit, name: r.name, description: r.description, terms: r.terms, isPlaceholder: r.isPlaceholder, isAvailable: r.isAvailable, status: 'locked', inProgress: false, eligibleAt: null, redeemedAt: null, redemptionRef: null, cardId: 'preview', cardName: current.name, cardSequence: current.sequence })),
              nextMilestone: (() => { const nx = current.rewards.find((r) => r.milestoneVisit > (current.rewards[0]?.milestoneVisit ?? 1)); return nx ? { visit: nx.milestoneVisit, rewardName: nx.name, visitsAway: 0, isPlaceholder: nx.isPlaceholder } : null; })(),
            }} />
            <Notice kind="info">
              <strong>How changes apply.</strong> Reward names, descriptions and availability update for every guest straight away (redeemed rewards keep the name they had).
              A new visit target or new milestones apply to guests who start this card from now on — guests already on it keep the rules they started with.
            </Notice>
          </div>
        </div>
      ) : null}

      {editing ? <CardEditor card={editing === 'new' ? null : editing} nextSeq={data.length + 1} onClose={() => setEditing(null)} onDone={(m) => { setEditing(null); toast(m); reload(); }} /> : null}
      {reward ? <RewardEditor card={reward.card} reward={reward.reward} onClose={() => setReward(null)} onDone={(m) => { setReward(null); toast(m); reload(); }} /> : null}
    </div>
  );
}

function CardEditor({ card, nextSeq, onClose, onDone }: { card: CardDef | null; nextSeq: number; onClose: () => void; onDone: (msg: string) => void }) {
  const [name, setName] = useState(card?.name ?? `Card ${nextSeq}`);
  const [levelLabel, setLevel] = useState(card?.levelLabel ?? '');
  const [visits, setVisits] = useState(String(card?.requiredVisits ?? 16));
  const [description, setDescription] = useState(card?.description ?? '');
  const [terms, setTerms] = useState(card?.terms ?? '');
  const [theme, setTheme] = useState<CardTheme>(card?.theme ?? 'midnight');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const holders = card ? card.activeCustomers : 0;
  async function save() {
    setBusy(true); setError(null);
    const body = { name, levelLabel, requiredVisits: Number(visits), description, terms, theme };
    try {
      if (card) await api.patch(`/api/admin/cards/${card.id}`, body); else await api.post('/api/admin/cards', body);
      onDone(card ? 'Card saved' : `${name} created as a draft. Add its rewards, then publish.`);
    } catch (e: any) { setError(e); setBusy(false); }
  }
  const f = error?.fields ?? {};
  return (
    <Sheet title={card ? `Edit ${card.name}` : `New card (Card ${nextSeq})`} onClose={onClose} actions={<>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button loading={busy} onClick={save}>{card ? 'Save card' : 'Create draft'}</Button>
    </>}>
      <div className="stack">
        {error && !Object.keys(f).length ? <Notice kind="error">{error.message}</Notice> : null}
        <Field label="Card name" value={name} onChange={setName} maxLength={60} error={f.name} />
        <Field label="Level name" hint="Shown on the card, e.g. Classic, Gold, Royal." value={levelLabel} onChange={setLevel} maxLength={40} error={f.levelLabel} />
        <Field label="Visits to complete" type="number" inputMode="numeric" value={visits} onChange={setVisits} error={f.requiredVisits}
          hint={holders ? `${holders} guest${holders === 1 ? ' is' : 's are'} on this card and will keep their current target.` : 'Between 1 and 60.'} />
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label" style={{ marginBottom: 6 }}>Card design</legend>
          <div className="theme-pick">
            {THEMES.map((th) => (
              <label key={th.id}>
                <input type="radio" name="theme" checked={theme === th.id} onChange={() => setTheme(th.id)} />
                <span className="theme-swatch" style={{ background: th.bg }} />
                {th.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label className="field__label" htmlFor="cd-desc">Description</label>
          <textarea id="cd-desc" className="textarea" value={description} onChange={(e: any) => setDescription(e.target.value)} maxLength={500} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="cd-terms">Terms shown to guests</label>
          <textarea id="cd-terms" className="textarea" value={terms} onChange={(e: any) => setTerms(e.target.value)} maxLength={2000} />
        </div>
      </div>
    </Sheet>
  );
}

function RewardEditor({ card, reward, onClose, onDone }: { card: CardDef; reward: RewardDef | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [milestone, setMilestone] = useState(String(reward?.milestoneVisit ?? ''));
  const [name, setName] = useState(reward && !reward.isPlaceholder ? reward.name : '');
  const [description, setDescription] = useState(reward && !reward.isPlaceholder ? reward.description : '');
  const [terms, setTerms] = useState(reward?.terms ?? '');
  const [available, setAvailable] = useState(reward?.isAvailable ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  async function save() {
    setBusy(true); setError(null);
    try {
      if (reward) await api.patch(`/api/admin/rewards/${reward.id}`, { name, description, terms, isAvailable: available });
      else await api.post(`/api/admin/cards/${card.id}/rewards`, { milestoneVisit: Number(milestone), name, description, terms, isAvailable: available });
      onDone(reward ? 'Reward saved' : 'Reward added');
    } catch (e: any) { setError(e); setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try { await api.post(`/api/admin/rewards/${reward!.id}/archive`, { reason: 'Removed from card in admin' }); onDone('Reward removed from the card'); }
    catch (e: any) { setError(e); setBusy(false); }
  }
  const f = error?.fields ?? {};
  return (
    <Sheet title={reward ? `Visit ${reward.milestoneVisit} reward` : `Add a reward to ${card.name}`} onClose={onClose} actions={<>
      {reward ? <Button variant="ghost" onClick={() => setConfirmRemove(true)}>Remove</Button> : null}
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button loading={busy} onClick={save} disabled={!name.trim() || (!reward && !milestone)}>Save reward</Button>
    </>}>
      <div className="stack">
        {reward?.isPlaceholder ? <Notice kind="warn">This reward hasn’t been named yet. {reward.eligibleCount} guest{reward.eligibleCount === 1 ? ' has' : 's have'} already earned it — they’ll see the new name as soon as you save, and staff can then redeem it.</Notice> : null}
        {error && !Object.keys(f).length ? <Notice kind="error">{error.message}</Notice> : null}
        {!reward ? <Field label="Unlocks at visit" type="number" inputMode="numeric" value={milestone} onChange={setMilestone} hint={`1 to ${card.requiredVisits}. Applies to guests who start ${card.name} from now on.`} error={f.milestoneVisit} /> : null}
        <Field label="Reward name" value={name} onChange={setName} maxLength={80} placeholder="e.g. Free dessert" error={f.name} />
        <Field label="Short description" value={description} onChange={setDescription} maxLength={500} error={f.description} />
        <div className="field">
          <label className="field__label" htmlFor="rw-terms">Conditions</label>
          <textarea id="rw-terms" className="textarea" value={terms} onChange={(e: any) => setTerms(e.target.value)} maxLength={1000} placeholder="e.g. Dine-in only. Not valid with other offers." />
        </div>
        <label className="check">
          <input type="checkbox" checked={available} onChange={(e: any) => setAvailable(e.target.checked)} />
          <span><strong>Available to redeem</strong><br /><span className="muted">Untick to pause it (e.g. a dish is off the menu). Guests keep what they’ve earned.</span></span>
        </label>
        {confirmRemove ? (
          <Notice kind="warn">
            <div className="stack-sm">
              <span>Remove this reward from {card.name}? Guests who already have it keep it; new guests won’t get it.</span>
              <div><Button size="sm" variant="danger" loading={busy} onClick={remove}>Yes, remove</Button></div>
            </div>
          </Notice>
        ) : null}
        <p className="muted row" style={{ fontSize: 13.5, gap: 6 }}><Info className="ico-16" />Every change is recorded in the activity log.</p>
      </div>
    </Sheet>
  );
}

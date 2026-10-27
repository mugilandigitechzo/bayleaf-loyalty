import { useState } from 'react';
import { api } from '../lib/api.ts';
import { linkProps } from '../lib/router.ts';
import { fmtDate, fmtDateTime } from '../i18n/index.ts';
import { Skeleton, useLoad } from '../ui/kit.tsx';
import { ACTION_LABELS, LoadError, PageHead } from './AdminApp.tsx';

type Dash = {
  timeZone: string; today: string; range: { from: string; to: string };
  totals: { customers: number; activeCards: number; visitsToday: number; rewardsWaiting: number; awaitingNextLevel: number };
  period: { newCustomers: number; visits: number; rewardsUnlocked: number; rewardsRedeemed: number; cardsCompleted: number; returningGuests: number };
  dailyVisits: { d: string; n: number }[];
  card1Progress: { bucket: number; n: number }[];
  cards: { sequence: number; name: string; requiredVisits: number; active: number; completed: number }[];
  recentActivity: { id: string; action: string; actorName: string; at: string; customerName: string | null; customerId: string | null; outletName: string | null }[];
};

const RANGES = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']] as const;

function shift(date: string, days: number) {
  const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function Overview() {
  const [range, setRange] = useState<string>('30');
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const { data, error, loading, reload } = useLoad<Dash>(async () => {
    if (custom) return api.get<Dash>(`/api/admin/dashboard?from=${custom.from}&to=${custom.to}`);
    const base = await api.get<Dash>('/api/admin/dashboard?from=x');
    if (range === '30') return base;
    return api.get<Dash>(`/api/admin/dashboard?from=${shift(base.today, -(Number(range) - 1))}&to=${base.today}`);
  }, [range, custom?.from, custom?.to]);

  const filters = (
    <div className="row">
      <div className="seg" role="group" aria-label="Date range">
        {RANGES.map(([k, label]) => (
          <button key={k} aria-pressed={!custom && range === k} onClick={() => { setCustom(null); setRange(k); }}>{label}</button>
        ))}
      </div>
      <input type="date" className="input" style={{ width: 'auto', minHeight: 44 }} aria-label="From date"
        value={custom?.from ?? data?.range.from ?? ''} onChange={(e: any) => e.target.value && setCustom({ from: e.target.value, to: custom?.to ?? data?.range.to ?? e.target.value })} />
      <input type="date" className="input" style={{ width: 'auto', minHeight: 44 }} aria-label="To date"
        value={custom?.to ?? data?.range.to ?? ''} onChange={(e: any) => e.target.value && setCustom({ from: custom?.from ?? data?.range.from ?? e.target.value, to: e.target.value })} />
    </div>
  );

  return (
    <div className="a-page">
      <PageHead title="Overview" sub={data ? `Live figures · times in ${data.timeZone.replace('_', ' ')}` : undefined} actions={filters} />
      {error ? <LoadError error={error} retry={reload} /> : null}
      {!data ? <div className="metrics">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={104} r={14} />)}</div> : (
        <div style={{ opacity: loading ? .6 : 1, transition: 'opacity .2s' }} className="stack">
          <div className="metrics">
            <Metric label="Registered guests" value={data.totals.customers} sub={`${data.period.newCustomers} new in this period`} />
            <Metric label="Visits today" value={data.totals.visitsToday} sub={`${data.period.visits} in this period`} />
            <Metric label="Active cards" value={data.totals.activeCards} sub={data.totals.awaitingNextLevel ? `${data.totals.awaitingNextLevel} waiting for the next level` : 'Guests collecting stamps'} />
            <Metric label="Rewards unlocked" value={data.period.rewardsUnlocked} sub="In this period" />
            <Metric label="Rewards redeemed" value={data.period.rewardsRedeemed} sub={`${data.totals.rewardsWaiting} earned, not yet enjoyed`} />
            <Metric label="Cards completed" value={data.period.cardsCompleted} sub={`${data.period.returningGuests} returning guests visited`} />
          </div>

          <div className="grid-2">
            <section className="panel panel__body stack">
              <div>
                <h2 className="section-title">Visits per day</h2>
                <p className="section-sub">{fmtDate(data.range.from)} to {fmtDate(data.range.to)}</p>
              </div>
              <BarChart data={data.dailyVisits.map((d) => ({ label: d.d, value: d.n }))} labelFor={(l) => fmtDate(l, { day: 'numeric', month: 'short' })} unit="visit" />
            </section>
            <section className="panel panel__body stack">
              <div>
                <h2 className="section-title">Where Card 1 guests are</h2>
                <p className="section-sub">Guests by number of stamps. Those near 4, 8, 12 and 16 are close to a reward.</p>
              </div>
              <BarChart
                data={Array.from({ length: 16 }, (_, i) => ({ label: String(i), value: data.card1Progress.find((p) => p.bucket === i)?.n ?? 0 }))}
                labelFor={(l) => l} unit="guest" every={4} />
            </section>
          </div>

          <div className="grid-2">
            <section className="panel">
              <div className="panel__body" style={{ paddingBottom: 8 }}><h2 className="section-title">Recent counter activity</h2></div>
              {data.recentActivity.length ? data.recentActivity.map((a) => (
                <div key={a.id} className="audit-item">
                  <span>
                    <strong>{ACTION_LABELS[a.action] ?? a.action}</strong>
                    {a.customerName ? <> · <a {...linkProps(`/admin/guests/${a.customerId}`)}>{a.customerName}</a></> : null}
                  </span>
                  <span className="audit-item__when">{fmtDateTime(a.at)}</span>
                  <span className="audit-item__who">{a.actorName}{a.outletName ? `, ${a.outletName}` : ''}</span>
                </div>
              )) : <p className="panel__body muted">No counter activity yet. Visits and rewards appear here as staff record them.</p>}
            </section>
            <section className="panel">
              <div className="panel__body" style={{ paddingBottom: 8 }}><h2 className="section-title">Cards</h2></div>
              {data.cards.map((c) => (
                <div key={c.sequence} className="list-row">
                  <div><div className="list-row__title">{c.name}</div><div className="list-row__sub">{c.requiredVisits} visits</div></div>
                  <div className="row" style={{ gap: 8 }}><span className="chip chip--next">{c.active} active</span><span className="chip chip--done">{c.completed} completed</span></div>
                </div>
              ))}
              {data.cards.length < 2 ? <p className="panel__body muted" style={{ fontSize: 14.5 }}>Card 2 isn’t published yet. Guests who finish Card 1 will see “Next level coming soon”. <a {...linkProps('/admin/cards')}>Set up Card 2</a></p> : null}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="panel metric">
      <div className="metric__label">{label}</div>
      <div className="metric__value">{value.toLocaleString('en')}</div>
      {sub ? <div className="metric__sub">{sub}</div> : null}
    </div>
  );
}

/** Single-series bar chart: forest bars, 2px gaps, 4px rounded tops, hover titles, plus a hidden table for screen readers. */
function BarChart({ data, labelFor, unit, every }: { data: { label: string; value: number }[]; labelFor: (l: string) => string; unit: string; every?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 200, padL = 32, padB = 26, padT = 12;
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const slot = (W - padL) / data.length;
  const bw = Math.max(2, slot - 2);
  const tickEvery = every ?? Math.max(1, Math.ceil(data.length / 7));
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / nice);
  const allZero = data.every((d) => d.value === 0);
  return (
    <div style={{ position: 'relative' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Bar chart, ${data.length} bars, highest ${max}`}>
        {[0, nice / 2, nice].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke="#E4DDCF" strokeWidth="1" />
            <text x={padL - 6} y={y(v)} textAnchor="end" dominantBaseline="middle">{v}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * slot + 1;
          const h = Math.max(0, H - padB - y(d.value));
          const r = Math.min(4, bw / 2, h);
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * slot} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
              {h > 0 ? (
                <path d={`M${x},${H - padB} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                  fill={hover === i ? '#0B2923' : '#123D32'} />
              ) : null}
              <title>{`${labelFor(d.label)}: ${d.value} ${unit}${d.value === 1 ? '' : 's'}`}</title>
              {i % tickEvery === 0 ? <text x={x + bw / 2} y={H - 8} textAnchor="middle">{labelFor(d.label)}</text> : null}
            </g>
          );
        })}
      </svg>
      {hover !== null ? (
        <div role="status" style={{ position: 'absolute', top: 0, insetInlineEnd: 0, background: 'var(--deep)', color: 'var(--ivory)', fontSize: 13, padding: '4px 10px', borderRadius: 8 }}>
          {labelFor(data[hover].label)}: <strong>{data[hover].value}</strong> {unit}{data[hover].value === 1 ? '' : 's'}
        </div>
      ) : null}
      {allZero ? <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>No data in this range yet.</p> : null}
      <table className="visually-hidden">
        <thead><tr><th>Label</th><th>Value</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.label}><td>{labelFor(d.label)}</td><td>{d.value}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

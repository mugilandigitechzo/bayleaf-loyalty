import type { CardView } from '../../../shared/types.ts';
import { LEAF_PATH, Leaf, Star, starPoints } from '../ui/icons.tsx';
import { t } from '../i18n/index.ts';

/** Columns so milestone stamps land at row ends where possible (16 -> 8 per row). */
export function stampColumns(n: number) {
  if (n <= 8) return n;
  for (const c of [8, 6, 5, 7]) if (n % c === 0) return c;
  return 8;
}

export function StampGrid({ card, freshFrom }: { card: CardView; freshFrom?: number }) {
  const milestones = new Set(card.milestones.map((m) => m.milestone));
  const cols = stampColumns(card.requiredVisits);
  return (
    <div className="stamps" style={{ '--cols': cols }} role="img"
      aria-label={t('card.stampsLabel', { done: card.visitCount, total: card.requiredVisits })}>
      {Array.from({ length: card.requiredVisits }, (_, i) => {
        const n = i + 1;
        const done = n <= card.visitCount;
        const isMilestone = milestones.has(n);
        const isNext = card.status === 'active' && n === card.visitCount + 1;
        const fresh = done && freshFrom !== undefined && n > freshFrom;
        const cls = ['stamp', done && 'stamp--done', isMilestone && 'stamp--milestone', isNext && 'stamp--next', fresh && 'stamp--fresh'].filter(Boolean).join(' ');
        return (
          <div className={cls} key={n} aria-hidden="true" style={fresh ? { animationDelay: `${(n - (freshFrom ?? 0)) * 120}ms` } : undefined}>
            <svg viewBox="0 0 32 32">
              {isMilestone
                ? <polygon className="stamp__disc" points={starPoints(16, 16, 15.2, 12)} style={fresh ? { animationDelay: `${(n - (freshFrom ?? 0)) * 120}ms` } : undefined} />
                : <circle className="stamp__disc" cx="16" cy="16" r="12.6" style={fresh ? { animationDelay: `${(n - (freshFrom ?? 0)) * 120}ms` } : undefined} />}
              {done
                ? <g transform="translate(16 16.4) rotate(32) scale(.86) translate(-12 -12)">
                    <path className="stamp__leaf" d={LEAF_PATH} />
                    <path className="stamp__rib" d="M12 5.2v15.2M12 10.5l-2.6-2M12 14l2.8-2.2M12 17.2l-2.4-1.8" />
                  </g>
                : <text className="stamp__num" x="16" y="16" textAnchor="middle" dominantBaseline="central"
                    style={isMilestone ? { fill: 'var(--card-accent)', fontWeight: 700 } : undefined}>{n}</text>}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

export function LoyaltyCard({ card, firstName, memberCode, freshFrom }: { card: CardView; firstName: string; memberCode: string; freshFrom?: number }) {
  const complete = card.status === 'completed';
  const next = card.nextMilestone;
  return (
    <article className={`lcard lcard--${card.theme}`} aria-label={`${card.name}, ${card.levelLabel}`}>
      <svg className="lcard__watermark" viewBox="0 0 24 24" aria-hidden="true"><path d={LEAF_PATH} fill="currentColor" /></svg>
      <div className="lcard__top">
        <span className="lcard__brand"><Leaf />BAY LEAF</span>
        <span className="lcard__level">{card.name} · {card.levelLabel}</span>
      </div>
      <div className="lcard__count">
        <span className="lcard__num">{card.visitCount}</span>
        <span className="lcard__of">{t('card.of', { n: card.requiredVisits })}</span>
      </div>
      <p className="lcard__to-go">
        {complete ? t('card.complete') : card.remaining === 1 ? t('card.toGoOne') : t('card.toGoMany', { n: card.remaining })}
      </p>
      <StampGrid card={card} freshFrom={freshFrom} />
      {next && !complete ? (
        <div className="lcard__next">
          <Star filled />
          <div>
            <span>{next.isPlaceholder ? t('card.nextSoon', { n: next.visit }) : t('card.next', { n: next.visit })}</span>
            {!next.isPlaceholder ? <><br /><strong>{next.rewardName}</strong></> : null}
          </div>
        </div>
      ) : null}
      <div className="lcard__foot">
        <span className="lcard__name">{firstName}</span>
        <span className="tnum" dir="ltr">{formatCode(memberCode)}</span>
      </div>
    </article>
  );
}

export function formatCode(code: string) {
  return code.length === 8 ? `${code.slice(0, 2)} ${code.slice(2, 5)} ${code.slice(5)}` : code;
}

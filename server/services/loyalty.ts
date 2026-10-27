/**
 * The loyalty engine. Every operation that changes progress runs inside one
 * database transaction that first locks the customer's row (SELECT … FOR UPDATE).
 * That serialises visits, redemptions and corrections per customer, so two
 * simultaneous taps can never both pass the daily-limit or "not yet redeemed"
 * checks. Unique indexes (one valid visit number per card, one redemption per
 * reward, idempotency keys) back this up at the database level.
 *
 * Confirmed Bay Leaf rules implemented here:
 *  - Cards never expire; nothing in this module reads the calendar month.
 *  - The next card activates only when the current card reaches its target.
 *  - Reaching a milestone makes a reward ELIGIBLE; redemption is a separate act.
 */
import type { Db, Queryable } from '../db/index.ts';
import { Errors, AppError } from '../lib/errors.ts';
import { newReference } from '../lib/crypto.ts';
import { businessDate, now } from '../lib/time.ts';
import { maskPhone } from '../lib/phone.ts';
import { audit, type Actor, SYSTEM } from './audit.ts';
import { getSetting } from './settings.ts';
import type {
  CardView, LoyaltyState, RewardView, VisitResult, RedemptionResult, NextCardView, CardTheme,
  VisitHistoryItem, RedemptionHistoryItem,
} from '../../shared/types.ts';

export interface StaffActor extends Actor { type: 'staff'; id: string; name: string; outletId: string | null }

// ---------------------------------------------------------------------------
// Card activation
// ---------------------------------------------------------------------------

export async function lockCustomer(tx: Queryable, customerId: string) {
  const r = await tx.query('SELECT * FROM customers WHERE id = $1 FOR UPDATE', [customerId]);
  if (!r.rows[0]) throw Errors.notFound('customer');
  return r.rows[0];
}

async function activateCard(tx: Queryable, customerId: string, def: any, at: Date) {
  const card = (await tx.query(
    `INSERT INTO customer_cards (customer_id, card_definition_id, sequence, card_name, level_label, theme, required_visits, activated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [customerId, def.id, def.sequence, def.name, def.level_label, def.theme, def.required_visits, at],
  )).rows[0];
  // Snapshot this card's milestones. Later rule edits apply to new activations only.
  await tx.query(
    `INSERT INTO customer_rewards (customer_id, customer_card_id, reward_definition_id, milestone_visit, created_at)
     SELECT $1, $2, rd.id, rd.milestone_visit, $4 FROM reward_definitions rd
     WHERE rd.card_definition_id = $3 AND rd.archived_at IS NULL AND rd.milestone_visit <= $5`,
    [customerId, card.id, def.id, at, def.required_visits],
  );
  await audit(tx, SYSTEM, {
    action: 'card.activated', entityType: 'customer_card', entityId: card.id, customerId, at,
    details: { sequence: def.sequence, name: def.name, requiredVisits: def.required_visits },
  });
  return card;
}

/**
 * Returns the customer's active card, activating the next one in the sequence if
 * the previous card is complete and the next card has been published.
 * Caller must hold the customer row lock.
 */
export async function ensureActiveCard(tx: Queryable, customerId: string, at: Date = now()) {
  const active = await tx.query("SELECT * FROM customer_cards WHERE customer_id = $1 AND status = 'active'", [customerId]);
  if (active.rows[0]) return { card: active.rows[0], activated: false };
  const last = await tx.query<{ max: number | null }>('SELECT max(sequence) AS max FROM customer_cards WHERE customer_id = $1', [customerId]);
  const nextSeq = (last.rows[0]?.max ?? 0) + 1;
  const def = await tx.query("SELECT * FROM card_definitions WHERE sequence = $1 AND status = 'published'", [nextSeq]);
  if (!def.rows[0]) return { card: null, activated: false };
  return { card: await activateCard(tx, customerId, def.rows[0], at), activated: true };
}

// ---------------------------------------------------------------------------
// Reading state
// ---------------------------------------------------------------------------

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export async function buildState(q: Queryable, customerId: string): Promise<LoyaltyState> {
  const c = (await q.query('SELECT * FROM customers WHERE id = $1', [customerId])).rows[0];
  if (!c) throw Errors.notFound('customer');
  const cards = (await q.query(
    `SELECT cc.*, d.terms FROM customer_cards cc JOIN card_definitions d ON d.id = cc.card_definition_id
      WHERE cc.customer_id = $1 ORDER BY cc.sequence`, [customerId])).rows;
  const rewards = (await q.query(
    `SELECT cr.*, rd.name, rd.description, rd.terms, rd.is_placeholder, rd.is_available,
            rr.reference AS redemption_ref, rr.created_at AS redeemed_at, rr.reward_name AS redeemed_name
       FROM customer_rewards cr
       JOIN reward_definitions rd ON rd.id = cr.reward_definition_id
       LEFT JOIN reward_redemptions rr ON rr.customer_reward_id = cr.id
      WHERE cr.customer_id = $1
      ORDER BY cr.milestone_visit`, [customerId])).rows;

  const cardViews: CardView[] = cards.map((card: any) => {
    const mine = rewards.filter((r: any) => r.customer_card_id === card.id);
    const nextLocked = card.status === 'active' ? mine.find((r: any) => r.status === 'locked') : undefined;
    const milestones: RewardView[] = mine.map((r: any) => ({
      id: r.id,
      milestone: r.milestone_visit,
      // A redeemed reward keeps the name it had when it was handed over.
      name: r.status === 'redeemed' && r.redeemed_name ? r.redeemed_name : r.name,
      description: r.description,
      terms: r.terms,
      isPlaceholder: r.status === 'redeemed' ? false : r.is_placeholder,
      isAvailable: r.is_available,
      status: r.status,
      inProgress: nextLocked?.id === r.id,
      eligibleAt: iso(r.eligible_at),
      redeemedAt: iso(r.redeemed_at),
      redemptionRef: r.redemption_ref,
      cardId: card.id,
      cardName: card.card_name,
      cardSequence: card.sequence,
    }));
    return {
      id: card.id,
      sequence: card.sequence,
      name: card.card_name,
      levelLabel: card.level_label,
      theme: card.theme as CardTheme,
      requiredVisits: card.required_visits,
      visitCount: card.visit_count,
      remaining: card.required_visits - card.visit_count,
      status: card.status,
      terms: card.terms ?? '',
      activatedAt: iso(card.activated_at)!,
      completedAt: iso(card.completed_at),
      milestones,
      nextMilestone: nextLocked ? {
        visit: nextLocked.milestone_visit,
        rewardName: nextLocked.name,
        visitsAway: nextLocked.milestone_visit - card.visit_count,
        isPlaceholder: nextLocked.is_placeholder,
      } : null,
    };
  });

  const activeCard = cardViews.find((v) => v.status === 'active') ?? null;
  const completedCards = cardViews.filter((v) => v.status === 'completed').reverse();
  const lastSeq = cardViews.length ? cardViews[cardViews.length - 1].sequence : 0;
  const nextSeq = activeCard ? activeCard.sequence + 1 : lastSeq + 1;
  const nextDef = (await q.query("SELECT * FROM card_definitions WHERE sequence = $1 AND status = 'published'", [nextSeq])).rows[0];
  let nextCard: NextCardView | null;
  if (nextDef) {
    nextCard = { state: 'locked', name: nextDef.name, levelLabel: nextDef.level_label, requiredVisits: nextDef.required_visits };
  } else if (activeCard || cardViews.length) {
    nextCard = { state: 'coming_soon', name: null, levelLabel: null, requiredVisits: null };
  } else {
    nextCard = null;
  }

  const policy = await getSetting(q, 'visit_policy');
  const today = businessDate(now(), policy.timeZone);
  const t = (await q.query<{ n: number; last: Date | null }>(
    `SELECT count(*)::int AS n, max(created_at) AS last FROM visits
      WHERE customer_id = $1 AND business_date = $2 AND status = 'valid'`, [customerId, today])).rows[0];

  return {
    customer: {
      id: c.id,
      firstName: String(c.full_name).trim().split(/\s+/)[0],
      fullName: c.full_name,
      memberCode: c.member_code,
      status: c.status,
      phoneMasked: maskPhone(c.phone_e164),
      createdAt: iso(c.created_at)!,
    },
    activeCard,
    completedCards,
    rewardsReady: cardViews.flatMap((v) => v.milestones.filter((m) => m.status === 'eligible')),
    nextCard,
    awaitingNextLevel: !activeCard && cardViews.length > 0,
    today: {
      visitsToday: t.n,
      maxPerDay: policy.maxVisitsPerDay,
      canRecordVisit: !!activeCard && c.status === 'active' && t.n < policy.maxVisitsPerDay,
      lastVisitAt: iso(t.last),
    },
  };
}

export async function visitHistory(q: Queryable, customerId: string, opts: { limit?: number; before?: string; includeStaff?: boolean; includeVoided?: boolean } = {}): Promise<{ items: VisitHistoryItem[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const rows = (await q.query(
    `SELECT v.*, cc.card_name, cc.sequence, o.name AS outlet_name, s.full_name AS staff_name
       FROM visits v
       JOIN customer_cards cc ON cc.id = v.customer_card_id
       LEFT JOIN outlets o ON o.id = v.outlet_id
       LEFT JOIN staff_users s ON s.id = v.staff_id
      WHERE v.customer_id = $1 AND ($2::timestamptz IS NULL OR v.created_at < $2)
        AND ($3 OR v.status = 'valid')
      ORDER BY v.created_at DESC LIMIT $4`,
    [customerId, opts.before ?? null, !!opts.includeVoided, limit + 1])).rows;
  const items = rows.slice(0, limit).map((v: any): VisitHistoryItem => ({
    id: v.id, reference: v.reference, at: iso(v.created_at)!, businessDate: v.business_date,
    cardName: v.card_name, cardSequence: v.sequence, visitNumber: v.visit_number,
    outletName: v.outlet_name, source: v.source, status: v.status,
    ...(opts.includeStaff ? { staffName: v.staff_name, voidReason: v.void_reason, correctionReason: v.correction_reason } : {}),
  }));
  return { items, nextCursor: rows.length > limit ? items[items.length - 1].at : null };
}

export async function redemptionHistory(q: Queryable, customerId: string, opts: { includeStaff?: boolean } = {}): Promise<RedemptionHistoryItem[]> {
  const rows = (await q.query(
    `SELECT rr.*, cc.card_name, o.name AS outlet_name, s.full_name AS staff_name
       FROM reward_redemptions rr
       JOIN customer_cards cc ON cc.id = rr.customer_card_id
       LEFT JOIN outlets o ON o.id = rr.outlet_id
       LEFT JOIN staff_users s ON s.id = rr.staff_id
      WHERE rr.customer_id = $1 ORDER BY rr.created_at DESC LIMIT 200`, [customerId])).rows;
  return rows.map((r: any) => ({
    id: r.id, reference: r.reference, at: iso(r.created_at)!, rewardName: r.reward_name,
    cardName: r.card_name, outletName: r.outlet_name,
    ...(opts.includeStaff ? { staffName: r.staff_name } : {}),
  }));
}

// ---------------------------------------------------------------------------
// Recording visits
// ---------------------------------------------------------------------------

function rewardsAtMilestones(state: LoyaltyState, cardId: string, from: number, to: number): RewardView[] {
  const card = [state.activeCard, ...state.completedCards].find((c) => c?.id === cardId);
  return card ? card.milestones.filter((m) => m.milestone > from && m.milestone <= to && m.status !== 'locked') : [];
}

async function applyVisit(tx: Queryable, args: {
  customerId: string; actor: StaffActor; source: 'counter' | 'correction'; date?: string;
  idempotencyKey?: string | null; billAmount?: number | null; correctionReason?: string | null;
}): Promise<VisitResult> {
  const { customerId, actor } = args;
  const customer = await lockCustomer(tx, customerId);

  if (args.idempotencyKey) {
    const prior = (await tx.query('SELECT * FROM visits WHERE idempotency_key = $1', [args.idempotencyKey])).rows[0];
    if (prior) {
      if (prior.customer_id !== customerId) throw Errors.conflict('IDEMPOTENCY_MISMATCH', 'This request was already used for a different customer.');
      // Retried or double-tapped confirmation: report the original result, add nothing.
      const state = await buildState(tx, customerId);
      const card = (await tx.query('SELECT * FROM customer_cards WHERE id = $1', [prior.customer_card_id])).rows[0];
      return {
        replayed: true,
        visit: { id: prior.id, reference: prior.reference, visitNumber: prior.visit_number, at: iso(prior.created_at)! },
        unlockedRewards: rewardsAtMilestones(state, prior.customer_card_id, prior.visit_number - 1, prior.visit_number),
        cardCompleted: card.required_visits === prior.visit_number,
        nextCardActivated: null,
        state,
      };
    }
  }

  if (customer.status !== 'active') {
    throw Errors.conflict('CUSTOMER_SUSPENDED', 'This loyalty account is on hold. Please ask a manager.');
  }

  const at = now();
  const { card } = await ensureActiveCard(tx, customerId, at);
  if (!card) {
    throw Errors.conflict('NO_ACTIVE_CARD', 'This guest has completed every available card. The next level is coming soon, so visits cannot be added yet.');
  }

  const policy = await getSetting(tx, 'visit_policy');
  const date = args.date ?? businessDate(at, policy.timeZone);
  const sameDay = (await tx.query<{ n: number; last: Date | null }>(
    `SELECT count(*)::int AS n, max(created_at) AS last FROM visits
      WHERE customer_id = $1 AND business_date = $2 AND status = 'valid'`, [customerId, date])).rows[0];
  if (sameDay.n >= policy.maxVisitsPerDay) {
    throw Errors.conflict('DAILY_LIMIT',
      policy.maxVisitsPerDay === 1
        ? 'A visit is already recorded for this guest today. Only one visit per day counts toward the card.'
        : `This guest already has ${sameDay.n} visits today, the daily maximum.`,
      { lastVisitAt: iso(sameDay.last), maxPerDay: policy.maxVisitsPerDay, date });
  }

  if (policy.minimumBillAmount !== null && args.source === 'counter') {
    if (args.billAmount === null || args.billAmount === undefined) {
      throw Errors.validation('Enter the bill amount to record this visit.', { fields: { billAmount: 'Required' } });
    }
    if (args.billAmount < policy.minimumBillAmount) {
      throw Errors.conflict('BILL_BELOW_MINIMUM', `Bills under ${policy.minimumBillAmount} don't count as a loyalty visit.`, { minimum: policy.minimumBillAmount });
    }
  }

  const visitNumber = card.visit_count + 1;
  const completes = visitNumber === card.required_visits;
  const visit = (await tx.query(
    `INSERT INTO visits (reference, customer_id, customer_card_id, visit_number, business_date, source, bill_amount,
                         staff_id, outlet_id, idempotency_key, correction_reason, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [newReference('V'), customerId, card.id, visitNumber, date, args.source, args.billAmount ?? null,
     actor.id, actor.outletId, args.idempotencyKey ?? null, args.correctionReason ?? null, at],
  )).rows[0];

  await tx.query(
    `UPDATE customer_cards SET visit_count = $2,
            status = CASE WHEN $3 THEN 'completed' ELSE 'active' END,
            completed_at = CASE WHEN $3 THEN $4::timestamptz ELSE NULL END
      WHERE id = $1`, [card.id, visitNumber, completes, at]);

  const unlocked = (await tx.query(
    `UPDATE customer_rewards SET status = 'eligible', eligible_at = $3
      WHERE customer_card_id = $1 AND status = 'locked' AND milestone_visit <= $2
      RETURNING id, milestone_visit`, [card.id, visitNumber, at])).rows;

  await audit(tx, actor, {
    action: args.source === 'correction' ? 'visit.correction_added' : 'visit.recorded',
    entityType: 'visit', entityId: visit.id, customerId, outletId: actor.outletId, at,
    reason: args.correctionReason ?? null,
    details: { reference: visit.reference, card: card.card_name, visitNumber, requiredVisits: card.required_visits, businessDate: date },
  });
  for (const u of unlocked) {
    await audit(tx, actor, {
      action: 'reward.unlocked', entityType: 'customer_reward', entityId: u.id, customerId, outletId: actor.outletId, at,
      details: { milestone: u.milestone_visit, card: card.card_name },
    });
  }

  let nextCardActivated: VisitResult['nextCardActivated'] = null;
  if (completes) {
    await audit(tx, actor, {
      action: 'card.completed', entityType: 'customer_card', entityId: card.id, customerId, outletId: actor.outletId, at,
      details: { card: card.card_name, sequence: card.sequence },
    });
    const next = await ensureActiveCard(tx, customerId, at);
    if (next.activated && next.card) nextCardActivated = { name: next.card.card_name, levelLabel: next.card.level_label };
  }

  const state = await buildState(tx, customerId);
  return {
    replayed: false,
    visit: { id: visit.id, reference: visit.reference, visitNumber, at: iso(visit.created_at)! },
    unlockedRewards: rewardsAtMilestones(state, card.id, card.visit_count, visitNumber),
    cardCompleted: completes,
    nextCardActivated,
    state,
  };
}

export async function recordVisit(db: Db, args: { customerId: string; actor: StaffActor; idempotencyKey: string; billAmount?: number | null }) {
  return db.transaction((tx) => applyVisit(tx, { ...args, source: 'counter' }));
}

/** Admin correction: add a visit the counter missed (e.g. on a past date). */
export async function addCorrectionVisit(db: Db, args: { customerId: string; actor: StaffActor; date: string; reason: string }) {
  return db.transaction(async (tx) => {
    const policy = await getSetting(tx, 'visit_policy');
    const today = businessDate(now(), policy.timeZone);
    if (args.date > today) throw Errors.validation('The visit date cannot be in the future.');
    return applyVisit(tx, { customerId: args.customerId, actor: args.actor, source: 'correction', date: args.date, correctionReason: args.reason });
  });
}

/**
 * Admin correction: void the most recent visit on the active card (wrong guest,
 * accidental confirmation). Rewards that depended on it go back to locked, unless
 * already redeemed — then the correction is refused so history stays truthful.
 */
export async function undoLastVisit(db: Db, args: { customerId: string; actor: StaffActor; reason: string }) {
  return db.transaction(async (tx) => {
    await lockCustomer(tx, args.customerId);
    const card = (await tx.query("SELECT * FROM customer_cards WHERE customer_id = $1 AND status = 'active'", [args.customerId])).rows[0];
    if (!card || card.visit_count === 0) {
      throw Errors.conflict('NOTHING_TO_UNDO', card
        ? 'The current card has no visits yet. Visits on completed cards are permanent.'
        : 'There is no active card. Visits on completed cards are permanent.');
    }
    const visit = (await tx.query(
      "SELECT * FROM visits WHERE customer_card_id = $1 AND status = 'valid' AND visit_number = $2", [card.id, card.visit_count])).rows[0];
    if (!visit) throw new AppError('INTEGRITY', 500, 'Card count and visit records disagree.');
    const affected = (await tx.query(
      "SELECT * FROM customer_rewards WHERE customer_card_id = $1 AND milestone_visit = $2", [card.id, card.visit_count])).rows;
    if (affected.some((r: any) => r.status === 'redeemed')) {
      throw Errors.conflict('REWARD_ALREADY_REDEEMED', 'This visit unlocked a reward that has already been redeemed, so it cannot be undone.');
    }
    const at = now();
    await tx.query(
      "UPDATE visits SET status = 'voided', voided_at = $2, voided_by = $3, void_reason = $4 WHERE id = $1",
      [visit.id, at, args.actor.id, args.reason]);
    await tx.query('UPDATE customer_cards SET visit_count = visit_count - 1 WHERE id = $1', [card.id]);
    const relocked = (await tx.query(
      `UPDATE customer_rewards SET status = 'locked', eligible_at = NULL
        WHERE customer_card_id = $1 AND milestone_visit = $2 AND status = 'eligible' RETURNING id`,
      [card.id, card.visit_count])).rows;
    await audit(tx, args.actor, {
      action: 'visit.voided', entityType: 'visit', entityId: visit.id, customerId: args.customerId, reason: args.reason, at,
      details: { reference: visit.reference, visitNumber: visit.visit_number, card: card.card_name, rewardsRelocked: relocked.map((r: any) => r.id) },
    });
    return buildState(tx, args.customerId);
  });
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export async function redeemReward(db: Db, args: { customerRewardId: string; actor: StaffActor; idempotencyKey: string }): Promise<RedemptionResult> {
  return db.transaction(async (tx) => {
    const owner = (await tx.query('SELECT customer_id FROM customer_rewards WHERE id = $1', [args.customerRewardId])).rows[0];
    if (!owner) throw Errors.notFound('reward');
    const customer = await lockCustomer(tx, owner.customer_id);

    const prior = (await tx.query('SELECT * FROM reward_redemptions WHERE idempotency_key = $1', [args.idempotencyKey])).rows[0];
    if (prior) {
      if (prior.customer_reward_id !== args.customerRewardId) throw Errors.conflict('IDEMPOTENCY_MISMATCH', 'This request was already used for a different reward.');
      return {
        replayed: true,
        redemption: { id: prior.id, reference: prior.reference, rewardName: prior.reward_name, at: iso(prior.created_at)! },
        state: await buildState(tx, owner.customer_id),
      };
    }

    const r = (await tx.query(
      `SELECT cr.*, rd.name, rd.is_placeholder, rd.is_available
         FROM customer_rewards cr JOIN reward_definitions rd ON rd.id = cr.reward_definition_id
        WHERE cr.id = $1 FOR UPDATE OF cr`, [args.customerRewardId])).rows[0];

    if (r.status === 'redeemed') {
      const p = (await tx.query(
        `SELECT rr.reference, rr.created_at, s.full_name AS staff_name, o.name AS outlet_name
           FROM reward_redemptions rr JOIN staff_users s ON s.id = rr.staff_id LEFT JOIN outlets o ON o.id = rr.outlet_id
          WHERE rr.customer_reward_id = $1`, [r.id])).rows[0];
      throw Errors.conflict('ALREADY_REDEEMED', 'This reward has already been redeemed.', {
        reference: p?.reference, redeemedAt: iso(p?.created_at), staffName: p?.staff_name, outletName: p?.outlet_name,
      });
    }
    if (r.status === 'locked') throw Errors.conflict('NOT_YET_EARNED', `This reward unlocks at visit ${r.milestone_visit}.`);
    if (r.status === 'revoked') throw Errors.conflict('REWARD_REVOKED', 'This reward was withdrawn by a manager and cannot be redeemed.');
    if (customer.status !== 'active') throw Errors.conflict('CUSTOMER_SUSPENDED', 'This loyalty account is on hold. Please ask a manager.');
    if (r.is_placeholder) throw Errors.conflict('REWARD_NOT_CONFIGURED', 'Bay Leaf has not set up this reward yet. It stays saved for the guest until it is ready.');
    if (!r.is_available) throw Errors.conflict('REWARD_UNAVAILABLE', 'This reward is temporarily unavailable. It stays saved for the guest.');

    const at = now();
    const red = (await tx.query(
      `INSERT INTO reward_redemptions (reference, customer_reward_id, customer_id, customer_card_id, reward_name, staff_id, outlet_id, idempotency_key, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [newReference('R'), r.id, r.customer_id, r.customer_card_id, r.name, args.actor.id, args.actor.outletId, args.idempotencyKey, at])).rows[0];
    await tx.query("UPDATE customer_rewards SET status = 'redeemed' WHERE id = $1", [r.id]);
    await audit(tx, args.actor, {
      action: 'reward.redeemed', entityType: 'customer_reward', entityId: r.id, customerId: r.customer_id, outletId: args.actor.outletId, at,
      details: { reference: red.reference, reward: r.name, milestone: r.milestone_visit },
    });
    return {
      replayed: false,
      redemption: { id: red.id, reference: red.reference, rewardName: red.reward_name, at: iso(red.created_at)! },
      state: await buildState(tx, r.customer_id),
    };
  });
}

/** Admin: withdraw an earned (not yet redeemed) reward, or restore a withdrawn one. */
export async function setRewardRevoked(db: Db, args: { customerRewardId: string; actor: StaffActor; revoke: boolean; reason: string }) {
  return db.transaction(async (tx) => {
    const owner = (await tx.query('SELECT customer_id FROM customer_rewards WHERE id = $1', [args.customerRewardId])).rows[0];
    if (!owner) throw Errors.notFound('reward');
    await lockCustomer(tx, owner.customer_id);
    const r = (await tx.query('SELECT * FROM customer_rewards WHERE id = $1 FOR UPDATE', [args.customerRewardId])).rows[0];
    if (args.revoke) {
      if (r.status !== 'eligible') throw Errors.conflict('NOT_REVOCABLE', 'Only earned, unredeemed rewards can be withdrawn.');
      await tx.query("UPDATE customer_rewards SET status = 'revoked', revoked_at = $2, revoked_by = $3, revoke_reason = $4 WHERE id = $1",
        [r.id, now(), args.actor.id, args.reason]);
    } else {
      if (r.status !== 'revoked') throw Errors.conflict('NOT_REVOKED', 'This reward is not withdrawn.');
      await tx.query("UPDATE customer_rewards SET status = 'eligible', revoked_at = NULL, revoked_by = NULL, revoke_reason = NULL WHERE id = $1", [r.id]);
    }
    await audit(tx, args.actor, {
      action: args.revoke ? 'reward.revoked' : 'reward.restored', entityType: 'customer_reward', entityId: r.id,
      customerId: r.customer_id, reason: args.reason, details: { milestone: r.milestone_visit },
    });
    return buildState(tx, r.customer_id);
  });
}

/**
 * Card & reward configuration.
 *
 * Integrity policy (shown to admins in the UI):
 *  - Reward name / description / terms / availability edits apply everywhere the
 *    reward is not yet redeemed — so naming the visit-4 and visit-8 rewards later
 *    reaches customers already on Card 1. Redeemed rewards keep their original name.
 *  - Visit target and milestone changes apply to customers who START the card
 *    afterwards. Customers already on the card keep the rules they started with.
 *  - Published cards can't be unpublished once any customer holds them, and
 *    rewards are archived (never deleted) so history always resolves.
 */
import { z } from 'zod';
import type { Db, Queryable } from '../db/index.ts';
import { Errors } from '../lib/errors.ts';
import { audit, type Actor } from './audit.ts';
import { ensureActiveCard, lockCustomer } from './loyalty.ts';
import { now } from '../lib/time.ts';

export const THEMES = ['forest', 'midnight', 'ivory', 'saffron'] as const;

export const cardInput = z.object({
  name: z.string().trim().min(1, 'Enter a card name').max(60),
  levelLabel: z.string().trim().min(1, 'Enter a level label').max(40),
  requiredVisits: z.number().int().min(1, 'At least 1 visit').max(60, 'At most 60 visits'),
  description: z.string().trim().max(500).default(''),
  terms: z.string().trim().max(2000).default(''),
  theme: z.enum(THEMES).default('forest'),
});

export const rewardInput = z.object({
  milestoneVisit: z.number().int().min(1, 'Milestone must be at least visit 1'),
  name: z.string().trim().min(1, 'Enter a reward name').max(80),
  description: z.string().trim().max(500).default(''),
  terms: z.string().trim().max(1000).default(''),
  isAvailable: z.boolean().default(true),
});

export async function listCards(q: Queryable) {
  const cards = (await q.query(
    `SELECT d.*,
       (SELECT count(*)::int FROM customer_cards cc WHERE cc.card_definition_id = d.id AND cc.status = 'active') AS active_customers,
       (SELECT count(*)::int FROM customer_cards cc WHERE cc.card_definition_id = d.id AND cc.status = 'completed') AS completed_customers
     FROM card_definitions d ORDER BY d.sequence`)).rows;
  const rewards = (await q.query(
    `SELECT rd.*,
       (SELECT count(*)::int FROM customer_rewards cr WHERE cr.reward_definition_id = rd.id AND cr.status = 'eligible') AS eligible_count,
       (SELECT count(*)::int FROM customer_rewards cr WHERE cr.reward_definition_id = rd.id AND cr.status = 'redeemed') AS redeemed_count
     FROM reward_definitions rd WHERE rd.archived_at IS NULL ORDER BY rd.milestone_visit`)).rows;
  return cards.map((c: any) => ({
    id: c.id, sequence: c.sequence, name: c.name, levelLabel: c.level_label, requiredVisits: c.required_visits,
    description: c.description, terms: c.terms, theme: c.theme, status: c.status, publishedAt: c.published_at,
    activeCustomers: c.active_customers, completedCustomers: c.completed_customers,
    rewards: rewards.filter((r: any) => r.card_definition_id === c.id).map((r: any) => ({
      id: r.id, milestoneVisit: r.milestone_visit, name: r.name, description: r.description, terms: r.terms,
      isPlaceholder: r.is_placeholder, isAvailable: r.is_available, eligibleCount: r.eligible_count, redeemedCount: r.redeemed_count,
    })),
  }));
}

async function cardOr404(q: Queryable, id: string) {
  const c = (await q.query('SELECT * FROM card_definitions WHERE id = $1 FOR UPDATE', [id])).rows[0];
  if (!c) throw Errors.notFound('card');
  return c;
}

export async function createCard(db: Db, input: unknown, actor: Actor) {
  const v = cardInput.parse(input);
  return db.transaction(async (tx) => {
    await tx.query('LOCK TABLE card_definitions IN SHARE ROW EXCLUSIVE MODE');
    const seq = (await tx.query<{ n: number }>('SELECT COALESCE(max(sequence), 0) + 1 AS n FROM card_definitions')).rows[0].n;
    const c = (await tx.query(
      `INSERT INTO card_definitions (sequence, name, level_label, required_visits, description, terms, theme)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [seq, v.name, v.levelLabel, v.requiredVisits, v.description, v.terms, v.theme])).rows[0];
    await audit(tx, actor, { action: 'card.created', entityType: 'card_definition', entityId: c.id, details: { sequence: seq, ...v } });
    return c.id as string;
  });
}

export async function updateCard(db: Db, id: string, input: unknown, actor: Actor, reason?: string) {
  const v = cardInput.partial().parse(input);
  return db.transaction(async (tx) => {
    const c = await cardOr404(tx, id);
    if (v.requiredVisits !== undefined) {
      const maxMilestone = (await tx.query<{ m: number | null }>(
        'SELECT max(milestone_visit) AS m FROM reward_definitions WHERE card_definition_id = $1 AND archived_at IS NULL', [id])).rows[0].m ?? 0;
      if (v.requiredVisits < maxMilestone) {
        throw Errors.validation(`The visit target can’t be lower than the highest reward milestone (visit ${maxMilestone}).`, { fields: { requiredVisits: `At least ${maxMilestone}` } });
      }
    }
    const next = {
      name: v.name ?? c.name, level_label: v.levelLabel ?? c.level_label, required_visits: v.requiredVisits ?? c.required_visits,
      description: v.description ?? c.description, terms: v.terms ?? c.terms, theme: v.theme ?? c.theme,
    };
    await tx.query(
      `UPDATE card_definitions SET name=$2, level_label=$3, required_visits=$4, description=$5, terms=$6, theme=$7, updated_at=now() WHERE id=$1`,
      [id, next.name, next.level_label, next.required_visits, next.description, next.terms, next.theme]);
    await audit(tx, actor, {
      action: 'card.updated', entityType: 'card_definition', entityId: id, reason,
      details: { before: { name: c.name, levelLabel: c.level_label, requiredVisits: c.required_visits, theme: c.theme }, after: v },
    });
  });
}

/**
 * Publishing makes a card live. Cards publish in order (Card 2 before Card 3), and
 * any customer who finished the previous card and was waiting gets this card now.
 */
export async function publishCard(db: Db, id: string, actor: Actor) {
  return db.transaction(async (tx) => {
    const c = await cardOr404(tx, id);
    if (c.status === 'published') return { activatedFor: 0 };
    const gap = (await tx.query("SELECT sequence FROM card_definitions WHERE sequence < $1 AND status <> 'published' ORDER BY sequence LIMIT 1", [c.sequence])).rows[0];
    if (gap) throw Errors.conflict('PUBLISH_ORDER', `Publish Card ${gap.sequence} first. Cards go live in order.`);
    const rewards = (await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM reward_definitions WHERE card_definition_id = $1 AND archived_at IS NULL', [id])).rows[0].n;
    if (rewards === 0) throw Errors.conflict('NO_REWARDS', 'Add at least one reward before publishing this card.');
    await tx.query("UPDATE card_definitions SET status = 'published', published_at = now(), updated_at = now() WHERE id = $1", [id]);
    await audit(tx, actor, { action: 'card.published', entityType: 'card_definition', entityId: id, details: { sequence: c.sequence, name: c.name } });

    // Customers who completed the previous card and have no active card.
    const waiting = (await tx.query(
      `SELECT cc.customer_id FROM customer_cards cc
        WHERE cc.sequence = $1 AND cc.status = 'completed'
          AND NOT EXISTS (SELECT 1 FROM customer_cards x WHERE x.customer_id = cc.customer_id AND x.sequence >= $2)`,
      [c.sequence - 1, c.sequence])).rows;
    let n = 0;
    for (const w of waiting) {
      await lockCustomer(tx, w.customer_id);
      const r = await ensureActiveCard(tx, w.customer_id, now());
      if (r.activated) n++;
    }
    return { activatedFor: n };
  });
}

export async function unpublishCard(db: Db, id: string, actor: Actor) {
  return db.transaction(async (tx) => {
    const c = await cardOr404(tx, id);
    const held = (await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM customer_cards WHERE card_definition_id = $1', [id])).rows[0].n;
    if (held > 0) throw Errors.conflict('CARD_IN_USE', `${held} guest${held === 1 ? ' has' : 's have'} this card, so it stays live. You can still edit its rewards.`);
    const later = (await tx.query("SELECT 1 FROM card_definitions WHERE sequence > $1 AND status = 'published'", [c.sequence])).rows[0];
    if (later) throw Errors.conflict('PUBLISH_ORDER', 'Unpublish the later cards first.');
    await tx.query("UPDATE card_definitions SET status = 'draft', published_at = NULL, updated_at = now() WHERE id = $1", [id]);
    await audit(tx, actor, { action: 'card.unpublished', entityType: 'card_definition', entityId: id });
  });
}

export async function addReward(db: Db, cardId: string, input: unknown, actor: Actor) {
  const v = rewardInput.parse(input);
  return db.transaction(async (tx) => {
    const c = await cardOr404(tx, cardId);
    if (v.milestoneVisit > c.required_visits) {
      throw Errors.validation(`This card has ${c.required_visits} visits, so the milestone must be visit ${c.required_visits} or earlier.`, { fields: { milestoneVisit: `1–${c.required_visits}` } });
    }
    const clash = (await tx.query('SELECT 1 FROM reward_definitions WHERE card_definition_id = $1 AND milestone_visit = $2 AND archived_at IS NULL', [cardId, v.milestoneVisit])).rows[0];
    if (clash) throw Errors.validation(`Visit ${v.milestoneVisit} already has a reward. Edit that one instead.`, { fields: { milestoneVisit: 'Already used' } });
    const r = (await tx.query(
      `INSERT INTO reward_definitions (card_definition_id, milestone_visit, name, description, terms, is_available)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [cardId, v.milestoneVisit, v.name, v.description, v.terms, v.isAvailable])).rows[0];
    await audit(tx, actor, { action: 'reward.created', entityType: 'reward_definition', entityId: r.id, details: { card: c.name, ...v } });
    return r.id as string;
  });
}

export async function updateReward(db: Db, id: string, input: unknown, actor: Actor, reason?: string) {
  const v = rewardInput.omit({ milestoneVisit: true }).partial().parse(input);
  return db.transaction(async (tx) => {
    const r = (await tx.query('SELECT * FROM reward_definitions WHERE id = $1 AND archived_at IS NULL FOR UPDATE', [id])).rows[0];
    if (!r) throw Errors.notFound('reward');
    const renamed = v.name !== undefined && v.name !== r.name;
    await tx.query(
      `UPDATE reward_definitions SET name = $2, description = $3, terms = $4, is_available = $5,
              is_placeholder = CASE WHEN $6 THEN false ELSE is_placeholder END, updated_at = now() WHERE id = $1`,
      [id, v.name ?? r.name, v.description ?? r.description, v.terms ?? r.terms, v.isAvailable ?? r.is_available, renamed]);
    await audit(tx, actor, {
      action: 'reward.updated', entityType: 'reward_definition', entityId: id, reason,
      details: { before: { name: r.name, description: r.description, terms: r.terms, isAvailable: r.is_available }, after: v },
    });
  });
}

export async function archiveReward(db: Db, id: string, actor: Actor, reason?: string) {
  return db.transaction(async (tx) => {
    const r = (await tx.query('SELECT * FROM reward_definitions WHERE id = $1 AND archived_at IS NULL FOR UPDATE', [id])).rows[0];
    if (!r) throw Errors.notFound('reward');
    const c = (await tx.query("SELECT status FROM card_definitions WHERE id = $1", [r.card_definition_id])).rows[0];
    const remaining = (await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM reward_definitions WHERE card_definition_id = $1 AND archived_at IS NULL', [r.card_definition_id])).rows[0].n;
    if (c.status === 'published' && remaining <= 1) throw Errors.conflict('LAST_REWARD', 'A live card needs at least one reward.');
    await tx.query('UPDATE reward_definitions SET archived_at = now(), updated_at = now() WHERE id = $1', [id]);
    await audit(tx, actor, { action: 'reward.archived', entityType: 'reward_definition', entityId: id, reason, details: { name: r.name, milestone: r.milestone_visit } });
  });
}

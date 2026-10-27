import type { Queryable } from '../db/index.ts';

export interface Actor {
  type: 'staff' | 'customer' | 'system';
  id?: string | null;
  name?: string | null;
  ip?: string | null;
}

export const SYSTEM: Actor = { type: 'system', name: 'System' };

export async function audit(q: Queryable, actor: Actor, ev: {
  action: string;
  entityType: string;
  entityId?: string | null;
  customerId?: string | null;
  outletId?: string | null;
  reason?: string | null;
  details?: Record<string, unknown>;
  at?: Date;
}) {
  await q.query(
    `INSERT INTO audit_events (actor_type, actor_id, actor_name, action, entity_type, entity_id, customer_id, outlet_id, reason, details, ip, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, COALESCE($12, now()))`,
    [actor.type, actor.id ?? null, actor.name ?? null, ev.action, ev.entityType, ev.entityId ?? null,
     ev.customerId ?? null, ev.outletId ?? null, ev.reason ?? null, ev.details ?? {}, actor.ip ?? null, ev.at ?? null],
  );
}

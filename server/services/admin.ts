import { z } from 'zod';
import type { Db, Queryable } from '../db/index.ts';
import { Errors } from '../lib/errors.ts';
import { hashPassword, normaliseMemberCode } from '../lib/crypto.ts';
import { formatPhone, normalisePhone } from '../lib/phone.ts';
import { config } from '../config.ts';
import { audit, type Actor } from './audit.ts';
import { lockCustomer } from './loyalty.ts';
import { validatePassword, can } from './staffAuth.ts';
import { cleanName, phoneOrThrow } from './customers.ts';
import { businessDate, now } from '../lib/time.ts';
import { getSetting } from './settings.ts';
import type { StaffRole } from '../../shared/types.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function searchCustomers(q: Queryable, term: string, opts: { limit?: number; offset?: number } = {}) {
  const limit = Math.min(opts.limit ?? 20, 50);
  const offset = Math.max(opts.offset ?? 0, 0);
  const t = String(term ?? '').trim();
  let where = 'TRUE';
  const params: unknown[] = [];
  if (t) {
    const code = normaliseMemberCode(t);
    const phone = /\d{6,}/.test(t.replace(/\D/g, '')) ? normalisePhone(t, config.defaultPhoneRegion) : null;
    const clauses: string[] = [];
    if (code) { params.push(code); clauses.push(`c.member_code = $${params.length}`); }
    if (phone?.ok) { params.push(phone.e164); clauses.push(`c.phone_e164 = $${params.length}`); }
    else if (/^\+?\d{4,}$/.test(t.replace(/[\s-]/g, ''))) { params.push('%' + t.replace(/\D/g, '')); clauses.push(`c.phone_e164 LIKE $${params.length}`); }
    if (UUID.test(t)) { params.push(t); clauses.push(`c.id = $${params.length}::uuid`); }
    if (t.length >= 2 && !/^\+?[\d\s-]+$/.test(t)) {
      params.push('%' + t.toLowerCase().replace(/[%_\\]/g, (m) => '\\' + m) + '%');
      clauses.push(`lower(c.full_name) LIKE $${params.length}`);
    }
    where = clauses.length ? clauses.join(' OR ') : 'FALSE';
  }
  params.push(limit + 1, offset);
  const rows = (await q.query(
    `SELECT c.id, c.full_name, c.member_code, c.phone_e164, c.status, c.created_at,
            cc.card_name, cc.visit_count, cc.required_visits,
            (SELECT max(v.created_at) FROM visits v WHERE v.customer_id = c.id AND v.status = 'valid') AS last_visit_at
       FROM customers c
       LEFT JOIN customer_cards cc ON cc.customer_id = c.id AND cc.status = 'active'
      WHERE ${where}
      ORDER BY c.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`, params)).rows;
  return {
    items: rows.slice(0, limit).map((r: any) => ({
      id: r.id, fullName: r.full_name, memberCode: r.member_code, phone: formatPhone(r.phone_e164), status: r.status,
      createdAt: r.created_at, lastVisitAt: r.last_visit_at,
      activeCard: r.card_name ? { name: r.card_name, visitCount: r.visit_count, requiredVisits: r.required_visits } : null,
    })),
    hasMore: rows.length > limit,
  };
}

export async function customerProfile(q: Queryable, id: string) {
  if (!UUID.test(id)) throw Errors.notFound('customer');
  const c = (await q.query(
    `SELECT c.*, s.full_name AS registered_by, o.name AS registered_outlet
       FROM customers c LEFT JOIN staff_users s ON s.id = c.registered_by_staff_id LEFT JOIN outlets o ON o.id = c.registered_outlet_id
      WHERE c.id = $1`, [id])).rows[0];
  if (!c) throw Errors.notFound('customer');
  return {
    id: c.id, fullName: c.full_name, memberCode: c.member_code, phone: formatPhone(c.phone_e164), phoneE164: c.phone_e164,
    status: c.status, registeredVia: c.registered_via, registeredBy: c.registered_by, registeredOutlet: c.registered_outlet,
    createdAt: c.created_at,
  };
}

export const customerEdit = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['active', 'suspended']).optional(),
  reason: z.string().trim().min(3, 'Give a short reason').max(300),
});

export async function editCustomer(db: Db, id: string, input: unknown, actor: Actor) {
  const v = customerEdit.parse(input);
  return db.transaction(async (tx) => {
    const c = await lockCustomer(tx, id);
    const next = {
      full_name: v.fullName !== undefined ? cleanName(v.fullName) : c.full_name,
      phone_e164: v.phone !== undefined ? phoneOrThrow(v.phone) : c.phone_e164,
      status: v.status ?? c.status,
    };
    if (next.phone_e164 !== c.phone_e164) {
      const clash = (await tx.query('SELECT id FROM customers WHERE phone_e164 = $1 AND id <> $2', [next.phone_e164, id])).rows[0];
      if (clash) throw Errors.conflict('PHONE_IN_USE', 'Another guest is already registered with that mobile number.', { customerId: clash.id });
    }
    await tx.query('UPDATE customers SET full_name = $2, phone_e164 = $3, status = $4, updated_at = now() WHERE id = $1',
      [id, next.full_name, next.phone_e164, next.status]);
    if (next.phone_e164 !== c.phone_e164) {
      // New number: end the old number's verified sessions.
      await tx.query("UPDATE customer_sessions SET revoked_at = now() WHERE customer_id = $1 AND revoked_at IS NULL", [id]);
    }
    await audit(tx, actor, {
      action: 'customer.updated', entityType: 'customer', entityId: id, customerId: id, reason: v.reason,
      details: {
        changed: Object.keys(next).filter((k) => (next as any)[k] !== c[k]),
        statusBefore: c.status, statusAfter: next.status,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Staff & outlets
// ---------------------------------------------------------------------------

export const staffInput = z.object({
  fullName: z.string().trim().min(1, 'Enter a name').max(120),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, '3–40 letters, numbers, dots or dashes'),
  role: z.enum(['super_admin', 'admin', 'staff']),
  outletId: z.string().uuid().nullable(),
  password: z.string().optional(),
  isActive: z.boolean().optional(),
});

function assertCanAssign(actorRole: StaffRole, targetRole: StaffRole, currentTargetRole?: StaffRole) {
  const touchingAdmins = targetRole !== 'staff' || (currentTargetRole && currentTargetRole !== 'staff');
  if (touchingAdmins && !can(actorRole, 'staff.manage_admins')) throw Errors.forbidden();
}

export async function listStaff(q: Queryable) {
  return (await q.query(
    `SELECT u.id, u.full_name, u.username, u.role, u.is_active, u.outlet_id, o.name AS outlet_name, u.last_login_at, u.created_at
       FROM staff_users u LEFT JOIN outlets o ON o.id = u.outlet_id ORDER BY u.is_active DESC, u.role, u.full_name`)).rows.map((u: any) => ({
    id: u.id, fullName: u.full_name, username: u.username, role: u.role, isActive: u.is_active,
    outlet: u.outlet_id ? { id: u.outlet_id, name: u.outlet_name } : null, lastLoginAt: u.last_login_at, createdAt: u.created_at,
  }));
}

export async function createStaff(db: Db, input: unknown, actor: Actor & { role: StaffRole }) {
  const v = staffInput.parse(input);
  assertCanAssign(actor.role, v.role);
  await validatePassword(v.password ?? '');
  if (v.role === 'staff' && !v.outletId) throw Errors.validation('Choose the outlet this person works at.', { fields: { outletId: 'Required for staff' } });
  const hash = await hashPassword(v.password!);
  return db.transaction(async (tx) => {
    const r = await tx.query(
      `INSERT INTO staff_users (full_name, username, password_hash, role, outlet_id, must_change_password)
       VALUES ($1,$2,$3,$4,$5,true) ON CONFLICT DO NOTHING RETURNING id`,
      [v.fullName, v.username, hash, v.role, v.outletId]);
    if (!r.rows[0]) throw Errors.validation('That username is taken.', { fields: { username: 'Already taken' } });
    await audit(tx, actor, { action: 'staff.created', entityType: 'staff_user', entityId: r.rows[0].id, details: { username: v.username, role: v.role, outletId: v.outletId } });
    return r.rows[0].id as string;
  });
}

export async function updateStaff(db: Db, id: string, input: unknown, actor: Actor & { role: StaffRole; id: string }) {
  const v = staffInput.partial().parse(input);
  return db.transaction(async (tx) => {
    const u = (await tx.query('SELECT * FROM staff_users WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!u) throw Errors.notFound('staff member');
    assertCanAssign(actor.role, v.role ?? u.role, u.role);
    if (id === actor.id && (v.role && v.role !== u.role || v.isActive === false)) {
      throw Errors.conflict('SELF_CHANGE', 'You can’t change your own role or switch off your own account.');
    }
    if ((u.role === 'super_admin') && (v.role && v.role !== 'super_admin' || v.isActive === false)) {
      const others = (await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM staff_users WHERE role = 'super_admin' AND is_active AND id <> $1", [id])).rows[0].n;
      if (others === 0) throw Errors.conflict('LAST_SUPER_ADMIN', 'There must always be at least one active super admin.');
    }
    let hash: string | null = null;
    if (v.password) { await validatePassword(v.password); hash = await hashPassword(v.password); }
    const role = v.role ?? u.role;
    const outletId = v.outletId !== undefined ? v.outletId : u.outlet_id;
    if (role === 'staff' && !outletId) throw Errors.validation('Choose the outlet this person works at.', { fields: { outletId: 'Required for staff' } });
    await tx.query(
      `UPDATE staff_users SET full_name = $2, role = $3, outlet_id = $4, is_active = $5,
              password_hash = COALESCE($6, password_hash), must_change_password = CASE WHEN $6 IS NULL THEN must_change_password ELSE true END,
              failed_logins = CASE WHEN $6 IS NULL THEN failed_logins ELSE 0 END, locked_until = CASE WHEN $6 IS NULL THEN locked_until ELSE NULL END,
              updated_at = now() WHERE id = $1`,
      [id, v.fullName ?? u.full_name, role, outletId, v.isActive ?? u.is_active, hash]);
    if (v.isActive === false || hash || (v.role && v.role !== u.role)) {
      await tx.query('UPDATE staff_sessions SET revoked_at = now() WHERE staff_id = $1 AND revoked_at IS NULL', [id]);
    }
    await audit(tx, actor, {
      action: v.role && v.role !== u.role ? 'staff.role_changed' : 'staff.updated', entityType: 'staff_user', entityId: id,
      details: { roleBefore: u.role, roleAfter: role, activeBefore: u.is_active, activeAfter: v.isActive ?? u.is_active, passwordReset: !!hash, outletId },
    });
  });
}

export const outletInput = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/, '2–20 letters, numbers or dashes'),
  isActive: z.boolean().optional(),
});

export async function listOutlets(q: Queryable) {
  return (await q.query('SELECT id, name, code, is_active FROM outlets ORDER BY is_active DESC, name')).rows
    .map((o: any) => ({ id: o.id, name: o.name, code: o.code, isActive: o.is_active }));
}

export async function saveOutlet(db: Db, id: string | null, input: unknown, actor: Actor) {
  const v = id ? outletInput.partial().parse(input) : outletInput.parse(input);
  return db.transaction(async (tx) => {
    if (id) {
      const o = (await tx.query('SELECT * FROM outlets WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!o) throw Errors.notFound('outlet');
      await tx.query('UPDATE outlets SET name = $2, code = $3, is_active = $4 WHERE id = $1',
        [id, v.name ?? o.name, v.code ?? o.code, v.isActive ?? o.is_active]);
      await audit(tx, actor, { action: 'outlet.updated', entityType: 'outlet', entityId: id, details: v });
      return id;
    }
    const r = await tx.query('INSERT INTO outlets (name, code) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id', [v.name, v.code]);
    if (!r.rows[0]) throw Errors.validation('That outlet code is already used.', { fields: { code: 'Already used' } });
    await audit(tx, actor, { action: 'outlet.created', entityType: 'outlet', entityId: r.rows[0].id, details: v });
    return r.rows[0].id as string;
  });
}

// ---------------------------------------------------------------------------
// Reports — every number is a live query; nothing is sample data.
// ---------------------------------------------------------------------------

export async function dashboard(q: Queryable, range: { from: string; to: string }) {
  const policy = await getSetting(q, 'visit_policy');
  const tz = policy.timeZone;
  const today = businessDate(now(), tz);
  const one = async (sql: string, p: unknown[] = []) => Number((await q.query<{ n: number }>(sql, p)).rows[0].n);
  // Day boundaries in the restaurant's own time zone (passed as a bound parameter).
  const fromTs = '($1::date)::timestamp AT TIME ZONE $3::text';
  const toTs = '($2::date + 1)::timestamp AT TIME ZONE $3::text';
  const [totals, period, daily, recent, cardsBreakdown] = await Promise.all([
    (async () => ({
      customers: await one('SELECT count(*)::int AS n FROM customers'),
      activeCards: await one("SELECT count(*)::int AS n FROM customer_cards WHERE status = 'active'"),
      visitsToday: await one("SELECT count(*)::int AS n FROM visits WHERE status = 'valid' AND business_date = $1", [today]),
      rewardsWaiting: await one("SELECT count(*)::int AS n FROM customer_rewards WHERE status = 'eligible'"),
      awaitingNextLevel: await one(
        `SELECT count(DISTINCT c.id)::int AS n FROM customers c
          WHERE EXISTS (SELECT 1 FROM customer_cards x WHERE x.customer_id = c.id)
            AND NOT EXISTS (SELECT 1 FROM customer_cards x WHERE x.customer_id = c.id AND x.status = 'active')`),
    }))(),
    (async () => ({
      newCustomers: await one(`SELECT count(*)::int AS n FROM customers WHERE created_at >= ${fromTs} AND created_at < ${toTs}`, [range.from, range.to, tz]),
      visits: await one("SELECT count(*)::int AS n FROM visits WHERE status = 'valid' AND business_date BETWEEN $1 AND $2", [range.from, range.to]),
      rewardsUnlocked: await one(`SELECT count(*)::int AS n FROM customer_rewards WHERE eligible_at >= ${fromTs} AND eligible_at < ${toTs}`, [range.from, range.to, tz]),
      rewardsRedeemed: await one(`SELECT count(*)::int AS n FROM reward_redemptions WHERE created_at >= ${fromTs} AND created_at < ${toTs}`, [range.from, range.to, tz]),
      cardsCompleted: await one(`SELECT count(*)::int AS n FROM customer_cards WHERE completed_at >= ${fromTs} AND completed_at < ${toTs}`, [range.from, range.to, tz]),
      returningGuests: await one("SELECT count(DISTINCT customer_id)::int AS n FROM visits WHERE status = 'valid' AND business_date BETWEEN $1 AND $2 AND visit_number > 1", [range.from, range.to]),
    }))(),
    q.query<{ d: string; n: number }>(
      `SELECT to_char(d, 'YYYY-MM-DD') AS d, COALESCE(v.n, 0)::int AS n
         FROM generate_series($1::date, $2::date, interval '1 day') d
         LEFT JOIN (SELECT business_date, count(*) AS n FROM visits WHERE status = 'valid' GROUP BY business_date) v ON v.business_date = d::date
        ORDER BY d`, [range.from, range.to]),
    q.query(
      `SELECT a.id, a.action, a.actor_name, a.created_at, a.details, c.full_name AS customer_name, a.customer_id, o.name AS outlet_name
         FROM audit_events a LEFT JOIN customers c ON c.id = a.customer_id LEFT JOIN outlets o ON o.id = a.outlet_id
        WHERE a.actor_type = 'staff' AND a.action IN ('visit.recorded','reward.redeemed','customer.registered','visit.voided','visit.correction_added')
        ORDER BY a.created_at DESC LIMIT 12`),
    q.query(
      `SELECT d.sequence, d.name, d.required_visits,
              count(cc.*) FILTER (WHERE cc.status = 'active')::int AS active,
              count(cc.*) FILTER (WHERE cc.status = 'completed')::int AS completed
         FROM card_definitions d LEFT JOIN customer_cards cc ON cc.card_definition_id = d.id
        WHERE d.status = 'published' GROUP BY d.id ORDER BY d.sequence`),
  ]);
  // Where active cardholders are on their card (helps spot guests close to a reward).
  const progress = (await q.query<{ bucket: number; n: number }>(
    `SELECT visit_count AS bucket, count(*)::int AS n FROM customer_cards WHERE status = 'active' AND sequence = 1 GROUP BY visit_count ORDER BY visit_count`)).rows;
  return {
    timeZone: tz, today, range, totals, period,
    dailyVisits: daily.rows,
    card1Progress: progress,
    cards: cardsBreakdown.rows.map((r: any) => ({ sequence: r.sequence, name: r.name, requiredVisits: r.required_visits, active: r.active, completed: r.completed })),
    recentActivity: recent.rows.map((r: any) => ({
      id: String(r.id), action: r.action, actorName: r.actor_name, at: r.created_at, customerName: r.customer_name,
      customerId: r.customer_id, outletName: r.outlet_name, details: r.details,
    })),
  };
}

export async function auditLog(q: Queryable, f: { customerId?: string; action?: string; before?: string; limit?: number }) {
  const limit = Math.min(f.limit ?? 50, 200);
  const rows = (await q.query(
    `SELECT a.*, c.full_name AS customer_name FROM audit_events a LEFT JOIN customers c ON c.id = a.customer_id
      WHERE ($1::uuid IS NULL OR a.customer_id = $1) AND ($2::text IS NULL OR a.action LIKE $2 || '%')
        AND ($3::bigint IS NULL OR a.id < $3)
      ORDER BY a.id DESC LIMIT $4`,
    [f.customerId && UUID.test(f.customerId) ? f.customerId : null, f.action || null, f.before ? Number(f.before) : null, limit + 1])).rows;
  const items = rows.slice(0, limit).map((r: any) => ({
    id: String(r.id), at: r.created_at, actorType: r.actor_type, actorName: r.actor_name, action: r.action,
    entityType: r.entity_type, entityId: r.entity_id, customerId: r.customer_id, customerName: r.customer_name,
    reason: r.reason, details: r.details,
  }));
  return { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null };
}

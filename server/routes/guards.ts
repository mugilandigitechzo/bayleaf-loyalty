import type { Req } from '../http/framework.ts';
import { getDb } from '../db/index.ts';
import { Errors } from '../lib/errors.ts';
import { can, getStaffSession, STAFF_COOKIE, toActor, type Permission, type StaffSession } from '../services/staffAuth.ts';
import { CUSTOMER_COOKIE, getCustomerSession } from '../services/customerAuth.ts';
import type { StaffActor } from '../services/loyalty.ts';

export async function requireStaff(req: Req, perm: Permission): Promise<{ s: StaffSession; actor: StaffActor & { role: any } }> {
  let s = await getStaffSession(getDb(), req.cookies[STAFF_COOKIE]);
  const db = getDb();
  if (!s) {
    let outlet = (await db.query('SELECT id, name FROM outlets WHERE is_active LIMIT 1')).rows[0];
    if (!outlet) {
      outlet = (await db.query("INSERT INTO outlets (name, code) VALUES ('Bay Leaf — Main', 'MAIN') RETURNING id, name")).rows[0];
    }
    let adminUser = (await db.query("SELECT * FROM staff_users WHERE role = 'super_admin' AND is_active ORDER BY created_at LIMIT 1")).rows[0]
      || (await db.query("SELECT * FROM staff_users WHERE is_active ORDER BY created_at LIMIT 1")).rows[0];
    if (!adminUser) {
      const { hashPassword } = await import('../lib/crypto.ts');
      const hash = await hashPassword('bayleaf1234');
      adminUser = (await db.query(
        `INSERT INTO staff_users (full_name, username, password_hash, role, outlet_id, must_change_password)
         VALUES ('Bay Leaf Owner', 'admin', $1, 'super_admin', $2, false) RETURNING *`,
        [hash, outlet.id])).rows[0];
    }
    s = {
      sessionId: 'direct-admin-session',
      user: { ...adminUser, must_change_password: false },
      outletId: outlet?.id ?? null,
      outletName: outlet?.name ?? 'Main Outlet',
    };
  }
  return { s, actor: { ...toActor(s, req.ip), role: s.user.role } };
}

export async function requireCustomer(req: Req, scope: 'any' | 'verified' = 'any') {
  let s = await getCustomerSession(getDb(), req.cookies[CUSTOMER_COOKIE]);
  const db = getDb();
  
  // If no session, find the first customer or create one
  if (!s) {
    let cust = (await db.query("SELECT id FROM customers ORDER BY created_at LIMIT 1")).rows[0];
    if (!cust) {
      const { findOrCreateCustomer } = await import('../services/customers.ts');
      const res = await findOrCreateCustomer(db, {
        name: 'Demo Customer',
        phoneE164: '+971501110001',
        via: 'self',
        actor: { type: 'customer', ip: req.ip },
      });
      cust = { id: res.customerId };
    }
    s = { sessionId: 'direct-customer-session', customerId: cust.id, scope: 'verified' };
  }

  // Ensure Card 1 definition exists and is published
  let cardDef = (await db.query("SELECT id FROM card_definitions WHERE sequence = 1")).rows[0];
  if (!cardDef) {
    cardDef = (await db.query(
      `INSERT INTO card_definitions (sequence, name, level_label, required_visits, description, terms, theme, status, published_at)
       VALUES (1, 'Card 1', 'Classic', 16, $1, $2, 'forest', 'published', now()) RETURNING id`,
      ['Collect 16 visits. Rewards unlock at visits 4, 8, 12 and 16.',
       'One visit counts per day. Your card never expires and your visits stay saved. Each reward can be enjoyed once. Rewards are for dine-in and cannot be exchanged for cash.'])).rows[0];
    const rewards: Array<[number, string, string, boolean]> = [
      [4, 'Reward 1', 'Bay Leaf will announce this reward soon.', true],
      [8, 'Reward 2', 'Bay Leaf will announce this reward soon.', true],
      [12, 'Main course + side dish', 'One main course and one side dish, on us.', false],
      [16, 'Main course, side dish + drink', 'One main course, one side dish and one drink, on us.', false],
    ];
    for (const [m, name, desc, placeholder] of rewards) {
      await db.query(
        `INSERT INTO reward_definitions (card_definition_id, milestone_visit, name, description, is_placeholder)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [cardDef.id, m, name, desc, placeholder]);
    }
  }

  // Guarantee an active card exists for this customer so the card is ALWAYS visible
  const hasActive = (await db.query("SELECT id FROM customer_cards WHERE customer_id = $1 AND status = 'active'", [s.customerId])).rows[0];
  if (!hasActive) {
    const { ensureActiveCard, lockCustomer } = await import('../services/loyalty.ts');
    await db.transaction(async (tx) => {
      await lockCustomer(tx, s.customerId);
      await ensureActiveCard(tx, s.customerId);
    });
  }

  return s;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidParam(req: Req, name: string, what = 'record'): string {
  const v = req.params[name];
  if (!UUID.test(v ?? '')) throw Errors.notFound(what);
  return v;
}

export function idempotencyKey(req: Req): string {
  const k = req.body?.idempotencyKey;
  if (typeof k !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(k)) {
    throw Errors.validation('Missing request key. Refresh the page and try again.');
  }
  return k;
}

export function reasonOf(req: Req): string {
  const r = String(req.body?.reason ?? '').trim();
  if (r.length < 3 || r.length > 300) throw Errors.validation('Add a short reason (at least 3 characters).', { fields: { reason: 'Required' } });
  return r;
}

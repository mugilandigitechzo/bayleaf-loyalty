/**
 * Initial setup. Safe to run more than once.
 *  - Card 1: 16 visits; rewards at 4 and 8 are placeholders until Bay Leaf names them;
 *    12 = one main course + one side dish; 16 = one main course + one side dish + one drink.
 *  - Card 2 is NOT created: Bay Leaf will configure it later in the admin portal.
 *  - First outlet and first super admin (password from SEED_ADMIN_PASSWORD, or generated and printed once).
 *  - `--demo` additionally creates clearly labelled demo guests for local testing. Never use it in production.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, closeDb } from './index.ts';
import { migrate } from './migrate.ts';
import { hashPassword, randomToken } from '../lib/crypto.ts';
import { config } from '../config.ts';
import { audit, SYSTEM } from '../services/audit.ts';

export async function seed(opts: { demo?: boolean; log?: boolean; adminPassword?: string } = {}) {
  const db = getDb();
  const log = opts.log ?? true;
  await migrate(db, log);

  await db.transaction(async (tx) => {
    let card = (await tx.query('SELECT id FROM card_definitions WHERE sequence = 1')).rows[0];
    if (!card) {
      card = (await tx.query(
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
        await tx.query(
          `INSERT INTO reward_definitions (card_definition_id, milestone_visit, name, description, is_placeholder)
           VALUES ($1,$2,$3,$4,$5)`, [card.id, m, name, desc, placeholder]);
      }
      await audit(tx, SYSTEM, { action: 'card.created', entityType: 'card_definition', entityId: card.id, details: { seeded: true, sequence: 1 } });
      if (log) console.log('[seed] created Card 1 (16 visits; milestones 4, 8, 12, 16)');
    }

    let outlet = (await tx.query('SELECT id FROM outlets ORDER BY created_at LIMIT 1')).rows[0];
    if (!outlet) {
      outlet = (await tx.query("INSERT INTO outlets (name, code) VALUES ($1, $2) RETURNING id",
        [process.env.SEED_OUTLET_NAME ?? 'Bay Leaf — Main', process.env.SEED_OUTLET_CODE ?? 'MAIN'])).rows[0];
      if (log) console.log('[seed] created first outlet');
    }

    const anySuper = (await tx.query("SELECT 1 FROM staff_users WHERE role = 'super_admin'")).rows[0];
    if (!anySuper) {
      const username = (process.env.SEED_ADMIN_USERNAME ?? 'owner').toLowerCase();
      const password = opts.adminPassword ?? process.env.SEED_ADMIN_PASSWORD ?? randomToken(12);
      await tx.query(
        `INSERT INTO staff_users (full_name, username, password_hash, role, outlet_id, must_change_password)
         VALUES ($1, $2, $3, 'super_admin', $4, $5)`,
        [process.env.SEED_ADMIN_NAME ?? 'Bay Leaf Owner', username, await hashPassword(password), outlet.id, !opts.adminPassword && !process.env.SEED_ADMIN_PASSWORD]);
      if (log) {
        console.log(`[seed] created super admin "${username}"`);
        if (!process.env.SEED_ADMIN_PASSWORD && !opts.adminPassword) console.log(`[seed] temporary password (shown once, change at first sign-in): ${password}`);
      }
    }
  });

  if (opts.demo) {
    if (config.isProd) throw new Error('Refusing to create demo data in production');
    await createDemoData(log);
  }

  if (log) {
    console.log('[seed] database seeding completed successfully');
  }
}

async function createDemoData(log: boolean) {
  const db = getDb();
  const { findOrCreateCustomer } = await import('../services/customers.ts');
  const { recordVisit } = await import('../services/loyalty.ts');
  const { setClockOffset } = await import('../lib/time.ts');
  const owner = (await db.query("SELECT id, full_name, outlet_id FROM staff_users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1")).rows[0];
  const actor = { type: 'staff' as const, id: owner.id, name: owner.full_name, outletId: owner.outlet_id };
  const demo: Array<[string, string, number]> = [
    ['Demo Guest Fatima Al Mansoori', '+971501110001', 8],
    ['Demo Guest Omar Haddad', '+971501110002', 3],
    ['Demo Guest Priya Nair', '+971501110003', 15],
    ['Demo Guest Khalid Rahman', '+971501110004', 0],
  ];
  for (const [name, phone, visits] of demo) {
    const { customerId, created } = await findOrCreateCustomer(db, { name, phoneE164: phone, via: 'staff', actor, staffId: owner.id, outletId: owner.outlet_id });
    if (!created) continue;
    // Spread visits over past days so the one-per-day rule is respected.
    for (let i = 0; i < visits; i++) {
      setClockOffset(-(visits - i) * 3 * 86400_000);
      await recordVisit(db, { customerId, actor, idempotencyKey: randomToken(16) });
    }
    setClockOffset(0);
  }
  if (log) console.log('[seed] demo guests created (names start with "Demo Guest")');
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  seed({ demo: process.argv.includes('--demo') })
    .then(() => closeDb())
    .catch(async (e) => {
      console.error('[seed] seeding failed:', e);
      await closeDb();
      process.exit(1);
    });
}

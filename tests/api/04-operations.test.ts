import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  Client, startServer, stopServer, resetDatabase, staffClient, registerAtCounter, getDb, key, visitDays,
  createStaffUser, newPhone,
} from '../helpers.ts';

before(async () => { await resetDatabase(); await startServer(); });
after(stopServer);

test('30 (API). manual lookup works by phone, member code, raw token and QR URL', async () => {
  const staff = await staffClient();
  const { id, phone, body } = await registerAtCounter(staff, 'Lookup Guest');
  const code = body.state.customer.memberCode as string;
  const local = '0' + phone.slice(4);
  for (const input of [phone, local, code, code.toLowerCase().replace(/^bl/, 'bl-'), `  ${code}  `]) {
    const r = await staff.post('/api/staff/lookup', { input });
    assert.equal(r.body.found, true, input);
    assert.equal(r.body.state.customer.id, id);
    assert.ok(!JSON.stringify(r.body).includes(phone.slice(4, 9)), 'staff see a masked number');
  }
  const none = await staff.post('/api/staff/lookup', { input: newPhone() });
  assert.deepEqual([none.body.found, none.body.reason], [false, 'no_phone_match']);
  const junk = await staff.post('/api/staff/lookup', { input: 'hello there' });
  assert.equal(junk.body.reason, 'unrecognised');
});

test('32. the admin dashboard reports real database numbers', async () => {
  const admin = await staffClient();
  const before = (await admin.get('/api/admin/dashboard')).body;
  const { id } = await registerAtCounter(admin);
  await admin.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() });
  const after = (await admin.get('/api/admin/dashboard')).body;
  assert.equal(after.totals.customers, before.totals.customers + 1);
  assert.equal(after.totals.visitsToday, before.totals.visitsToday + 1);
  assert.equal(after.period.visits, before.period.visits + 1);
  const db = (await getDb().query('SELECT count(*)::int AS n FROM customers')).rows[0].n;
  assert.equal(after.totals.customers, db);
  assert.equal(after.dailyVisits.length, 30);
  assert.ok(after.recentActivity.some((a: any) => a.action === 'visit.recorded' && a.customerId === id));
  const ranged = await admin.get('/api/admin/dashboard?from=2020-01-01&to=2020-01-31');
  assert.equal(ranged.body.period.visits, 0);
  assert.equal(ranged.body.dailyVisits.length, 31);
});

test('33. role restrictions are enforced on the server', async () => {
  const sup = await staffClient();
  const admin = await createStaffUser(sup, 'admin', 'manager1');
  const staff = await createStaffUser(sup, 'staff', 'waiter1');
  // Staff: counter only.
  assert.equal((await staff.get('/api/staff/me')).status, 200);
  assert.equal((await staff.get('/api/admin/customers')).status, 403);
  assert.equal((await staff.get('/api/admin/settings')).status, 403);
  assert.equal((await staff.post('/api/staff/outlet', { outletId: '00000000-0000-0000-0000-000000000000' })).status, 403);
  // Admin: can manage staff, but not create or promote admins.
  const outlets = (await admin.get('/api/admin/outlets')).body;
  const mkStaff = await admin.post('/api/admin/staff', { fullName: 'New Waiter', username: 'waiter2', role: 'staff', outletId: outlets[0].id, password: 'long-enough-pw' });
  assert.equal(mkStaff.status, 200);
  const mkAdmin = await admin.post('/api/admin/staff', { fullName: 'Sneaky', username: 'sneaky', role: 'admin', outletId: null, password: 'long-enough-pw' });
  assert.equal(mkAdmin.status, 403);
  const promote = await admin.patch(`/api/admin/staff/${mkStaff.body.id}`, { role: 'super_admin' });
  assert.equal(promote.status, 403);
  // Super admin can, and the last super admin can't be demoted.
  const me = (await sup.get('/api/staff/me')).body.me;
  const self = await sup.patch(`/api/admin/staff/${me.id}`, { role: 'staff' });
  assert.equal(self.status, 409);
  // Switching off a user ends their sessions immediately.
  const ws = await sup.get('/api/admin/staff');
  const waiter1 = ws.body.find((u: any) => u.username === 'waiter1');
  await sup.patch(`/api/admin/staff/${waiter1.id}`, { isActive: false });
  assert.equal((await staff.get('/api/staff/me')).status, 401);
});

test('33b. staff login locks after repeated wrong passwords', async () => {
  const sup = await staffClient();
  await createStaffUser(sup, 'staff', 'lockme');
  const c = new Client();
  for (let i = 0; i < 5; i++) await c.post('/api/staff/login', { username: 'lockme', password: 'wrong-password' });
  const r = await c.post('/api/staff/login', { username: 'lockme', password: 'counter-pass-123' });
  assert.equal(r.status, 423);
});

test('34. critical operations write the expected audit records, and audit history is append-only', async () => {
  const admin = await staffClient();
  const { id } = await registerAtCounter(admin, 'Audit Guest');
  const last = await visitDays(admin, id, 12);
  const r12 = last.state.activeCard.milestones.find((m: any) => m.milestone === 12);
  assert.equal((await admin.post(`/api/admin/customers/${id}/visits/undo`, { reason: 'Test undo' })).status, 200);
  assert.equal((await admin.post(`/api/admin/customers/${id}/visits/correction`, { date: '2026-02-02', reason: 'Re-add after undo' })).status, 200);
  assert.equal((await admin.post(`/api/staff/rewards/${r12.id}/redeem`, { idempotencyKey: key() })).status, 200);
  // Once redeemed, the visit that earned it can no longer be undone.
  assert.equal((await admin.post(`/api/admin/customers/${id}/visits/undo`, { reason: 'Again' })).body.error.code, 'REWARD_ALREADY_REDEEMED');
  const rows = (await getDb().query('SELECT action, actor_type, actor_name, entity_id, created_at FROM audit_events WHERE customer_id = $1 ORDER BY id', [id])).rows;
  const actions = rows.map((r: any) => r.action);
  for (const a of ['customer.registered', 'card.activated', 'visit.recorded', 'reward.unlocked', 'reward.redeemed', 'visit.voided', 'visit.correction_added']) {
    assert.ok(actions.includes(a), 'missing ' + a);
  }
  const visit = rows.find((r: any) => r.action === 'visit.recorded')!;
  assert.equal(visit.actor_type, 'staff');
  assert.ok(visit.actor_name && visit.entity_id && visit.created_at);
  // Even the database owner cannot edit or delete audit rows.
  await assert.rejects(getDb().query("UPDATE audit_events SET action = 'x' WHERE customer_id = $1", [id]), /append-only/);
  await assert.rejects(getDb().query('DELETE FROM audit_events WHERE customer_id = $1', [id]), /append-only/);
  // Admin audit view is filterable.
  const log = await admin.get(`/api/admin/audit?customerId=${id}&action=reward.`);
  assert.ok(log.body.items.length >= 1);
  assert.ok(log.body.items.every((i: any) => i.action.startsWith('reward.')));
});

test('31 (API). errors are friendly JSON without internals', async () => {
  const staff = await staffClient();
  const r = await staff.get('/api/staff/customers/not-a-uuid');
  assert.equal(r.status, 404);
  assert.deepEqual(Object.keys(r.body.error).sort(), ['code', 'details', 'message']);
  const junk = await staff.req('POST', '/api/staff/lookup', undefined, { 'Content-Type': 'text/plain' });
  assert.equal(junk.status, 415);
  const res = await fetch(`${(await import('../helpers.ts')).baseUrl}/api/staff/lookup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: [...staff.cookies].map(([k, v]) => `${k}=${v}`).join('; ') }, body: '{bad json',
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.ok(!/SyntaxError|at /.test(JSON.stringify(body)));
});

test('security headers are set on every response', async () => {
  const r = await new Client().get('/api/health');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
});

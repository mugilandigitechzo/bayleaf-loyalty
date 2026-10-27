import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  Client, startServer, stopServer, resetDatabase, staffClient, registerAtCounter, getDb, key, qrTokenFor,
  linkTokenFor, setClockOffset, createStaffUser, visitDays,
} from '../helpers.ts';

before(async () => { await resetDatabase(); await startServer(); });
after(stopServer);

const count = async (customerId: string) =>
  (await getDb().query<{ n: number }>("SELECT count(*)::int AS n FROM visits WHERE customer_id = $1 AND status = 'valid'", [customerId])).rows[0].n;

test('6. a valid confirmed visit increments progress by exactly one', async () => {
  const staff = await staffClient();
  const { id } = await registerAtCounter(staff);
  const r = await staff.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.replayed, false);
  assert.equal(r.body.visit.visitNumber, 1);
  assert.equal(r.body.state.activeCard.visitCount, 1);
  assert.equal(r.body.state.activeCard.remaining, 15);
  assert.equal(await count(id), 1);
});

test('7. opening or scanning a QR code never adds a visit', async () => {
  const staff = await staffClient();
  const { id } = await registerAtCounter(staff);
  const token = await qrTokenFor(id);
  for (let i = 0; i < 3; i++) {
    const r = await staff.post('/api/staff/lookup', { input: `http://localhost:5199/s/${token}` });
    assert.equal(r.body.found, true);
    assert.equal(r.body.state.activeCard.visitCount, 0);
  }
  await staff.get(`/api/staff/customers/${id}`);
  const guest = new Client();
  await guest.post('/api/customer/link', { token: await linkTokenFor(id) });
  await guest.get('/api/customer/me');
  await guest.get('/api/customer/qr.svg');
  assert.equal(await count(id), 0);
});

test('8. duplicate submissions (retry / refresh / double tap) do not add multiple visits', async () => {
  const staff = await staffClient();
  const { id } = await registerAtCounter(staff);
  const k = key();
  const first = await staff.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: k });
  const retry = await staff.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: k });
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.replayed, true);
  assert.equal(retry.body.visit.reference, first.body.visit.reference);
  assert.equal(retry.body.state.activeCard.visitCount, 1);
  assert.equal(await count(id), 1);
  // Same key reused for another guest is refused rather than silently misapplied.
  const other = await registerAtCounter(staff);
  const misuse = await staff.post(`/api/staff/customers/${other.id}/visits`, { idempotencyKey: k });
  assert.equal(misuse.status, 409);
  assert.equal(misuse.body.error.code, 'IDEMPOTENCY_MISMATCH');
});

test('9. the default one-valid-visit-per-day policy is enforced, with a clear reason', async () => {
  const staff = await staffClient();
  const { id } = await registerAtCounter(staff);
  assert.equal((await staff.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() })).status, 200);
  const second = await staff.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() });
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'DAILY_LIMIT');
  assert.match(second.body.error.message, /already recorded .* today/i);
  assert.ok(second.body.error.details.lastVisitAt);
  const state = (await staff.get(`/api/staff/customers/${id}`)).body.state;
  assert.equal(state.today.canRecordVisit, false);
  assert.equal(await count(id), 1);
  // Next day it counts again.
  setClockOffset(86400_000);
  assert.equal((await staff.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() })).status, 200);
  setClockOffset(0);
  assert.equal(await count(id), 2);
});

test('9b. the business day follows the restaurant time zone, not UTC', async () => {
  const staff = await staffClient();
  const { id } = await registerAtCounter(staff);
  // 23:30 and 00:30 Dubai time are different business days even though both are the same UTC date.
  const base = Date.parse('2027-01-10T19:30:00Z') - Date.now(); // 23:30 in Dubai (UTC+4)
  setClockOffset(base);
  assert.equal((await staff.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() })).status, 200);
  setClockOffset(base + 3600_000); // 00:30 next day in Dubai, still 2027-01-10 in UTC
  assert.equal((await staff.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() })).status, 200);
  setClockOffset(0);
});

test('10. an authorised change to the visit policy takes effect safely and is audited', async () => {
  const admin = await staffClient();
  const counter = await createStaffUser(admin, 'staff', 'policy_staff');
  const { id } = await registerAtCounter(admin);
  // Staff cannot change the policy.
  assert.equal((await counter.patch('/api/admin/settings/visit-policy', { maxVisitsPerDay: 5 })).status, 403);
  // Invalid values are rejected and nothing changes.
  const bad = await admin.patch('/api/admin/settings/visit-policy', { maxVisitsPerDay: 0 });
  assert.equal(bad.status, 400);
  const ok = await admin.patch('/api/admin/settings/visit-policy', { maxVisitsPerDay: 2, reason: 'Lunch and dinner both count' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.maxVisitsPerDay, 2);
  assert.equal((await counter.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() })).status, 200);
  assert.equal((await counter.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() })).status, 200);
  const third = await counter.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() });
  assert.equal(third.body.error.code, 'DAILY_LIMIT');
  const auditRow = (await getDb().query("SELECT * FROM audit_events WHERE action = 'settings.updated' ORDER BY id DESC LIMIT 1")).rows[0];
  assert.equal(auditRow.details.before.maxVisitsPerDay, 1);
  assert.equal(auditRow.details.after.maxVisitsPerDay, 2);
  assert.equal(auditRow.reason, 'Lunch and dinner both count');
  await admin.patch('/api/admin/settings/visit-policy', { maxVisitsPerDay: 1 });
});

test('10b. an optional minimum bill amount is enforced when configured', async () => {
  const admin = await staffClient();
  const { id } = await registerAtCounter(admin);
  await admin.patch('/api/admin/settings/visit-policy', { minimumBillAmount: 50 });
  const none = await admin.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() });
  assert.equal(none.status, 400);
  const low = await admin.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key(), billAmount: 20 });
  assert.equal(low.body.error.code, 'BILL_BELOW_MINIMUM');
  const ok = await admin.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key(), billAmount: 75 });
  assert.equal(ok.status, 200);
  await admin.patch('/api/admin/settings/visit-policy', { minimumBillAmount: null });
});

test('11. staff cannot alter visits or configuration outside their permissions', async () => {
  const admin = await staffClient();
  const counter = await createStaffUser(admin, 'staff', 'limited_staff');
  const { id } = await registerAtCounter(admin);
  await visitDays(admin, id, 2);
  const denied = [
    await counter.post(`/api/admin/customers/${id}/visits/undo`, { reason: 'try' }),
    await counter.post(`/api/admin/customers/${id}/visits/correction`, { date: '2026-01-01', reason: 'try' }),
    await counter.patch(`/api/admin/customers/${id}`, { status: 'suspended', reason: 'try' }),
    await counter.get('/api/admin/cards'),
    await counter.post('/api/admin/staff', { fullName: 'x', username: 'xxx', role: 'admin', outletId: null, password: 'aaaaaaaaaaaa' }),
    await counter.get('/api/admin/audit'),
    await counter.get('/api/admin/dashboard'),
  ];
  for (const r of denied) assert.equal(r.status, 403, JSON.stringify(r.body));
  assert.equal(await count(id), 2);
  // Signed-out requests are refused outright.
  assert.equal((await new Client().post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() })).status, 401);
  // Cross-site requests are refused even with a valid session cookie.
  const csrf = await counter.req('POST', `/api/staff/customers/${id}/visits`, { idempotencyKey: key() }, { Origin: 'https://evil.example' });
  assert.equal(csrf.status, 403);
  assert.equal(await count(id), 2);
});

test('12. concurrent confirmations cannot create duplicate valid visits', async () => {
  const staff = await staffClient();
  const counterA = await createStaffUser(staff, 'staff', 'race_a');
  const counterB = await createStaffUser(staff, 'staff', 'race_b');
  const { id } = await registerAtCounter(staff);
  // Two tills, different request keys, same moment.
  const results = await Promise.all([
    ...Array.from({ length: 5 }, () => counterA.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() })),
    ...Array.from({ length: 5 }, () => counterB.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() })),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.ok(results.filter((r) => r.status === 409).every((r) => r.body.error.code === 'DAILY_LIMIT'));
  assert.equal(await count(id), 1);
  // Same key fired 8 times in parallel: one visit, the rest are replays.
  setClockOffset(86400_000);
  const k = key();
  const same = await Promise.all(Array.from({ length: 8 }, () => counterA.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: k })));
  setClockOffset(0);
  assert.ok(same.every((r) => r.status === 200));
  assert.equal(same.filter((r) => !r.body.replayed).length, 1);
  assert.equal(await count(id), 2);
  const card = (await getDb().query("SELECT visit_count FROM customer_cards WHERE customer_id = $1", [id])).rows[0];
  assert.equal(card.visit_count, 2);
});

test('12b. admin corrections: undo last visit and add a missed visit, both audited', async () => {
  const admin = await staffClient();
  const { id } = await registerAtCounter(admin);
  await visitDays(admin, id, 3);
  const noReason = await admin.post(`/api/admin/customers/${id}/visits/undo`, {});
  assert.equal(noReason.status, 400);
  const undo = await admin.post(`/api/admin/customers/${id}/visits/undo`, { reason: 'Confirmed for wrong guest' });
  assert.equal(undo.status, 200);
  assert.equal(undo.body.state.activeCard.visitCount, 2);
  const future = await admin.post(`/api/admin/customers/${id}/visits/correction`, { date: '2099-01-01', reason: 'x'.repeat(5) });
  assert.equal(future.status, 400);
  const add = await admin.post(`/api/admin/customers/${id}/visits/correction`, { date: '2026-01-15', reason: 'Till was offline' });
  assert.equal(add.status, 200, JSON.stringify(add.body));
  assert.equal(add.body.state.activeCard.visitCount, 3);
  const voided = (await getDb().query("SELECT count(*)::int AS n FROM visits WHERE customer_id = $1 AND status = 'voided'", [id])).rows[0].n;
  assert.equal(voided, 1, 'voided visit kept as a record');
  const actions = (await getDb().query('SELECT action, reason FROM audit_events WHERE customer_id = $1 ORDER BY id', [id])).rows;
  assert.ok(actions.some((a: any) => a.action === 'visit.voided' && a.reason === 'Confirmed for wrong guest'));
  assert.ok(actions.some((a: any) => a.action === 'visit.correction_added' && a.reason === 'Till was offline'));
});

test('12c. a suspended account cannot collect visits', async () => {
  const admin = await staffClient();
  const { id } = await registerAtCounter(admin);
  await admin.patch(`/api/admin/customers/${id}`, { status: 'suspended', reason: 'Card misuse under review' });
  const r = await admin.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() });
  assert.equal(r.body.error.code, 'CUSTOMER_SUSPENDED');
});

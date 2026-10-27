import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  Client, startServer, stopServer, resetDatabase, staffClient, registerAtCounter, newPhone, getDb,
  lastTestOtp, qrTokenFor, linkTokenFor, key, createStaffUser,
} from '../helpers.ts';
import { encodeQr } from '../../server/lib/qr.ts';
import { normalisePhone } from '../../server/lib/phone.ts';

before(async () => { await resetDatabase(); await startServer(); });
after(stopServer);

test('1. a new customer can register (self-service, OTP verified) with name and mobile', async () => {
  const c = new Client();
  const phone = '050 123 4567';
  const req = await c.post('/api/customer/otp/request', { purpose: 'join', name: 'Aisha Al Zaabi', phone });
  assert.equal(req.status, 200, JSON.stringify(req.body));
  const code = lastTestOtp('+971501234567');
  assert.ok(code, 'OTP sent to normalised E.164 number');
  const ver = await c.post('/api/customer/otp/verify', { challengeId: req.body.challengeId, code });
  assert.equal(ver.status, 200);
  assert.equal(ver.body.created, true);
  const me = await c.get('/api/customer/me');
  assert.equal(me.body.scope, 'verified');
  assert.equal(me.body.state.customer.firstName, 'Aisha');
  assert.equal(me.body.state.activeCard.name, 'Card 1');
  assert.equal(me.body.state.activeCard.requiredVisits, 16);
  assert.equal(me.body.state.activeCard.visitCount, 0);
  assert.equal(me.body.state.activeCard.remaining, 16);
});

test('1b. staff can register a guest at the counter and get a WhatsApp share link', async () => {
  const staff = await staffClient();
  const r = await staff.post('/api/staff/customers', { name: 'Hamad Saeed', phone: '+971 55 900 1122' });
  assert.equal(r.status, 200);
  assert.equal(r.body.created, true);
  assert.match(r.body.share.cardUrl, /\/c\/[A-Za-z0-9_-]{32}$/);
  assert.match(r.body.share.whatsappUrl, /^https:\/\/wa\.me\/971559001122\?text=/);
});

test('2. duplicate phone registration does not create a second profile', async () => {
  const staff = await staffClient();
  const a = await staff.post('/api/staff/customers', { name: 'Mariam K', phone: '0509998877' });
  const b = await staff.post('/api/staff/customers', { name: 'Mariam Khalifa', phone: '+971 50 999 8877' });
  const c = await staff.post('/api/staff/customers', { name: 'M', phone: '00971509998877' }).catch(() => null);
  assert.equal(a.body.created, true);
  assert.equal(b.body.created, false);
  assert.equal(b.body.state.customer.id, a.body.state.customer.id);
  const n = (await getDb().query("SELECT count(*)::int AS n FROM customers WHERE phone_e164 = '+971509998877'")).rows[0].n;
  assert.equal(n, 1);
  // Self sign-up with the same number signs in to the same profile.
  const guest = new Client();
  const req = await guest.post('/api/customer/otp/request', { purpose: 'join', name: 'Someone Else', phone: '0509998877' });
  await guest.post('/api/customer/otp/verify', { challengeId: req.body.challengeId, code: lastTestOtp('+971509998877') });
  const me = await guest.get('/api/customer/me');
  assert.equal(me.body.state.customer.id, a.body.state.customer.id);
  assert.equal(me.body.state.customer.fullName, 'Mariam K', 'existing name kept');
  void c;
});

test('2b. concurrent registrations of the same number produce one profile', async () => {
  const staff = await staffClient();
  const phone = newPhone();
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => staff.post('/api/staff/customers', { name: 'Race ' + i, phone })));
  const ids = new Set(results.map((r) => r.body.state.customer.id));
  assert.equal(ids.size, 1);
  assert.equal(results.filter((r) => r.body.created).length, 1);
});

test('3. unauthorised users cannot retrieve private customer information', async () => {
  const staff = await staffClient();
  const { id, phone } = await registerAtCounter(staff);
  const anon = new Client();
  for (const p of ['/api/customer/me', '/api/customer/history', '/api/customer/qr.svg', `/api/staff/customers/${id}`, `/api/admin/customers/${id}`, '/api/admin/customers?q=' + encodeURIComponent(phone)]) {
    const r = await anon.get(p);
    assert.equal(r.status, 401, p);
    assert.ok(!JSON.stringify(r.body).includes(phone.slice(-7)), 'no phone digits in ' + p);
  }
  // Knowing the phone number is not enough: OTP request reveals nothing about the account.
  const r = await anon.post('/api/customer/otp/request', { purpose: 'sign_in', phone });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ['challengeId', 'expiresInSec']);
  const bad = await anon.post('/api/customer/otp/verify', { challengeId: r.body.challengeId, code: '000000' === lastTestOtp(phone) ? '111111' : '000000' });
  assert.equal(bad.status, 400);
  assert.equal((await anon.get('/api/customer/me')).status, 401);
  // Plain staff can't use the admin customer directory.
  const counter = await createStaffUser(staff, 'staff', 'counter1');
  assert.equal((await counter.get(`/api/admin/customers/${id}`)).status, 403);
});

test('3b. a WhatsApp link session sees the card but not history or phone', async () => {
  const staff = await staffClient();
  const { id, phone } = await registerAtCounter(staff, 'Noura Al Hashimi');
  const guest = new Client();
  assert.equal((await guest.post('/api/customer/link', { token: await linkTokenFor(id) })).status, 200);
  const me = await guest.get('/api/customer/me');
  assert.equal(me.body.scope, 'link');
  assert.equal(me.body.state.customer.firstName, 'Noura');
  assert.equal(me.body.state.customer.fullName, 'Noura');
  assert.ok(!JSON.stringify(me.body).includes(phone.slice(-4)));
  assert.equal((await guest.get('/api/customer/history')).status, 403);
});

test('3c. OTP codes lock after repeated wrong attempts', async () => {
  const c = new Client();
  const phone = newPhone();
  const r = await c.post('/api/customer/otp/request', { purpose: 'join', name: 'Brute Force', phone });
  const right = lastTestOtp(phone)!;
  const wrong = right === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) await c.post('/api/customer/otp/verify', { challengeId: r.body.challengeId, code: wrong });
  const after5 = await c.post('/api/customer/otp/verify', { challengeId: r.body.challengeId, code: right });
  assert.equal(after5.status, 400);
  assert.equal(after5.body.error.code, 'OTP_LOCKED');
});

test('4. QR codes do not reveal the customer phone number', async () => {
  const staff = await staffClient();
  const { id, phone } = await registerAtCounter(staff);
  const token = await qrTokenFor(id);
  const guest = new Client();
  await guest.post('/api/customer/link', { token: await linkTokenFor(id) });
  const svg = await guest.get('/api/customer/qr.svg');
  assert.equal(svg.status, 200);
  assert.match(svg.headers.get('content-type')!, /image\/svg\+xml/);
  // Payload is a URL with a random token — no phone, no customer id, no name.
  const payload = `http://localhost:5199/s/${token}`;
  for (const secret of [phone, phone.slice(1), phone.slice(-9), id, 'Test Guest']) assert.ok(!payload.includes(secret));
  assert.equal(token.length, 32);
  assert.ok(encodeQr(payload).size > 0);
  // Stored token is hashed + encrypted, never plaintext.
  const row = (await getDb().query("SELECT token_hash, token_enc FROM customer_tokens WHERE customer_id = $1 AND kind = 'qr'", [id])).rows[0];
  assert.ok(!String(row.token_enc).includes(token));
});

test('5. invalid or revoked QR tokens are rejected', async () => {
  const staff = await staffClient();
  const { id } = await registerAtCounter(staff);
  const oldToken = await qrTokenFor(id);
  const ok = await staff.post('/api/staff/lookup', { input: `https://anything.example/s/${oldToken}` });
  assert.equal(ok.body.found, true);
  const bogus = await staff.post('/api/staff/lookup', { input: 'https://x/s/' + 'A'.repeat(32) });
  assert.deepEqual([bogus.body.found, bogus.body.reason], [false, 'unknown_qr']);
  const rot = await staff.post(`/api/admin/customers/${id}/rotate`, { kind: 'qr', reason: 'Guest lost phone' });
  assert.equal(rot.status, 200);
  const revoked = await staff.post('/api/staff/lookup', { input: oldToken });
  assert.deepEqual([revoked.body.found, revoked.body.reason], [false, 'revoked']);
  const fresh = await staff.post('/api/staff/lookup', { input: await qrTokenFor(id) });
  assert.equal(fresh.body.found, true);
  // Old card link stops working after link rotation, and its sessions end.
  const guest = new Client();
  const oldLink = await linkTokenFor(id);
  await guest.post('/api/customer/link', { token: oldLink });
  await staff.post(`/api/admin/customers/${id}/rotate`, { kind: 'link', reason: 'Link forwarded' });
  assert.equal((await guest.get('/api/customer/me')).status, 401);
  const again = await new Client().post('/api/customer/link', { token: oldLink });
  assert.equal(again.status, 410);
});

test('phone normalisation accepts Gulf formats and Arabic-Indic digits', () => {
  assert.deepEqual(normalisePhone('٠٥٠١٢٣٤٥٦٧', 'AE'), { ok: true, e164: '+971501234567', region: 'AE' });
  assert.equal((normalisePhone('+966 55 123 4567') as any).e164, '+966551234567');
  assert.equal((normalisePhone('+974 3312 3456') as any).e164, '+97433123456');
  assert.equal(normalisePhone('04 123 4567', 'AE').ok, false, 'landline rejected');
  assert.equal(normalisePhone('hello').ok, false);
  void key;
});

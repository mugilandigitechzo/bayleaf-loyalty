import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, stopServer, resetDatabase, staffClient, registerAtCounter, getDb, key, setClockOffset,
  visitDays, Client,
} from '../helpers.ts';

before(async () => { await resetDatabase(); await startServer(); });
after(stopServer);

const milestone = (state: any, m: number) => state.activeCard
  ? [state.activeCard, ...state.completedCards].flatMap((c: any) => c.milestones).find((x: any) => x.milestone === m && x.cardSequence === 1)
  : state.completedCards.flatMap((c: any) => c.milestones).find((x: any) => x.milestone === m && x.cardSequence === 1);

test('13–16. milestones unlock at 4, 8, 12 and 16; Card 1 completes at 16', async () => {
  const staff = await staffClient();
  const { id } = await registerAtCounter(staff);
  let last: any = await visitDays(staff, id, 3, 40);
  assert.equal(milestone(last.state, 4).status, 'locked');
  assert.equal(milestone(last.state, 4).inProgress, true);

  last = await visitDays(staff, id, 1, 37);
  assert.equal(last.visit.visitNumber, 4);
  assert.deepEqual(last.unlockedRewards.map((r: any) => r.milestone), [4]);
  assert.equal(milestone(last.state, 4).status, 'eligible');           // 13
  assert.equal(milestone(last.state, 8).inProgress, true);

  last = await visitDays(staff, id, 4, 36);
  assert.equal(last.visit.visitNumber, 8);
  assert.equal(milestone(last.state, 8).status, 'eligible');           // 14

  last = await visitDays(staff, id, 4, 30);
  assert.equal(last.visit.visitNumber, 12);
  const r12 = milestone(last.state, 12);
  assert.equal(r12.status, 'eligible');                                  // 15
  assert.equal(r12.name, 'Main course + side dish');

  last = await visitDays(staff, id, 3, 20);
  assert.equal(last.state.activeCard.visitCount, 15);
  assert.equal(last.state.activeCard.remaining, 1);
  assert.equal(last.cardCompleted, false);

  last = await visitDays(staff, id, 1, 2);
  assert.equal(last.visit.visitNumber, 16);
  assert.equal(last.cardCompleted, true);                                // 16
  assert.equal(last.unlockedRewards[0].milestone, 16);
  assert.equal(last.unlockedRewards[0].name, 'Main course, side dish + drink');
  assert.equal(last.state.completedCards[0].status, 'completed');
  assert.equal(last.state.completedCards[0].visitCount, 16);
});

test('17. eligibility never marks a reward as redeemed', async () => {
  const staff = await staffClient();
  const { id } = await registerAtCounter(staff);
  const last = await visitDays(staff, id, 12);
  const ms = last.state.activeCard.milestones;
  assert.deepEqual(ms.map((m: any) => m.status), ['eligible', 'eligible', 'eligible', 'locked']);
  assert.ok(ms.every((m: any) => m.redeemedAt === null));
  assert.equal(last.state.rewardsReady.length, 3);
  const n = (await getDb().query('SELECT count(*)::int AS n FROM reward_redemptions WHERE customer_id = $1', [id])).rows[0].n;
  assert.equal(n, 0);
});

test('18–19. a reward cannot be redeemed twice; failed attempts leave state intact', async () => {
  const staff = await staffClient();
  const { id } = await registerAtCounter(staff);
  const last = await visitDays(staff, id, 12);
  const r12 = milestone(last.state, 12);
  const r4 = milestone(last.state, 4);

  // Placeholder reward (visit 4) is earned but can't be handed over until Bay Leaf names it.
  const placeholder = await staff.post(`/api/staff/rewards/${r4.id}/redeem`, { idempotencyKey: key() });
  assert.equal(placeholder.body.error.code, 'REWARD_NOT_CONFIGURED');

  // Locked reward refused.
  const r16 = milestone(last.state, 16);
  const locked = await staff.post(`/api/staff/rewards/${r16.id}/redeem`, { idempotencyKey: key() });
  assert.equal(locked.body.error.code, 'NOT_YET_EARNED');

  // Concurrent redemption of the same reward with different keys: exactly one wins.
  const tries = await Promise.all(Array.from({ length: 6 }, () => staff.post(`/api/staff/rewards/${r12.id}/redeem`, { idempotencyKey: key() })));
  const wins = tries.filter((t) => t.status === 200);
  assert.equal(wins.length, 1);
  const losers = tries.filter((t) => t.status === 409);
  assert.ok(losers.every((t) => t.body.error.code === 'ALREADY_REDEEMED'));
  assert.ok(losers[0].body.error.details.reference, 'shows the earlier redemption');
  assert.ok(losers[0].body.error.details.staffName);
  const n = (await getDb().query('SELECT count(*)::int AS n FROM reward_redemptions WHERE customer_reward_id = $1', [r12.id])).rows[0].n;
  assert.equal(n, 1);

  // Retrying the winning request replays it instead of failing.
  const k = key();
  const other = milestone(last.state, 8);
  await staff.patch(`/api/admin/rewards/${(await getDb().query('SELECT reward_definition_id FROM customer_rewards WHERE id = $1', [other.id])).rows[0].reward_definition_id}`, { name: 'Arabic coffee & dates' });
  const a = await staff.post(`/api/staff/rewards/${other.id}/redeem`, { idempotencyKey: k });
  const b = await staff.post(`/api/staff/rewards/${other.id}/redeem`, { idempotencyKey: k });
  assert.equal(a.status, 200);
  assert.equal(b.body.replayed, true);
  assert.equal(a.body.redemption.reference, b.body.redemption.reference);

  // State after all the failures is consistent.
  const state = (await staff.get(`/api/staff/customers/${id}`)).body.state;
  assert.deepEqual(state.activeCard.milestones.map((m: any) => m.status), ['eligible', 'redeemed', 'redeemed', 'locked']);
  assert.equal(state.activeCard.visitCount, 12);
});

test('19b. an unavailable reward stays earned and can be redeemed once available again', async () => {
  const admin = await staffClient();
  const { id } = await registerAtCounter(admin);
  const last = await visitDays(admin, id, 12);
  const r12 = milestone(last.state, 12);
  const defId = (await getDb().query('SELECT reward_definition_id FROM customer_rewards WHERE id = $1', [r12.id])).rows[0].reward_definition_id;
  await admin.patch(`/api/admin/rewards/${defId}`, { isAvailable: false });
  assert.equal((await admin.post(`/api/staff/rewards/${r12.id}/redeem`, { idempotencyKey: key() })).body.error.code, 'REWARD_UNAVAILABLE');
  await admin.patch(`/api/admin/rewards/${defId}`, { isAvailable: true });
  assert.equal((await admin.post(`/api/staff/rewards/${r12.id}/redeem`, { idempotencyKey: key() })).status, 200);
});

test('20. historical redemptions stay visible after configuration changes', async () => {
  const admin = await staffClient();
  const { id } = await registerAtCounter(admin);
  const last = await visitDays(admin, id, 12);
  const r12 = milestone(last.state, 12);
  await admin.post(`/api/staff/rewards/${r12.id}/redeem`, { idempotencyKey: key() });
  const defId = (await getDb().query('SELECT reward_definition_id FROM customer_rewards WHERE id = $1', [r12.id])).rows[0].reward_definition_id;
  await admin.patch(`/api/admin/rewards/${defId}`, { name: 'Chef’s grill platter' });
  const profile = (await admin.get(`/api/admin/customers/${id}`)).body;
  assert.equal(profile.redemptions[0].rewardName, 'Main course + side dish', 'redeemed name is the one handed over');
  assert.equal(milestone(profile.state, 12).name, 'Main course + side dish');
  // Restore so later tests see the confirmed name.
  await admin.patch(`/api/admin/rewards/${defId}`, { name: 'Main course + side dish' });
  // Naming a placeholder reaches guests who already earned it.
  const r4def = (await getDb().query("SELECT id FROM reward_definitions WHERE milestone_visit = 4")).rows[0].id;
  await admin.patch(`/api/admin/rewards/${r4def}`, { name: 'Free dessert' });
  const st = (await admin.get(`/api/staff/customers/${id}`)).body.state;
  assert.equal(milestone(st, 4).name, 'Free dessert');
  assert.equal(milestone(st, 4).isPlaceholder, false);
  assert.equal((await admin.post(`/api/staff/rewards/${milestone(st, 4).id}/redeem`, { idempotencyKey: key() })).status, 200);
});

test('21–23. progress persists across month boundaries and long inactivity; nothing expires', async () => {
  const staff = await staffClient();
  const { id } = await registerAtCounter(staff);
  // Five visits in late January...
  setClockOffset(Date.parse('2027-01-27T12:00:00Z') - Date.now());
  for (let d = 0; d < 5; d++) {
    setClockOffset(Date.parse(`2027-01-${27 + d}T12:00:00Z`) - Date.now());
    assert.equal((await staff.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() })).status, 200);
  }
  // ...crossing into February: count continues.
  setClockOffset(Date.parse('2027-02-01T12:00:00Z') - Date.now());
  let r = await staff.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() });
  assert.equal(r.body.state.activeCard.visitCount, 6);
  // Eight months away (travel): still 6/16, same card, still active.
  setClockOffset(Date.parse('2027-10-15T12:00:00Z') - Date.now());
  const st = (await staff.get(`/api/staff/customers/${id}`)).body.state;
  assert.equal(st.activeCard.visitCount, 6);
  assert.equal(st.activeCard.sequence, 1);
  assert.equal(st.activeCard.status, 'active');
  r = await staff.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() });
  assert.equal(r.body.state.activeCard.visitCount, 7);
  setClockOffset(0);
  // The schema has no expiry columns at all.
  const cols = (await getDb().query("SELECT column_name FROM information_schema.columns WHERE table_name = 'customer_cards'")).rows.map((x: any) => x.column_name);
  assert.ok(!cols.some((c: string) => /expir|valid_until|end_date/.test(c)));
});

test('24, 27. a new month never unlocks the next card; missing Card 2 is a clear "coming soon" state', async () => {
  const staff = await staffClient();
  const { id } = await registerAtCounter(staff);
  await visitDays(staff, id, 10, 60);
  setClockOffset(Date.parse('2028-03-01T09:00:00Z') - Date.now());
  const st = (await staff.get(`/api/staff/customers/${id}`)).body.state;
  setClockOffset(0);
  assert.equal(st.activeCard.sequence, 1);
  assert.equal(st.completedCards.length, 0);
  assert.equal(st.nextCard.state, 'coming_soon', 'Card 2 not configured yet');
  assert.equal(st.nextCard.name, null, 'nothing fabricated');

  // Complete Card 1 with Card 2 still unconfigured.
  const done = await visitDays(staff, id, 6, 8);
  assert.equal(done.cardCompleted, true);
  assert.equal(done.nextCardActivated, null);
  assert.equal(done.state.activeCard, null);
  assert.equal(done.state.awaitingNextLevel, true);
  assert.equal(done.state.nextCard.state, 'coming_soon');
  assert.equal(done.state.rewardsReady.length, 4 - 0, 'all Card 1 rewards still available to redeem');
  const blocked = await staff.post(`/api/staff/customers/${id}/visits`, { idempotencyKey: key() });
  assert.equal(blocked.body.error.code, 'NO_ACTIVE_CARD');
});

test('25–26. Card 2 activates only on completion; completed cards and history are preserved', async () => {
  const admin = await staffClient();
  // A guest who finished Card 1 earlier is waiting for Card 2.
  const waiting = await registerAtCounter(admin, 'Waiting Guest');
  await visitDays(admin, waiting.id, 16, 100);
  const midway = await registerAtCounter(admin, 'Midway Guest');
  await visitDays(admin, midway.id, 9, 40);

  // Configure Card 2 (different target and rewards) and publish it.
  const c2 = await admin.post('/api/admin/cards', { name: 'Card 2', levelLabel: 'Gold', requiredVisits: 10, theme: 'midnight' });
  assert.equal(c2.status, 200);
  const early = await admin.post(`/api/admin/cards/${c2.body.id}/publish`);
  assert.equal(early.body.error.code, 'NO_REWARDS');
  await admin.post(`/api/admin/cards/${c2.body.id}/rewards`, { milestoneVisit: 5, name: 'Mixed grill for two' });
  await admin.post(`/api/admin/cards/${c2.body.id}/rewards`, { milestoneVisit: 10, name: 'Chef’s tasting menu' });
  const tooFar = await admin.post(`/api/admin/cards/${c2.body.id}/rewards`, { milestoneVisit: 11, name: 'x' });
  assert.equal(tooFar.status, 400);
  const pub = await admin.post(`/api/admin/cards/${c2.body.id}/publish`);
  assert.equal(pub.status, 200);
  assert.ok(pub.body.activatedFor >= 1, 'waiting guests move to Card 2 on publish');

  const w = (await admin.get(`/api/staff/customers/${waiting.id}`)).body.state;
  assert.equal(w.activeCard.sequence, 2);
  assert.equal(w.activeCard.requiredVisits, 10);
  assert.equal(w.activeCard.visitCount, 0, 'a fresh card, nothing carried over or fabricated');
  assert.equal(w.completedCards[0].sequence, 1);
  assert.equal(w.completedCards[0].visitCount, 16);

  // The midway guest stays on Card 1 even though Card 2 now exists.
  let m = (await admin.get(`/api/staff/customers/${midway.id}`)).body.state;
  assert.equal(m.activeCard.sequence, 1);
  assert.equal(m.activeCard.visitCount, 9);
  assert.equal(m.nextCard.state, 'locked');
  assert.equal(m.nextCard.name, 'Card 2');

  // Completing Card 1 activates Card 2 in the same confirmation.
  const fin = await visitDays(admin, midway.id, 7, 10);
  assert.equal(fin.cardCompleted, true);
  assert.deepEqual(fin.nextCardActivated, { name: 'Card 2', levelLabel: 'Gold' });
  m = fin.state;
  assert.equal(m.activeCard.sequence, 2);
  assert.equal(m.completedCards[0].visitCount, 16);
  const visits = (await getDb().query("SELECT count(*)::int AS n FROM visits WHERE customer_id = $1", [midway.id])).rows[0].n;
  assert.equal(visits, 16, 'every Card 1 visit kept');
  // Card 1 rewards remain redeemable after moving to Card 2.
  const r12 = m.rewardsReady.find((r: any) => r.cardSequence === 1 && r.milestone === 12);
  assert.equal((await admin.post(`/api/staff/rewards/${r12.id}/redeem`, { idempotencyKey: key() })).status, 200);
  // The published card with holders can't be pulled back.
  assert.equal((await admin.post(`/api/admin/cards/${c2.body.id}/unpublish`)).body.error.code, 'CARD_IN_USE');
  // Customer history shows both cards.
  const hist = await admin.get(`/api/admin/customers/${midway.id}/visits`);
  assert.ok(hist.body.items.some((v: any) => v.cardSequence === 1));
});

test('rule edits apply to future activations; guests already on a card keep their rules', async () => {
  const admin = await staffClient();
  const before = await registerAtCounter(admin, 'Before Change');
  await visitDays(admin, before.id, 2, 5);
  const card1 = (await admin.get('/api/admin/cards')).body.find((c: any) => c.sequence === 1);
  const low = await admin.patch(`/api/admin/cards/${card1.id}`, { requiredVisits: 10 });
  assert.equal(low.status, 400, 'cannot go below the highest milestone');
  await admin.patch(`/api/admin/cards/${card1.id}`, { requiredVisits: 20 });
  const after = await registerAtCounter(admin, 'After Change');
  const s1 = (await admin.get(`/api/staff/customers/${before.id}`)).body.state;
  const s2 = (await admin.get(`/api/staff/customers/${after.id}`)).body.state;
  assert.equal(s1.activeCard.requiredVisits, 16);
  assert.equal(s1.activeCard.visitCount, 2);
  assert.equal(s2.activeCard.requiredVisits, 20);
  await admin.patch(`/api/admin/cards/${card1.id}`, { requiredVisits: 16 });
});

test('customer sees progress, rewards and history after verifying', async () => {
  const admin = await staffClient();
  const { id, phone } = await registerAtCounter(admin, 'History Guest');
  await visitDays(admin, id, 5);
  const guest = new Client();
  const { lastTestOtp } = await import('../helpers.ts');
  const r = await guest.post('/api/customer/otp/request', { purpose: 'sign_in', phone });
  await guest.post('/api/customer/otp/verify', { challengeId: r.body.challengeId, code: lastTestOtp(phone) });
  const h = await guest.get('/api/customer/history');
  assert.equal(h.status, 200);
  assert.equal(h.body.visits.items.length, 5);
  assert.ok(!('staffName' in h.body.visits.items[0]), 'staff names are internal');
});

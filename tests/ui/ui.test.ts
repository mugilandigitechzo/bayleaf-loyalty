/// <reference lib="dom" />
import './env-ui.ts';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from 'playwright';
import { startServer, stopServer, resetDatabase, staffClient, registerAtCounter, visitDays, linkTokenFor, lastTestOtp, baseUrl, ADMIN_PASSWORD } from '../helpers.ts';

let browser: Browser;
before(async () => { await resetDatabase(); await startServer({ serveWeb: true }); browser = await chromium.launch(); });
after(async () => { await browser?.close(); await stopServer(); });

async function page(width: number, opts: { offline?: boolean } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: width < 700 });
  const p = await ctx.newPage();
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));
  // No internet in CI: let font requests fail fast instead of hanging.
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  return { p, ctx, errors };
}
const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test('28. a guest can register on a phone: name, mobile, code, card', async () => {
  const { p, ctx, errors } = await page(360);
  await p.goto(baseUrl + '/');
  await p.getByRole('button', { name: 'Get my loyalty card' }).click();
  await p.getByLabel('Your name').fill('Layla Hassan');
  await p.getByLabel('Mobile number').fill('052 555 0101');
  await p.getByRole('button', { name: 'Send my code' }).click();
  await p.getByLabel('6-digit code').waitFor();
  await p.getByLabel('6-digit code').fill(lastTestOtp('+971525550101')!); // auto-submits at 6 digits
  await p.getByRole('heading', { name: /Welcome to Bay Leaf, Layla/ }).waitFor();
  await p.getByRole('button', { name: 'Open my card' }).click();
  await p.getByRole('heading', { name: /Layla$/ }).waitFor();
  assert.match(await p.locator('.lcard').innerText(), /0\s+of 16 visits/);
  assert.equal(await overflow(p), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('29. the live card fits small phones with no horizontal scroll', async () => {
  const staff = await staffClient();
  const { id } = await registerAtCounter(staff, 'Sara Al Suwaidi');
  await visitDays(staff, id, 9);
  const token = await linkTokenFor(id);
  for (const w of [320, 360, 390, 430, 768, 1280]) {
    const { p, ctx, errors } = await page(w);
    await p.goto(baseUrl + '/c/' + token);
    await p.locator('.lcard').waitFor();
    assert.equal(await overflow(p), 0, `overflow at ${w}px`);
    assert.equal(await p.locator('.stamp').count(), 16);
    const qr = await p.locator('.qr-panel__code').boundingBox();
    assert.ok(qr && qr.width >= 120, `QR big enough at ${w}px (${qr?.width})`);
    const stamp = await p.locator('.stamp').first().boundingBox();
    assert.ok(stamp && stamp.width >= 24, `stamps legible at ${w}px (${stamp?.width})`);
    assert.match(await p.locator('.lcard').innerText(), /9\s+of 16 visits/);
    assert.ok(!p.url().includes(token), 'link token removed from the address bar');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('30. staff can find a guest manually when the camera is unavailable, and confirm a visit', async () => {
  const staff = await staffClient();
  const { phone } = await registerAtCounter(staff, 'Yousef Karim');
  const { p, ctx, errors } = await page(390);
  // Simulate a browser with no camera / no BarcodeDetector.
  await p.addInitScript(() => { delete (window as any).BarcodeDetector; Object.defineProperty(navigator, 'mediaDevices', { value: undefined }); });
  await p.goto(baseUrl + '/staff');
  await p.getByLabel('Username').fill('owner');
  await p.getByLabel('Password').fill(ADMIN_PASSWORD);
  await p.getByRole('button', { name: 'Sign in' }).click();
  await p.getByRole('button', { name: 'Scan guest’s code' }).click();
  await p.getByText(/can’t scan inside the app/).first().waitFor();
  await p.getByRole('button', { name: 'Find guest by phone or member code' }).click();
  await p.locator('#find').fill('0' + phone.slice(4));
  await p.getByRole('button', { name: 'Find' }).click();
  await p.getByRole('heading', { name: 'Yousef Karim' }).waitFor();
  await p.getByRole('button', { name: /Confirm visit/ }).click();
  await p.getByRole('heading', { name: 'Visit 1 recorded' }).waitFor();
  assert.equal(await overflow(p), 0);
  // Coming back to the same guest the same day explains why no second visit is possible.
  await p.getByRole('button', { name: 'Done' }).click();
  await p.locator('#find').fill(phone);
  await p.getByRole('button', { name: 'Find' }).click();
  await p.getByText(/Visit already recorded today/).waitFor();
  assert.equal(await p.getByRole('button', { name: /Confirm visit/ }).count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('31. a network failure shows clear feedback and a safe retry records the visit once', async () => {
  const staff = await staffClient();
  const { id, phone } = await registerAtCounter(staff, 'Retry Guest');
  const { p, ctx } = await page(820);
  await p.goto(baseUrl + '/staff');
  await p.getByLabel('Username').fill('owner');
  await p.getByLabel('Password').fill(ADMIN_PASSWORD);
  await p.getByRole('button', { name: 'Sign in' }).click();
  await p.locator('#find').fill(phone);
  await p.getByRole('button', { name: 'Find' }).click();
  await p.getByRole('heading', { name: 'Retry Guest' }).waitFor();
  // First attempt: the visit reaches the server, but the response is lost on the way back.
  let first = true;
  await p.route('**/api/staff/customers/*/visits', async (route) => {
    if (first) { first = false; await route.fetch(); await route.abort('connectionreset'); } else await route.continue();
  });
  await p.getByRole('button', { name: /Confirm visit/ }).click();
  await p.getByText(/safe to press Confirm again/).waitFor();
  await p.getByRole('button', { name: /Confirm visit/ }).click();
  await p.getByRole('heading', { name: 'Visit 1 recorded' }).waitFor();
  await p.getByText(/already saved — nothing was added twice/).waitFor();
  const state = (await staff.get(`/api/staff/customers/${id}`)).body.state;
  assert.equal(state.activeCard.visitCount, 1);
  await ctx.close();
});

test('31b. the customer card shows an offline notice', async () => {
  const staff = await staffClient();
  const { id } = await registerAtCounter(staff, 'Offline Guest');
  const { p, ctx } = await page(390);
  await p.goto(baseUrl + '/c/' + (await linkTokenFor(id)));
  await p.locator('.lcard').waitFor();
  await ctx.setOffline(true);
  await p.getByText(/You’re offline/).waitFor();
  await ctx.close();
});

test('admin portal pages load without errors on phone and desktop', async () => {
  for (const w of [390, 1280]) {
    const { p, ctx, errors } = await page(w);
    await p.goto(baseUrl + '/admin');
    await p.getByLabel('Username').fill('owner');
    await p.getByLabel('Password').fill(ADMIN_PASSWORD);
    await p.getByRole('button', { name: 'Sign in' }).click();
    await p.getByRole('navigation', { name: 'Admin' }).waitFor();
    for (const [path, heading] of [['/admin', 'Overview'], ['/admin/guests', 'Guests'], ['/admin/cards', 'Cards & rewards'], ['/admin/team', 'Team & outlets'], ['/admin/settings', 'Settings'], ['/admin/activity', 'Activity log']]) {
      await p.goto(baseUrl + path);
      await p.getByRole('heading', { name: heading, exact: true }).waitFor();
      await p.waitForTimeout(150);
      assert.equal(await overflow(p), 0, `${path} overflows at ${w}px`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

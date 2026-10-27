# Bay Leaf Digital Loyalty Platform

One backend, three experiences:

| Who | Where | What they do |
| --- | --- | --- |
| Guests | `/` (and the WhatsApp link `/c/…`) | See their live card, 16 stamps, rewards, personal QR code, history. Mobile browser, no app. |
| Counter staff | `/staff` | Scan or look up a guest, **Confirm visit**, redeem rewards, register new guests, send the card link on WhatsApp. |
| Managers | `/admin` | Live dashboard, guest search and corrections, card & reward setup (including Card 2+), team & outlets, settings, activity log. |

## Loyalty rules implemented

These follow the **"Latest Confirmed Rules"** section of `BayLeaf_Loyalty_Card_System_Updated_Concept_v2.docx`, which overrides the document's earlier one-month-validity concept:

- **Cards never expire.** No monthly reset, no inactivity deactivation. There is no expiry column, job or setting anywhere.
- **Card 1 = 16 confirmed visits**, milestones at 4, 8, 12 (main course + side dish) and 16 (main course + side dish + drink). Rewards 1 and 2 are placeholders until Bay Leaf names them in the admin portal.
- **The next card unlocks only when the current card is complete.** If Card 2 isn't published yet, the guest sees "Next level coming soon" and keeps every reward earned.
- **Earned ≠ redeemed.** Reaching a milestone makes a reward *eligible*; staff redeem it separately, once.
- **Scanning never adds a visit.** Staff press Confirm; the server checks the one-visit-per-day rule (configurable), duplicates and replays.

Business decisions made on Bay Leaf's behalf are listed in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Quick start (development)

Requirements: Node.js 22.12+, PostgreSQL 14+ (16 used in development).

```bash
npm install
createdb bayleaf                        # or use any empty database
cp .env.example .env                    # for local dev the defaults work; see comments
npm run seed                            # schema, Card 1, first outlet, first super admin (password printed once)
npm run seed -- --demo                  # optional: adds four "Demo Guest …" customers — never in production
npm run dev                             # builds the web app on change and runs the API on http://localhost:5173
```

In development, guest sign-in codes are printed to the server console (`[otp:console] …`).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development: web rebuild on change + API restart on change |
| `npm run build` | Production web bundle into `dist/web` + type-check |
| `npm start` | Production server (runs pending migrations on boot unless `MIGRATE_ON_START=false`) |
| `npm run migrate` | Apply database migrations |
| `npm run seed` | Idempotent first-run setup |
| `npm run create-admin -- <username> "<Full Name>"` | Recovery: create or reset a super admin from the server shell |
| `npm test` | API acceptance tests (needs a `bayleaf_test` database — see below) |
| `npm run test:ui` | Browser tests with Playwright/Chromium (run `npm run build:web` first) |

### Running the tests

Tests use a separate database and **drop and recreate its schema** on every run.

```bash
createdb bayleaf_test
# Optional: point at it explicitly (default postgres://bayleaf:bayleaf_dev@localhost:5432/bayleaf_test)
echo "DATABASE_URL=postgres://user:pass@localhost:5432/bayleaf_test" > .env.test
npm test
npm run build:web && npx playwright install chromium && npm run test:ui
```

## Project layout

```
server/
  db/            PostgreSQL client (pgwire.ts), pool, migrations, seed
  http/          Router, cookies, security headers, CSRF origin check, rate limiting, static files
  lib/           Tokens & encryption, Gulf phone normalisation, QR encoder, time
  services/      loyalty.ts (the engine), customers, auth, OTP, card config, admin, settings, audit
  routes/        customer.ts, staff.ts, admin.ts — every handler checks permissions server-side
shared/types.ts  API shapes used by server and web
web/src/
  customer/      Welcome, OTP sign-up/sign-in, card home, the LoyaltyCard component
  staff/         Counter, scanner, guest panel, redemption, registration
  admin/         Overview, Guests, Cards & rewards, Team, Settings, Activity log
  i18n/          en.ts (all guest & staff copy), ar.ts (empty until verified Arabic is supplied)
  styles/app.css Design tokens and components
tests/api        38 API acceptance tests (the brief's scenarios 1–27, 30–34 plus extras)
tests/ui         Browser tests (28–31, admin pages at phone and desktop widths)
docs/            DEPLOYMENT.md, DECISIONS.md
```

## Replacing the temporary wordmark

No Bay Leaf logo was supplied, so the app uses a temporary wordmark (a bay leaf + "Bay Leaf" set in Marcellus). Swap the `Wordmark` component in `web/src/ui/kit.tsx` and `web/public/favicon.svg` for the real assets; colours live as tokens at the top of `web/src/styles/app.css`.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for production setup, security checklist, backups and known limitations.

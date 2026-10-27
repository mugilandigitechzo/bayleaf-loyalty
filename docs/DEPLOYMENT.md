# Deployment

## Topology (MVP)

One Node.js process serving the API and the built web app, one PostgreSQL database, and a TLS-terminating reverse proxy in front. That's all Bay Leaf needs for one or several outlets.

```
Guests / staff phones ──HTTPS──> reverse proxy (TLS) ──> node server (port 5173) ──> PostgreSQL
```

> **Run a single app instance.** Rate limiting is in memory. To run more than one instance, move it to a shared store first (`server/http/framework.ts`, `rateLimit`). All loyalty correctness (locking, uniqueness) is in PostgreSQL and is already safe across instances.

## Environment variables

See `.env.example` for every variable with comments. Required in production:

| Variable | Notes |
| --- | --- |
| `APP_URL` | Public `https://` address. Used for card links, QR codes, and the CSRF origin check. |
| `DATABASE_URL` | `postgres://user:pass@host:5432/db` |
| `APP_ENCRYPTION_KEY` | `openssl rand -base64 32`. Encrypts QR / link tokens at rest. **Back it up.** |
| `APP_HASH_KEY` | `openssl rand -base64 32`. Keys all lookup hashes (tokens, sessions, codes). **Back it up.** |
| `OTP_PROVIDER` + `OTP_WEBHOOK_URL` + `OTP_WEBHOOK_TOKEN` | Guest sign-in codes. The server refuses to start in production with `console`. |

Never commit `.env`. Keys and the database password belong in the host's secret store.

## First deployment

```bash
npm install
npm run build
export NODE_ENV=production   # plus the variables above
npm run seed                 # creates schema, Card 1, first outlet, super admin; prints a one-time password
npm start
```

The database user needs permission to `CREATE EXTENSION pg_trgm` (trusted extension; the database owner can create it on PostgreSQL 13+). If not, have a superuser run `CREATE EXTENSION pg_trgm;` once before migrating.

With Docker: `docker compose up -d --build`, then `docker compose exec app node --import tsx server/db/seed.ts`. (The Dockerfile and compose file were written for a normal build environment and **were not built in the development sandbox**, which had no package-registry access.)

### Reverse proxy (Caddy example)

```
loyalty.bayleaf.example {
  reverse_proxy 127.0.0.1:5173
}
```
Set `TRUST_PROXY=true` so rate limits and the audit log see the real client IP. HTTPS is required in production: phone cameras for in-app scanning only work on secure origins.

## Guest sign-in codes (OTP)

`OTP_PROVIDER=webhook` sends `POST OTP_WEBHOOK_URL` with header `Authorization: Bearer OTP_WEBHOOK_TOKEN` and body:

```json
{ "to": "+971501234567", "code": "123456", "message": "Your Bay Leaf code is 123456. It expires in 10 minutes. Never share it." }
```

Respond with any 2xx once the provider accepted it. Write that small function for your provider (Unifonic, Twilio Verify, a WhatsApp Business Platform authentication template, …) — provider credentials stay in that function or in this server's environment, never in the browser. Codes: 6 digits, 10 minutes, 5 attempts, max 5 per number per hour, and per-IP limits.

## WhatsApp

The MVP uses WhatsApp click-to-chat links (`wa.me`): staff tap **Send card link on WhatsApp**, WhatsApp opens with the message ready, and staff press send. The app does not and cannot know whether the message was delivered, and says so. Automated sending would use the WhatsApp Business Platform with approved templates; the share message is configurable in Admin → Settings.

## Production security checklist

- [ ] `APP_URL` is `https://…`; HSTS is sent automatically in production.
- [ ] Unique random `APP_ENCRYPTION_KEY` and `APP_HASH_KEY`, stored in a secret manager and backed up separately from database backups.
- [ ] Real OTP provider configured and tested with a Gulf number.
- [ ] `DATABASE_SSL=require` (or `verify-full` with `DATABASE_SSL_CA_FILE`) unless the database is on the same host / private network.
- [ ] Database not reachable from the internet; app user is not a superuser.
- [ ] Seeded super admin password changed at first sign-in (enforced); each staff member has their own account.
- [ ] Only one app instance (see topology note) or a shared rate-limit store.
- [ ] `npm run seed -- --demo` never run against production.
- [ ] Reverse proxy access logs don't need to keep full URLs for `/s/…` and `/c/…` (they carry tokens); the app's own logs redact them.
- [ ] Privacy notice for guests published; data-retention policy decided.

What's already in place: server-side permission checks on every endpoint; scrypt password hashing with lockout after 5 failures; HMAC-hashed session tokens in HttpOnly SameSite cookies; same-origin JSON-only check on every state-changing request (CSRF); strict Content-Security-Policy, no framing, `nosniff`, `no-referrer`; parameterised SQL throughout; tokens 192-bit random, stored HMAC-hashed and AES-256-GCM encrypted; per-guest QR/link rotation; append-only audit table enforced by a database trigger; generic error messages to clients.

## Backups & recovery

- Daily `pg_dump --format=custom` (or managed point-in-time recovery), kept 30+ days, copied off-site. Test a restore quarterly.
- Back up `APP_ENCRYPTION_KEY` / `APP_HASH_KEY` separately. Without them, existing QR codes and card links can't be read or matched — progress and history survive, but every guest would need a new link (Admin → guest → Replace QR code / card link).
- Locked out of admin? `npm run create-admin -- owner "Owner Name"` from the server shell.

## Monitoring

`GET /api/health` returns 200 when the app can query the database. Errors are logged to stdout with `[error]`; ship stdout to your log platform and alert on 5xx rates.

## Known limitations

- **Dependencies were vendored by necessity.** The development sandbox had no npm registry access, so the app depends only on React, zod and tsx at runtime. The PostgreSQL client (`server/db/pgwire.ts`), HTTP router, QR encoder and phone validation were written in-repo. They're covered by the test suite (the QR encoder is verified by decoding its output with OpenCV), but **before production consider swapping in `pg` (node-postgres) and `libphonenumber-js`** — the `Db` interface and `normalisePhone` are the only touch points.
- `@types/react` wasn't available; `web/src/types/react-shim.d.ts` provides loose React typings. Delete it after `npm install @types/react @types/react-dom` and fix any newly reported type errors.
- In-app QR scanning needs `BarcodeDetector` (Chrome/Edge on Android, Samsung Internet). Elsewhere (e.g. iOS Safari) staff scan with the phone's camera app, which opens the counter screen, or use phone/member-code lookup. A USB/Bluetooth scanner typing into the search field also works. Real-device camera testing still needs to be done on Bay Leaf's counter devices.
- Fonts load from Google Fonts; self-host them for full offline/privacy control.
- No static downloadable card image (the brief lists it as optional); the live link is the card.
- Arabic is prepared (RTL, logical CSS, translation dictionary) but has no copy yet.
- No automated WhatsApp messaging (MVP uses click-to-chat).
- Passing these checks isn't a security audit or legal-compliance certification; a penetration test before launch is recommended.

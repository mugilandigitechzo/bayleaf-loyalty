# Decisions and open questions

## Conflict in the source document — resolved

The concept document describes, in sections 1–9, a **one-month validity window** per card, 4-visit example cards, and an expiry policy still to be chosen. Its final section, **"Latest Confirmed Rules"**, replaces that: cards do not expire, progress never resets by date, Card 1 is 16 visits with milestones 4/8/12/16, and Card 2 unlocks only on completion. Only the latest rules are implemented. Nothing in the code reads the calendar month; the test suite checks month boundaries and eight months of inactivity.

## Decisions made on Bay Leaf's behalf (reversible)

| # | Decision | Why | How to change |
| --- | --- | --- | --- |
| 1 | **Default phone country is UAE (+971).** Saudi, Qatar, Kuwait, Bahrain, Oman and India numbers are validated when typed with their country code; other countries accepted in full `+` form. | The brief says "Arab/Gulf market" without naming the country. | `DEFAULT_PHONE_REGION` env var. |
| 2 | **Restaurant time zone defaults to Asia/Dubai.** It decides when the "one visit per day" resets. | Follows decision 1. | Admin → Settings. |
| 3 | **The WhatsApp card link opens a limited view**: first name, card, stamps, rewards, QR. Visit and redemption history (and the full name) need the guest to confirm their number by text code. The phone number is never shown in link sessions. | The document wants a persistent live link on WhatsApp; the brief says knowing a phone number or holding a link must not expose private data. Links can be replaced per guest. | `limitForLink` in `server/routes/customer.ts`. |
| 4 | **The QR code contains a link to the staff counter** (`/s/<random token>`), not the guest's details. Staff can scan it in-app or with their phone's own camera app; a non-staff person who scans it only sees a staff sign-in page. | In-app scanning (BarcodeDetector) isn't available in every browser, notably iOS Safari. | `qrPayload` in `server/services/customers.ts`. |
| 5 | **Reward text edits apply to every guest who hasn't redeemed that reward yet.** Redeemed rewards keep the name they had when handed over. | Lets Bay Leaf name the visit-4 and visit-8 rewards later and have it reach guests who already earned them. | `server/services/cardConfig.ts`. |
| 6 | **Visit-target and milestone changes apply only to guests who start the card afterwards.** Guests already on a card keep the rules they started with. | Never rewrite progress or fabricate eligibility retroactively. | Same. |
| 7 | **Earned placeholder rewards can't be redeemed until named.** The guest sees "Unlocked · details soon"; staff see "Not set up yet". | Avoid staff handing over an undefined reward. | Name the reward in Admin → Cards & rewards. |
| 8 | **When every published card is complete, visits can't be recorded** until the next card is published; the guest sees "Next level coming soon". When Card 2 is published, waiting guests are moved onto it automatically. | Recording visits against no card would either be lost or would fabricate Card 2 progress. **Needs Bay Leaf approval** — the alternative is to bank visits and apply them to Card 2 when it's published. | `applyVisit` in `server/services/loyalty.ts`. |
| 9 | **Corrections:** managers can undo the *most recent* visit on the active card, or add a missed visit for a past date (daily rule still applies), both with a reason. Visits on completed cards are permanent, and a visit whose reward was already redeemed can't be undone. | Keeps history truthful and the engine simple. | Same file. |
| 10 | **Staff record visits against their outlet**; administrators without a fixed outlet choose one at sign-in. Guests have one identity across all outlets. | Outlet-level reporting with no duplicate guests. | Admin → Team & outlets. |
| 11 | **Self sign-up is on**, verified by text code. Staff can always register guests at the counter (no code needed, the guest is present). | Document journey is staff-led; the brief asks for a self-service flow. | Admin → Settings → "Let guests sign up on their own phone". |
| 12 | **Optional minimum bill amount** for a visit is supported but off by default. | The document mentions it as a possible visit condition. | Admin → Settings. |
| 13 | **Admin portal copy is English-only**; guest and staff copy is fully centralised for translation. | Admin users are internal; reduces translation scope. | Move admin strings into `web/src/i18n/en.ts` if needed. |

## Still needs Bay Leaf

- Names, descriptions and terms for the **visit 4 and visit 8 rewards**.
- **Card 2** (and later cards): visit target, rewards, design.
- Decision 8 above (what happens to visits after the last published card).
- An **SMS / WhatsApp OTP provider** account (see DEPLOYMENT.md).
- **Verified Arabic copy**, if Arabic should launch.
- The **real logo** and any brand guidelines that differ from the palette used.
- Card terms wording (a sensible default is seeded and editable).
- Privacy notice / data-retention policy for guest data under the applicable local law (e.g. UAE PDPL, Saudi PDPL). The platform stores name, mobile number and visit history only.

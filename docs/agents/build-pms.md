# Agent playbook: build a landlord PMS dashboard on the ApartX API

You are building a production-quality **PMS (property management system) dashboard
for a landlord** — properties, a month calendar of bookings and prices, price &
availability editing, booking management — as a **new standalone SvelteKit
project**, using the ApartX API and the apartx-ui component kit.

This document is a recipe, not a specification of the API. The API describes
itself (§Discovery); **the OpenAPI document is the source of truth for every
contract** — never hardcode a request/response shape from this file if the
spec disagrees. Where this playbook does state a shape, it is because the shape
was verified against a live server *and* the spec alone would mislead you
(§ARI semantics is the important case).

## Inputs

You receive these values from the operator; do not invent them:

| Parameter | Meaning | Example |
|---|---|---|
| `API_BASE` | ApartX server origin | `https://test-api.apartx.co` |
| `BRAND_NAME` | Dashboard name used in titles/header | `HostDesk` |

There is **no landlord-id parameter**: the signed-in user *is* the landlord, and
every `/Landlord/*` operation is already scoped to the properties they own or
co-administer.

The e2e suite signs in as the **seeded demo landlord** — phone `+77000000042`,
OTP `0000`. These are fixture constants of the demo environment (they must match
the server's demo seeder), so hardcode them in the spec; they are not operator
inputs. That landlord owns dedicated properties (`demo_e2e_*`) that carry no
fixture bookings, so your suite may freely create, edit and cancel bookings on
them.

Site locales: **`en` (default) + `ru`**, via i18next with local JSON bundles in
the site repo (see §i18n in Architecture).

## Ground rules

1. **Read `docs/consuming.md` in this kit first** and follow it exactly:
   vendor the kit as a git submodule, mirror its exports with Vite aliases,
   install its deps in your app root, wire Tailwind v4 + a static SSR theme
   palette, call `useSvelteKitNavigation()` once in the root layout.
2. **UI is built from kit components** (`apartx-ui/*`), not hand-rolled
   HTML+Tailwind. The one deliberate exception is the calendar grid (§Calendar),
   which has no kit primitive; everything inside it — dialogs, buttons, inputs —
   is still kit.
3. **SvelteKit SSR — a server runtime is mandatory.** Every page here sits
   behind authentication, so this is not about SEO: the auth architecture
   (token in an httpOnly cookie, API calls issued from server `load`s) cannot
   exist without a server. **`adapter-static` is therefore forbidden** — a
   static build silently downgrades the site to a client-only SPA and forces
   the token into client-readable storage. Default to `@sveltejs/adapter-node`;
   §Deployment lists when to swap it.
4. **TypeScript.** Generate API types from the OpenAPI document
   (e.g. `openapi-typescript`) instead of writing models by hand.
5. The generated project is **self-contained**: fresh clone + `npm install` +
   env vars + `npm run build` must work.

## Discovery (do this before writing code)

1. `GET {API_BASE}/api/llms.txt` — index of the API surface, grouped by domain,
   with links to per-domain markdown.
2. Read the `Landlord` and `User` domain docs it links to.
3. `GET {API_BASE}/api/openapi.json` — the machine-readable contract. Generate
   TS types from it. Named component schemas (e.g. `Booking`) are your models.
4. Interactive exploration: `{API_BASE}/api/swagger`.

## Architecture

- **HTTP client**: one thin typed wrapper around `fetch` for `{API_BASE}/api/*`.
  All GET inputs are query params; POST bodies are JSON.
- **Wire format — decode EJSON scalars in the wrapper.** Responses are
  EJSON-flavored JSON: dates arrive as `{"$date": 1789844400000}` (ms epoch)
  and money as `{"$type": "Decimal", "$value": "30000"}`; some endpoints return
  money as plain strings instead (`getPaymentInfo` returns `price`/`total` as
  strings but `deposit` as a Decimal object — both in the same payload). Your
  wrapper must normalize both forms (`$date` → `Date`, Decimal/string → a
  decimal string or number) before data reaches components — never let
  `{$type}` objects leak into rendering.
- **Auth**: HTTP requests authenticate with **Basic auth:
  `Authorization: Basic base64("${userId}:${token}")`** (see the OpenAPI
  `securitySchemes`). Obtain credentials via the OTP flow (§Auth flow), store
  `userId:token` in an **httpOnly cookie**, and attach the header in a
  SvelteKit server hook / server `load`s so the token never reaches client JS.
- **Config**: `API_BASE` and `BRAND_NAME` come from environment variables
  (SvelteKit `$env`).
- **i18n**: i18next initialized locally with `en`/`ru` JSON bundles committed
  to the repo; `en` is the default and fallback. Locale switcher in the
  header; kit components receive translated strings via their text props
  (the kit itself has no i18n).

## Pages → operations

| Page | Purpose | Operations (paths relative to `{API_BASE}/api`) |
|---|---|---|
| auth **Dialog** (no `/login` page) | Phone OTP sign-in in a kit `Dialog`, opened from the header and inline wherever auth is required | `POST /Auth/requestCode` → `POST /Auth/verifyCode` → `GET /Auth/me` |
| `/` | The landlord's properties: name, address, status; each links to its calendar | `GET /Landlord/Property/find` (returns `{ properties }`, **not** `{ items }`) |
| `/property/[id]` | **Month calendar** — prices, availability, restrictions and booking bars; range selection opens the ARI panel and "create booking" | `GET /Landlord/Property/getAvailabilityAndRestrictions`, `GET /Landlord/Booking/find?propertyId=…`, `POST /Landlord/Property/bulkUpdateARI`, `POST /Landlord/Booking/create` |
| `/bookings` | All bookings across properties: filter by property and status, paginated | `GET /Landlord/Booking/find` (returns `{ items, total }`) |
| `/bookings/[id]` | Booking detail: guest, dates, price, status + the actions in §Booking detail actions | `GET /Landlord/Booking/findOne` + the operations listed there |

Auth is a **dialog, not a route**: a dedicated login page throws the user out of
their context. The dialog holds both OTP steps (phone → code); on success it
closes and the interrupted flow continues with its state intact. A guarded
server route that requires auth redirects back to where the dialog can be
shown, never to a standalone login screen.

**Bookings list — the URL is the single source of truth.** `find` returns
`{ items, total }`; paginate with `limit`/`skip` and drive the current page
exclusively from the URL query (`?page=N`) in the server `load`. Render the
pager from `data` and navigate on page change (update the query via `goto`); do
NOT mirror the page into local component state (`$state` initialized from `data`
runs once — back/forward and new filters desync it). Changing a filter
(property, status) must reset `page` to 0.

Two traps that have actually shipped broken pagers — avoid both:

- **Implicit defaults die on the first page click.** If the page injects a
  default filter only when the URL has no params, then a page link carrying
  just `?page=1` no longer "has no params" — the default vanishes and page 2
  renders empty. Materialize the effective default into the URL instead.
- **Changing `page` must never drop the other filters**, and changing any
  filter must drop `page`.

Verify each operation's exact parameters against the OpenAPI spec during
discovery — the table above names the endpoints, it does not define their
contracts.

## Calendar (the heart of the PMS)

The property page is a **month grid** at `/property/[id]?month=YYYY-MM`.

- **The month lives in the URL only.** Back/forward and reload must keep the
  displayed month; the month switcher writes the query via `goto`, it does not
  hold the month in component state.
- **Each day cell** shows the price for that date, the remaining availability
  and restriction markers (min-stay, closed-to-arrival).
- **Bookings render as bars** across the days they span, coloured by status,
  each linking to `/bookings/[id]`.
- **Selecting a date range** (drag, or click start → click end) opens a side
  panel with two actions: edit ARI for the range (price, availability,
  min-stay, stop-sell) and create a booking for the range.
- After any ARI mutation, **re-fetch the calendar** and render what the server
  returned — never patch the grid optimistically from your own request (the
  server clamps values, see below).

`getAvailabilityAndRestrictions` takes `start`/`end` (`YYYY-MM-DD`) and returns
two maps keyed by **different ids**, which is easy to get wrong:

```json
{
  "availability": { "<roomTypeId>": { "2026-09-01": 1, "2026-09-02": 1 } },
  "restrictions": { "<ratePlanId>": { "2026-09-01": { "rate": 12000,
                                                      "min_stay_arrival": 1,
                                                      "min_stay_through": 1 } } }
}
```

Availability is per **room type**, restrictions are per **rate plan**, and the
restriction keys are snake_case (`min_stay_arrival`, `min_stay_through`) even
though the mutation below takes camelCase. An apartment has exactly one room
type and one rate plan; discover both from the property payload
(`GET /Property/getRoomTypesAndRooms` or the property document) rather than
constructing ids by hand.

## ARI semantics (read this before writing the price editor)

`POST /Landlord/Property/bulkUpdateARI` takes:

```json
{
  "items": [{ "propertyId": "…", "roomTypeId": "…", "ratePlanId": "…",
              "price": "13500",
              "restrictions": { "rate": true, "availability": 1,
                                "minLengthOfStay": 2, "closedToArrival": false } }],
  "startDate": "2026-09-10",
  "endDate": "2026-09-12",
  "daysOfWeek": ["mo", "tu"]
}
```

**The trap: the price is `item.price`, not `restrictions.rate`.** In
`restrictions`, `rate` is only an on/off flag saying "apply the rate from this
item"; the numeric value is read from `item.price`. The OpenAPI example shows
`restrictions: { rate: '30000' }`, and sending that returns `200 {"updated": 1}`
while **writing a rate of 0** for every date in the range — a silent price wipe.
Always send the number in `item.price` and keep `restrictions.rate` as the flag.

Other server-side behaviour your UI must respect rather than duplicate:

- availability is capped at the real room count minus overlapping bookings
  (overbooking protection), and `endDate` is capped to +2 years;
- the response is `{"updated": N, "errors": []}` — a per-item error list, not an
  exception. Surface non-empty `errors` to the user; `updated: 0` with an empty
  error list means your item matched nothing (usually a wrong roomType/ratePlan).

Because of all three, the calendar re-fetch after a mutation is the only honest
source of what actually got written.

## Booking statuses & lifecycle

- Statuses seen on the wire: `reserved`, `confirmed`, `cancelled`, `completed`.
  **There is no `paid` status** — payment state lives in transactions and
  `payment`, not in `status`.
- `POST /Landlord/Booking/create` returns a booking that is already
  `status: "reserved"` with `confirmed: true` when the landlord creates it
  themselves; calling `confirm` on it then fails with
  `404 errors.booking_already_confirmed`. Show the confirm action only when the
  booking actually needs confirming (an unconfirmed, tenant-originated booking),
  and treat that error as "already done", not as a crash.
- There is no status-history endpoint: render the current status, not a timeline.

## Booking detail actions

All take `bookingId`; shapes below were verified against a live server.

| Action | Operation | Input notes |
|---|---|---|
| Confirm | `POST /Landlord/Booking/confirm` | `{bookingId}` only |
| Cancel | `POST /Landlord/Booking/cancel` | `{bookingId, options: {cancelReason, cancelDescription}}` — **both option strings are required**; omitting `options` fails with a 500 `Match error`. Collect a reason in the confirmation dialog. |
| Complete | `POST /Landlord/Booking/complete` | `{bookingId}` |
| Move dates | `POST /Landlord/Booking/updateDates` | `{bookingId, dates: {startDate, endDate}}` — returns `null` on success; re-fetch the booking and the calendar |
| Change price | `POST /Landlord/Booking/updatePricing` | `{bookingId, total}` — `total` is a **number**, and it is a top-level field (there is no `pricing` object) |
| Guests | `POST /Landlord/Booking/adults` | `{bookingId, adults}` |
| Guest name | `POST /Landlord/Booking/setTenantName` | `{bookingId, firstName, lastName}` — separate fields, not `name` |
| Landlord note | `POST /Landlord/Booking/setNote` | `{bookingId, note}` |
| Payment summary | `GET /Landlord/Booking/getPaymentInfo` | returns `{count, units, price, subtotal, total, fee, currency, deposit}` |
| Transactions | `GET /Landlord/Booking/Transaction/find?bookingId=…` | returns `{items}`; amounts are Decimal objects |
| Record a payment | `POST /Landlord/Booking/addTransaction` | `{bookingId, fields: {direction, amount, account, comment}}` — **all four required**, `amount` is a **number** (a string fails with a 500 `Match error`), `direction` is e.g. `"in"` |
| Remove a transaction | `POST /Landlord/Booking/removeTransaction` | confirm before removing |
| Access: passcode | `POST /Landlord/Booking/getPasscode` | fails `400 errors.property_have_no_lock` when the property has no smart lock |
| Access: give / revoke key | `POST /Landlord/Booking/giveKey`, `…/revokeKey` | `{bookingId}` |

**Access without a lock is a normal state, not an error.** Demo and most
real properties have no smart lock attached, so `getPasscode` answers
`400 errors.property_have_no_lock`. The access block must then render a plain
"no lock connected" state — never an error toast, a spinner that never resolves,
or a broken panel. The e2e asserts exactly this state.

## Manual booking

`POST /Landlord/Booking/create` with `{propertyId, type: "normal", phoneNumber,
startDate, endDate, comment}`:

- **`type` is required** despite being optional in the spec — omitting it fails
  with a 500 `Match error: Missing key 'type'`. Use `"normal"` for ordinary stays.
- `phoneNumber` is the guest's; the server finds or creates that tenant account.
- `comment` is stored verbatim on the booking — this is the field the e2e uses
  to tag its own bookings.
- On success, redirect to the booking's **detail page**, not to the bare list.

## UX ground rules

- **Destructive / irreversible actions require confirmation.** Cancelling a
  booking, removing a transaction, revoking a key, logging out — anything the
  user can't undo goes through the kit's `ConfirmDialog`
  (`apartx-ui/overlays`), never a bare click → mutation. The cancel dialog must
  also collect the cancellation reason the API requires.
- **Predictable missing input is not an error page.** "Create booking" depends
  on a selected date range: when nothing is selected, keep the action disabled
  with an inline "select dates in the calendar" hint. Navigating to a booking
  form without a range must send the user back to the calendar with the picker
  highlighted — never a dead-end error screen for a state the UI itself allowed.

## Auth flow

1. `POST /Auth/requestCode` with `{ phone }` — note the field is **`phone`**,
   not `phoneNumber` (the booking operations use `phoneNumber`; they are
   different fields on different endpoints). The response carries `nextRetry`.
2. `POST /Auth/verifyCode` with `{ phone, code }` → returns
   `{ id, token, tokenExpires }`.
3. Store `id:token` server-side in an httpOnly cookie; from now on attach
   `Authorization: Basic base64(id + ":" + token)`. Base64 exactly
   `id:token` — a trailing newline (easy to introduce in shell helpers) yields
   a silent `401`.
4. `GET /Auth/me` validates the session and returns the user (use it in the
   root server `load` to hydrate "signed in as").
5. `POST /Auth/logout` destroys the token (call it with the Basic header, then
   drop the cookie).
6. **The OTP step must survive a page reload.** After `requestCode` succeeds,
   persist the phone and the "code sent" state (plus `nextRetry`) in
   `sessionStorage`; on reload, reopen the dialog at the code-entry step for
   that phone instead of the empty phone form. Never auto-resend on reload —
   offer a "resend" button gated by `nextRetry`.

## Acceptance criteria

The project is done when ALL of the following hold:

1. `npm run build` passes.
2. A **Playwright e2e spec** (in the site repo, run against the dev server)
   proves the full flow, signing in as the demo landlord (`+77000000042` /
   `0000`):
   - the properties page lists at least one property;
   - its calendar renders prices per day for the current month;
   - selecting a range and changing the price through the ARI panel updates the
     calendar after re-fetch (assert the new price on those days — this is the
     regression test for the `item.price` trap);
   - creating a manual booking for free dates succeeds; the booking appears as a
     bar in the calendar and as a row in `/bookings`;
   - opening its detail page, moving the dates (`updateDates`) shows the new
     range on the booking and in the calendar;
   - recording a payment shows the transaction in the booking's transaction list;
   - the access block shows the "no lock connected" state (demo properties have
     no lock);
   - cancelling through the `ConfirmDialog` (with a reason) flips the status to
     cancelled;
   - the bookings list paginates: page 2 changes the URL, shows different rows,
     and browser Back returns to page 1 with page-1 rows.
3. **The suite cleans up after itself.** Tag every booking it creates with
   `comment: "e2e"`, and on setup cancel all still-active (`reserved`/`new`)
   bookings of the demo landlord left over from earlier runs. Keep ARI edits to
   dates in a future month; the nightly demo reseed restores the base prices.
4. Both locales render: the e2e toggles `en` → `ru` and asserts a translated
   header string.
5. Month navigation: next month changes the URL, browser Back returns to the
   previous month.

Manual screenshots are not acceptance evidence; the spec is.

## Non-goals

Do not build: property onboarding (creating properties, photos, room types,
rate plans), a rooms × days chessboard timeline, statistics dashboards, staff
management, deposits, rent contracts, insurance, tenant verification, IC cards,
lock provisioning (issuing a key for an existing booking is in scope, attaching
and subscribing locks is not), iCal sync, chat, channel-manager configuration,
tenant-facing screens, native apps.

## Deployment

The dashboard owner is **not an IT person**: after the initial setup they must
never touch a terminal — updates ship by `git push` (the platform builds and
deploys), the custom domain is added through the platform's web UI, TLS is
automatic. Pick the target with the operator; all of them run the same codebase:

| Target | Adapter | Notes |
|---|---|---|
| **Cloudflare Pages** (default) | `@sveltejs/adapter-cloudflare` | Free tier allows commercial use; git-push deploys + preview per PR; custom domain = one screen in the CF dashboard, certs automatic. SSR runs on Workers — no Node built-ins in your own server code (this playbook's architecture already satisfies that: plain `fetch` only). **Required:** enable the `nodejs_compat` compatibility flag — SvelteKit itself uses `node:async_hooks`, without the flag the deploy warns and SSR can fail at runtime. Set it in `wrangler.toml` (`compatibility_flags = ["nodejs_compat"]`) so it applies to every deploy, or in the dashboard (Settings → Functions → Compatibility flags) for BOTH production and preview environments. |
| **Render** | `adapter-node` (unchanged) | A real Node server — zero runtime quirks; deploys from git or a Dockerfile. Free instances sleep (cold start ≈ 1 min) — use a paid instance for real use. |
| **Vercel / Netlify** | `adapter-auto` picks the right one | Smoothest DX; note Vercel's free (Hobby) tier prohibits commercial use — a real business dashboard needs the paid plan. |
| **Any VPS / Docker host** | `adapter-node` + Dockerfile | The escape hatch when the owner already rents a server. Ship a multi-stage Dockerfile (`node:22-alpine`: install → build → `node build`) so `docker run -e API_BASE=… -p 3000:3000 <image>` is the whole deploy. |

**Agent-driven deploys (CLI only, nothing interactive).** You can perform the
deploy yourself when the operator supplies a platform API token as an env var —
never run interactive `login` flows, never create accounts, never touch billing
(those are the owner's one-time manual steps):

- Cloudflare Pages: `CLOUDFLARE_API_TOKEN` + `wrangler pages project create` /
  `wrangler pages deploy` (direct upload — no git connection required); env
  vars and custom domains via the CF API with the same token.
- Vercel: `VERCEL_TOKEN` + `vercel deploy --prod`, `vercel env add`,
  `vercel domains add`.
- Netlify: `NETLIFY_AUTH_TOKEN` + `netlify deploy --prod`, `netlify env:set`.
- Render: service creation is dashboard/REST-API territory (`RENDER_API_KEY` +
  their HTTP API); prefer one of the above when the deploy must be fully
  agent-driven.

**Guide the owner through getting the token — do not just fail.** When you
reach the deploy stage and the platform token is missing, stop and walk the
owner through issuing one, in plain non-technical language: number the steps,
name the exact buttons, say what to copy and where to paste it. Then wait.
Token recipes per platform:

- **Cloudflare**: sign up / log in at `dash.cloudflare.com` → click the person
  icon (top right) → **My Profile → API Tokens → Create Token → Create Custom
  Token**: name it (e.g. `pms-deploy`), permission **Account → Cloudflare
  Pages → Edit** (add **Zone → DNS → Edit** only if the custom domain is on
  Cloudflare), set an expiry, **Continue → Create Token**, copy the token — it
  is shown only once. Also copy the **Account ID** (Dashboard → Workers &
  Pages → right-hand sidebar). You need both: `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`.
- **Vercel**: `vercel.com` → Settings → **Tokens** → Create: name, scope, expiry
  → copy as `VERCEL_TOKEN`.
- **Netlify**: `app.netlify.com` → User settings → **Applications → Personal
  access tokens → New access token** → copy as `NETLIFY_AUTH_TOKEN`.

Handling rules: the owner pastes the token once; put it straight into the
project's untracked `.env` (it must be gitignored) and never print, echo or
commit it. Before deploying, verify it non-interactively (`wrangler whoami`,
`vercel whoami --token …`, `netlify status`); if verification fails, explain
which step above likely went wrong instead of dumping raw CLI errors. After a
successful deploy, tell the owner the live URL and — in the same plain
language — what a custom domain requires (which DNS record to add and where).

Rules that apply to every target:

- `API_BASE` must point at a **publicly reachable** ApartX server (production
  or staging) — a `localhost` dev instance only works for local development.
- All configuration (`API_BASE`, `BRAND_NAME`) is set as platform environment
  variables — never hardcoded, so one repo serves any owner/brand.
- SSR must survive the deploy: after deploying, `curl` a page and assert the
  HTML is server-rendered (the sign-in shell, not an empty app skeleton) —
  this catches a silent fallback to static/SPA output.
- Document the chosen target in the README: exact "connect repo → set env vars
  → add custom domain" steps a non-technical owner can follow.

## Delivery checklist

- README with: env vars table, how to run dev, how to run e2e, and the
  §Deployment steps for the chosen target.
- `.env.example` with every variable named above.
- CI-friendly scripts: `dev`, `build`, `preview`, `test:e2e`.
- Dockerfile (when the VPS/Docker or Render-via-Docker target is chosen).

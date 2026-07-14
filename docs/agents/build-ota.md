# Agent playbook: build an OTA booking site on the ApartX API

You are building a production-quality **OTA (online travel agency) website** —
search, property pages, booking, payment — as a **new standalone SvelteKit
project**, using the ApartX public API and the apartx-ui component kit.

This document is a recipe, not a specification of the API. The API describes
itself (§Discovery); **the OpenAPI document is the source of truth for every
contract** — never hardcode a request/response shape from this file if the
spec disagrees.

## Inputs

You receive these values from the operator; do not invent them:

| Parameter | Meaning | Example |
|---|---|---|
| `API_BASE` | ApartX server origin | `https://test-api.apartx.co` |
| `LANDLORD_USER_ID` | *(optional)* If set, the whole site shows only this landlord's properties | `aBcUser12345678` |
| `BRAND_NAME` | Site name used in titles/header | `StayFinder` |
| `TEST_TENANT_PHONE` | Demo tenant phone for e2e login | `+77000000001` |
| `TEST_OTP_CODE` | Master OTP accepted for that phone in dev/test | `0000` |

Site locales: **`en` (default) + `ru`**, via i18next with local JSON bundles in
the site repo (see §i18n).

## Ground rules

1. **Read `docs/consuming.md` in this kit first** and follow it exactly:
   vendor the kit as a git submodule, mirror its exports with Vite aliases,
   install its deps in your app root, wire Tailwind v4 + a static SSR theme
   palette, call `useSvelteKitNavigation()` once in the root layout.
2. **UI is built from kit components** (`apartx-ui/*`), not hand-rolled
   HTML+Tailwind. Reach for raw markup only when the kit demonstrably has no
   primitive for the job (page-level layout grids are fine).
3. **SvelteKit SSR — a server runtime is mandatory.** Search and property pages
   must render on the server (they are the SEO surface), and the auth
   architecture (token in an httpOnly cookie, API calls proxied through server
   `load`s) cannot exist without one. **`adapter-static` is therefore
   forbidden** — a static build silently downgrades the site to a client-only
   SPA and breaks both SEO and auth. Default to `@sveltejs/adapter-node`;
   §Deployment lists when to swap it.
4. **TypeScript.** Generate API types from the OpenAPI document
   (e.g. `openapi-typescript`) instead of writing models by hand.
5. The generated project is **self-contained**: fresh clone + `npm install` +
   env vars + `npm run build` must work.

## Discovery (do this before writing code)

1. `GET {API_BASE}/api/llms.txt` — index of the API surface, grouped by domain,
   with links to per-domain markdown.
2. Read the `Tenant` and `User` domain docs it links to.
3. `GET {API_BASE}/api/openapi.json` — the machine-readable contract. Generate
   TS types from it. Named component schemas (e.g. `Booking`) are your models.
4. Interactive exploration: `{API_BASE}/api/swagger`.

## Architecture

- **HTTP client**: one thin typed wrapper around `fetch` for `{API_BASE}/api/*`.
  All GET inputs are query params; POST bodies are JSON.
- **Wire format — decode EJSON scalars in the wrapper.** Responses are
  EJSON-flavored JSON: dates arrive as `{"$date": 1785697200000}` (ms epoch)
  and money as `{"$type": "Decimal", "$value": "13000"}`; a few endpoints
  return money as plain strings instead (e.g. `getPaymentInfo.price`). Your
  HTTP wrapper must normalize both forms (`$date` → `Date`, Decimal/string →
  a decimal string or number) before data reaches components — do not let
  `{$type}` objects leak into rendering.
- **Auth**: HTTP requests authenticate with **Basic auth:
  `Authorization: Basic base64("${userId}:${token}")`** (see the OpenAPI
  `securitySchemes`). Obtain credentials via the OTP flow (§Auth flow), store
  `userId:token` in an **httpOnly cookie**, and attach the header in a
  SvelteKit server hook / server `load`s so the token never reaches client JS.
- **Config**: `API_BASE`, `LANDLORD_USER_ID`, `BRAND_NAME` come from
  environment variables (SvelteKit `$env`). When `LANDLORD_USER_ID` is set,
  pass it as `landlordUserId` to every search call — nothing else changes.
- **i18n**: i18next initialized locally with `en`/`ru` JSON bundles committed
  to the repo; `en` is the default and fallback. Locale switcher in the
  header; kit components receive translated strings via their text props
  (the kit itself has no i18n).

## Pages → operations

| Page | Purpose | Operations (paths relative to `{API_BASE}/api`) |
|---|---|---|
| `/` | Search: free-text city/geo, dates, guests; result cards; pagination | `GET /Tenant/Property/findByFilter` (public) |
| `/property/[id]` | Gallery, description, amenities, price for selected dates | `GET /Property/findById` (public; accepts `startDate`/`endDate` for date-aware pricing) |
| `/property/[id]` (authed extra) | Availability calendar | `GET /Tenant/Property/getAvailability` (**auth required** — render the calendar only for logged-in users; anonymous visitors see prices from `findById`. Do not call it anonymously: you'll get 401.) |
| `/login` (or modal) | Phone OTP sign-in | `POST /Auth/requestCode` → `POST /Auth/verifyCode` → `GET /Auth/me` |
| `/booking/[propertyId]` | Confirm dates/guests, create booking, go to payment | `POST /Tenant/Booking/create` → `POST /Tenant/Booking/getPaymentUrl` |
| `/account/bookings` | The guest's bookings: status, payment link, cancel | `GET /Tenant/Booking/find`, `POST /Tenant/Booking/cancel` |
| `/account/bookings/[id]` | Booking detail: property summary + dates, booking number, status, price breakdown, pay / cancel actions | `GET /Tenant/Booking/find` (locate by id), `GET /Tenant/Booking/getPaymentInfo`, `GET /Property/findById` |

Every row in `/account/bookings` links to its detail page — a list alone is not
enough: the confirmation redirect after creating a booking should land on the
booking's detail page, not on the bare list.

**Search pagination — the URL is the single source of truth.** `findByFilter`
returns `{ properties, total }`; paginate with `limit`/`skip` and drive the
current page exclusively from the URL query (`?page=N`) in the server `load`.
Render the pager from `data` and navigate on page change (update the query via
`goto`); do NOT mirror the page into local component state (`$state` initialized
from `data` runs once — back/forward and new searches desync it). Submitting a
new search (changed city/dates/guests) must reset `page` to 0.

Two traps that have actually shipped broken pagers — avoid both:

- **Implicit defaults die on the first page click.** If the landing page
  injects a default query (e.g. a default city) only when the URL has no
  params, then a page link carrying just `?page=1` no longer "has no params" —
  the default vanishes and page 2 renders empty. Whatever default the landing
  applies must be materialized into the URL (redirect `/` → `/?q=<default>`,
  or have the pager write the full effective query, not only `page`).
- **Changing `page` must never drop the other filters**, and changing any
  filter must drop `page`.

Acceptance for the pager (goes into the e2e): from the landing page click
page 2 → the URL updates, result count is > 0 and the first card differs from
page 1; browser Back returns to page 1 with page-1 cards.

Verify each operation's exact parameters against the OpenAPI spec during
discovery — the table above names the endpoints, it does not define their
contracts.

## UX ground rules

- **Destructive / irreversible actions require confirmation.** Cancelling a
  booking, logging out — anything the user can't undo goes through the kit's
  `ConfirmDialog` (`apartx-ui/overlays`), never a bare click → mutation.
- **Predictable missing input is not an error page.** The property page's
  "Book" CTA depends on selected dates: carry the dates from the search
  context into the property page (and on into `/booking/...`); when they are
  absent, prefill the date picker with the nearest available range from the
  property's availability/pricing data, or keep the CTA disabled with an
  inline "select your dates" hint next to the picker. Navigating to the
  booking page without dates must redirect back to the property page with the
  picker highlighted — the user must never see a dead-end error screen for a
  state the UI itself allowed.

## Auth flow

1. `POST /Auth/requestCode` with the phone number → server sends an OTP.
2. `POST /Auth/verifyCode` with phone + code → returns
   `{ id, token, tokenExpires }`.
3. Store `id:token` server-side in an httpOnly cookie; from now on attach
   `Authorization: Basic base64(id + ":" + token)`.
4. `GET /Auth/me` validates the session and returns the user (use it in the
   root server `load` to hydrate "logged in as").
5. `POST /Auth/logout` destroys the token (it is HTTP-only; call it with the
   Basic header, then drop the cookie).
6. **The OTP step must survive a page reload.** After `requestCode` succeeds,
   persist the phone number and the "code sent" state (plus the `nextRetry`
   timestamp from the response) in `sessionStorage`; on reload, restore the
   code-entry screen for that phone instead of showing the empty phone form.
   Never auto-resend the code on reload — offer a "resend" button gated by
   `nextRetry`.

## Booking & payment

1. `POST /Tenant/Booking/create` with `propertyId`, `startDate`, `endDate`
   (plus `roomTypeId`/`ratePlanId`/`roomId` when the property has room types —
   discover from the property payload) → returns the booking document.
2. `POST /Tenant/Booking/getPaymentUrl` with the booking id → returns the
   payment provider's **native response object** (not a normalized wrapper);
   the redirect URL lives at `Model.Url` and `Success: true` signals the order
   was created. Redirect the user to that URL.
3. **Online payment is per-property.** `getPaymentUrl` returns
   `403 errors.online_payment_disabled` unless the property was created with
   online payment enabled (visible in the public payload as
   `defaults.withOnlinePayment: true`), and `403 errors.booking_not_verified`
   for a self-created booking on a property without auto-confirmation
   (`defaults.autoConfirmationEnabled`). Handle both 403s gracefully in the UI:
   show a "pay on arrival / contact the host" state instead of a payment
   button — never render the booking flow as broken.
4. In dev/test, **do not follow the payment redirect** in automation — the
   acceptance bar is that the URL is obtained (see below). After payment the
   booking appears with its updated status in `GET /Tenant/Booking/find`.

## Acceptance criteria

The project is done when ALL of the following hold:

1. `npm run build` passes.
2. A **Playwright e2e spec** (in the site repo, run against the dev server)
   proves the full flow. Note: the server rejects a booking when the tenant
   already has more than a handful of active (`new`/`reserved`) bookings
   (`errors.too_many_active_bookings`). Tag bookings the spec creates (e.g.
   `comment: "e2e"`) and start the spec by cancelling leftover active bookings
   with that tag from previous runs — never assume a fresh tenant.
   - anonymous visitor searches (city + dates + guests) and sees > 0 results;
   - opens a property page, sees gallery/price;
   - signs in with `TEST_TENANT_PHONE` + `TEST_OTP_CODE`;
   - creates a booking for available dates;
   - obtains a payment URL (assert it is a well-formed absolute URL — do not
     navigate to it). Run this step against a property whose payload shows
     `defaults.withOnlinePayment: true` (filter search results for it); if the
     environment has none, the spec must instead assert the graceful
     "payment unavailable" state for the 403;
   - sees the booking listed in `/account/bookings` and opens its detail page;
   - cancels the booking via the confirmation dialog (asserts the dialog
     appears and the status changes to cancelled);
   - paginates the search results (see the pager acceptance in §Pages).
3. If `LANDLORD_USER_ID` is set: an e2e check that every search result belongs
   to that landlord (compare against the property payload's owner field).
4. Both locales render: the e2e toggles `en` → `ru` and asserts a translated
   header string.

Manual screenshots are not acceptance evidence; the spec is.

## Non-goals

Do not build: real payment completion, favorites, chat/messaging, reviews,
server-side translation loading, landlord/admin functionality, native apps.

## Deployment

The site owner is **not an IT person**: after the initial setup they must never
touch a terminal — updates ship by `git push` (the platform builds and deploys),
the custom domain is added through the platform's web UI, TLS is automatic.
Pick the target with the operator; all of them run the same codebase:

| Target | Adapter | Notes |
|---|---|---|
| **Cloudflare Pages** (default) | `@sveltejs/adapter-cloudflare` | Free tier allows commercial use; git-push deploys + preview per PR; custom domain = one screen in the CF dashboard, certs automatic. SSR runs on Workers — no Node built-ins in server code (this playbook's architecture already satisfies that: plain `fetch` only). |
| **Render** | `adapter-node` (unchanged) | A real Node server — zero runtime quirks; deploys from git or a Dockerfile. Free instances sleep (cold start ≈ 1 min) — use a paid instance for a public site. |
| **Vercel / Netlify** | `adapter-auto` picks the right one | Smoothest DX; note Vercel's free (Hobby) tier prohibits commercial use — a real OTA needs the paid plan. |
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
  Token**: name it (e.g. `ota-deploy`), permission **Account → Cloudflare
  Pages → Edit** (add **Zone → DNS → Edit** only if the custom domain is on
  Cloudflare), set an expiry, **Continue → Create Token**, copy the token —
  it is shown only once. Also copy the **Account ID** (Dashboard → Workers &
  Pages → right-hand sidebar). You need both: `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`.
- **Vercel**: `vercel.com` → Settings → **Tokens** → Create: name, scope
  (the personal account or team), expiry → copy as `VERCEL_TOKEN`.
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
- All configuration (`API_BASE`, `LANDLORD_USER_ID`, `BRAND_NAME`) is set as
  platform environment variables — never hardcoded, so one repo serves any
  owner/brand.
- SSR must survive the deploy: after deploying, `curl` the search page and
  assert the HTML contains rendered property cards (not an empty app shell) —
  this catches a silent fallback to static/SPA output.
- Document the chosen target in the README: exact "connect repo → set env vars
  → add custom domain" steps a non-technical owner can follow.

## Delivery checklist

- README with: env vars table, how to run dev, how to run e2e, and the
  §Deployment steps for the chosen target.
- `.env.example` with every variable named above.
- CI-friendly scripts: `dev`, `build`, `preview`, `test:e2e`.
- Dockerfile (when the VPS/Docker or Render-via-Docker target is chosen).

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
3. **SvelteKit SSR with `@sveltejs/adapter-node`.** Search and property pages
   must render on the server (they are the SEO surface). Authenticated screens
   may load client-side.
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

Verify each operation's exact parameters against the OpenAPI spec during
discovery — the table above names the endpoints, it does not define their
contracts.

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

## Booking & payment

1. `POST /Tenant/Booking/create` with `propertyId`, `startDate`, `endDate`
   (plus `roomTypeId`/`ratePlanId`/`roomId` when the property has room types —
   discover from the property payload) → returns the booking document.
2. `POST /Tenant/Booking/getPaymentUrl` with the booking id → returns a
   payment-provider URL. Redirect the user to it.
3. In dev/test, **do not follow the payment redirect** in automation — the
   acceptance bar is that the URL is obtained (see below). After payment the
   booking appears with its updated status in `GET /Tenant/Booking/find`.

## Acceptance criteria

The project is done when ALL of the following hold:

1. `npm run build` passes.
2. A **Playwright e2e spec** (in the site repo, run against the dev server)
   proves the full flow:
   - anonymous visitor searches (city + dates + guests) and sees > 0 results;
   - opens a property page, sees gallery/price;
   - signs in with `TEST_TENANT_PHONE` + `TEST_OTP_CODE`;
   - creates a booking for available dates;
   - obtains a payment URL (assert it is a well-formed absolute URL — do not
     navigate to it);
   - sees the booking listed in `/account/bookings`.
3. If `LANDLORD_USER_ID` is set: an e2e check that every search result belongs
   to that landlord (compare against the property payload's owner field).
4. Both locales render: the e2e toggles `en` → `ru` and asserts a translated
   header string.

Manual screenshots are not acceptance evidence; the spec is.

## Non-goals

Do not build: real payment completion, favorites, chat/messaging, reviews,
server-side translation loading, landlord/admin functionality, native apps.

## Delivery checklist

- README with: env vars table, how to run dev, how to run e2e.
- `.env.example` with every variable named above.
- CI-friendly scripts: `dev`, `build`, `preview`, `test:e2e`.

# Agent playbooks

This directory contains **agent playbooks**: self-contained recipes an AI agent
(Claude Code or similar) follows to build a complete, production-quality product
on top of the ApartX public API and this UI kit — with zero prior knowledge of
either. Each playbook pairs with the API's self-description
(`{API_BASE}/api/llms.txt`, `{API_BASE}/api/openapi.json`) and with
[`docs/consuming.md`](../consuming.md) (how to wire the kit into a SvelteKit
consumer). The playbook defines the product; the API describes its own
contracts; the agent writes the code.

## Catalog

| Playbook | Product | Status |
|---|---|---|
| [`build-ota.md`](build-ota.md) | OTA booking site: search → property page → OTP sign-in → booking → payment; whole-market or single-landlord mode | Piloted |

Planned next (same pattern): `build-pms.md` — property-management dashboard for
a landlord (calendar, bookings, pricing) on the Landlord API surface.

## How to run a playbook

You are the **operator**. The agent gets ONLY the launch prompt below and the
playbook — do not explain the API or the kit to it in chat.

1. **Prepare the environment**: a reachable ApartX server (`API_BASE`) with
   demo data seeded, and the playbook's Inputs (test tenant phone + OTP code,
   brand name, optional `LANDLORD_USER_ID`).
2. **Launch** a fresh agent session with the prompt template below, filled in.
3. **Iterate through the playbook, not through chat.** When the agent stumbles
   or ships something wrong, do NOT coach it verbally — fix the playbook (or
   `consuming.md`), push, and tell the agent to re-read it and reconcile. Every
   stumble a future agent could repeat belongs in the document.
4. **Acceptance** is defined inside each playbook — typically a green build
   plus a green Playwright e2e run the agent shows you.

## Launch prompt template

```
You are building a production-quality {PRODUCT — e.g. OTA booking website}
as a NEW standalone SvelteKit project.

## Setup

1. Create an empty directory `{PROJECT_DIR}` (outside any existing repo) and `git init` it.
2. Add the UI kit as a git submodule: `{APARTX_UI_GIT_URL}`.
3. From the submodule, read in this order:
   - `docs/consuming.md` — how to wire the kit into a SvelteKit consumer;
   - `docs/agents/{PLAYBOOK}.md` — **your specification. Follow it exactly.**

The API describes itself — `{API_BASE}/api/llms.txt` and `{API_BASE}/api/openapi.json`
are the source of truth for every contract. Never invent request/response shapes.

## Inputs (per playbook §Inputs)

| Parameter | Value |
|---|---|
| `API_BASE` | `{API_BASE}` |
| `LANDLORD_USER_ID` | {value or "(unset — the site shows all properties)"} |
| `BRAND_NAME` | `{BRAND_NAME}` |
| `TEST_TENANT_PHONE` | `{TEST_TENANT_PHONE}` |
| `TEST_OTP_CODE` | `{TEST_OTP_CODE}` |

## Operational rules

- Work ONLY inside `{PROJECT_DIR}`. Do not push anywhere unless told to; do not
  read or modify any other repository on this machine.
- `API_BASE` is a shared environment. Create bookings only as the test tenant,
  tag them (`comment: "e2e"`) and cancel them in cleanup, as the playbook says.
- Done = the playbook's §Acceptance criteria, verified by you: the build passes
  and the Playwright e2e suite is green (run it headless and show the output).
```

Operator notes for the template:

- `TEST_TENANT_PHONE` should be a **dedicated e2e tenant** the demo seeder
  never assigns fixture bookings to (ApartX seeds `demo_tenant_e2e` /
  `+77000000041`, demo OTP `0000`) — shared demo tenants run into the
  active-booking limit. Instruct the e2e to cancel ALL of that tenant's active
  bookings on setup: leftovers from previous runs are its own.
- For the payment step the environment needs at least one property with
  `defaults.withOnlinePayment: true` (and `autoConfirmationEnabled`) — without
  it the e2e can only assert the playbook's graceful "payment unavailable" path.
- Deployment (incl. how the owner issues a platform token) is part of each
  playbook's §Deployment — the agent handles it; you only supply the token.

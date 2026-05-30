# CLAUDE.md — apartx-ui

Per-project guidance for the ApartX Svelte 5 UI Kit. See the workspace root
`CLAUDE.md` for cross-project rules.

## What this is

A **source-based** Svelte 5 component library (themeable design system, Tailwind v4),
extracted from `apartx-admin` so it can be shared across ApartX front-ends.
There is **no build step**: consumers compile the raw `.svelte`/`.ts` sources
through their own bundler. `package.json` `exports` point straight at
`src/lib/**`. A SvelteKit demo lives in `src/routes`.

## Commands

```bash
npm run dev      # demo playground (Vite)
npm run build    # production build — the real compile gate (must pass)
npm run check    # svelte-check
```

`npm run build` is the meaningful correctness gate: it compiles every component
through `vite-plugin-svelte`. `svelte-check` currently reports type-only noise
because most components are untyped JS (`<script>` without `lang="ts"`) and
their optional props (`class`, event handlers) infer as *required*. These are
runtime-safe and inherited from admin verbatim; tighten them only deliberately,
not as a side effect of other work.

## Conventions

- **Components are byte-faithful to the admin originals.** This kit is the
  single source of truth. Do not casually refactor inherited components — it
  diverges the shared API and risks behaviour changes across consumers.
- **No app coupling.** Never import `meteor/*`, an i18n wrapper, or app routing
  into `src/lib`. `rg "meteor/|i18next|/imports/" src/lib` must stay empty.
- **All user-facing text is a prop with an English default** so consumers
  translate at the call site.
- **`<Link>` is router-agnostic** — it uses an injected navigator
  (`setLinkNavigate` context or `navigate` prop) and falls back to native
  `<a href>`. Never re-add a hard router dependency.
- **Barrels:** every category has an `index.ts`; the root `src/lib/index.ts`
  re-exports all categories. Keep new components exported from both.
- **Internal imports:** `cn` from `'../utils/cn'`; cross-category components by
  relative `.svelte` path (e.g. `'../display/Icon.svelte'`).
- `bits-ui`, `svelte`, `svelte-fa` are peer deps — never bump independently of
  consumers; a duplicate `bits-ui` breaks overlay context.

## Versioning

Consumers pin to a commit via submodule. Use `main` for active development;
tag stable releases so `apartx-admin`/`apartx-cabinet`/`apartx-spaces` don't
drift apart.

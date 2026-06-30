# Lightbox component — design

Date: 2026-06-30
Repo: apartx-ui (Svelte 5 UI Kit) — github apartx-ltd/apartx-ui

## Goal

Add a reusable image **Lightbox** to the kit so all consumers (verification,
chat attachments, property photos, …) share one styled, accessible image viewer
instead of each wiring `viewerjs` by hand.

## Scope

**This task: the kit component only — no consumer migration.** The cabinet
check-in modal (`CheckinDetailsModal.svelte`) currently wires `viewerjs` by hand;
migrating it onto this component is deferred to a separate follow-up change and is
explicitly out of scope here. The component is designed to support that future
migration (see "Future consumer migration" below), but nothing in the cabinet is
touched now.

## Approach decision — wrap viewerjs (not build-native)

**Chosen: wrap `viewerjs`.** The `Lightbox` component is a thin Svelte 5 wrapper
around `viewerjs`; zoom / pan / rotate / keyboard navigation come for free.
Building a native Dialog + pointer-based viewer would mean reimplementing
pinch/zoom/rotate/swipe — a likely functional regression — for no real benefit
here. `viewerjs ^1.11.6` is already a cabinet dependency.

`viewerjs` is an **implementation detail**, fully hidden behind a declarative
Svelte API. It is added to the kit `dependencies` and kept behind its own
subpath export `apartx-ui/lightbox` — mirroring how `swiper` lives behind
`apartx-ui/carousel` ("Heavy dep kept behind its own subpath") — so consumers
that don't need a lightbox don't pull in `viewerjs`.

## API (decided: declarative component)

`src/lib/lightbox/Lightbox.svelte`:

```ts
{
  images: { src: string; alt?: string }[];   // required — the image set
  open?: boolean;        // $bindable, default false — show/hide the viewer
  index?: number;        // $bindable, default 0 — starting / active image
  onClose?: () => void;  // fired when the viewer closes (ESC / backdrop / X)
  options?: Record<string, any>; // escape hatch: merged into new Viewer(el, {...defaults, ...options})
}
```

Rationale for declarative over a `use:lightbox` action: it decouples the viewer
from the consumer's thumbnail markup (works even with no DOM gallery — a single
button, chat attachments), and `bind:open` / `bind:index` mirror the rest of the
kit (e.g. `Dialog`). Chosen over the action and over shipping both to keep the
surface area minimal.

## Internals

- Renders a visually-hidden `<ul>` of `<img>` (one per `images` entry). This is
  the gallery `viewerjs` binds to. The **consumer keeps its own visible
  thumbnail grid**; a thumbnail click just sets `index` + `open = true`.
- One `Viewer` instance, created lazily via dynamic `import('viewerjs')`
  (browser-only → SSR-safe, same pattern as `Carousel`'s swiper import), over
  the hidden `<ul>`, with `{ inline: false, focus: false, ...options }`.
- `$effect` on `open`:
  - `open && !shown` → `viewer.view(index); viewer.show()`
  - `!open && shown` → `viewer.hide()`
- `viewerjs` `hidden` event → set `open = false` + call `onClose?.()`, so ESC /
  backdrop / close-button all flow back through the binding.
- `$effect` rebuilds the `Viewer` when `images` changes; `viewer.destroy()` on
  teardown.
- **Layer-aware z-index:** read `getOverlayLayer()` and pass viewerjs
  `zIndex: layer ? Math.max(2015, layer.z + 10) : 2015`. viewerjs's default 2015
  already beats the kit's small overlay z-bands (modal registry: BASE 60, STEP
  10), but this makes "always above the dialog that opened it" explicit and
  robust against hosts that set a high z.
- `import 'viewerjs/dist/viewer.css'` inside the component → self-contained (no
  global CSS import required of consumers).
- Svelte 5 runes only ($state/$derived/$effect/$props). M3/Tailwind for the
  minimal hidden wrapper.

## Packaging

- New dir `src/lib/lightbox/` with `Lightbox.svelte` + `index.ts`
  (`export { default as Lightbox } from './Lightbox.svelte';` with a doc comment
  noting the heavy-dep-behind-subpath rationale).
- `package.json` exports — add, mirroring the `./carousel` block:
  ```json
  "./lightbox": { "svelte": "./src/lib/lightbox/index.ts", "types": "./src/lib/lightbox/index.ts" },
  ```
- Add `"viewerjs": "^1.11.6"` to kit `dependencies`.
- NOT re-exported from the root `src/lib/index.ts` (same as carousel/virtual/maps
  — subpath only), so the dep stays out of bundles that don't use it.
- Demo: `src/routes/lightbox/+page.svelte` playground (live verify target).

## Future consumer migration (out of scope, for reference)

Not done in this task. Captured so the component's API is validated against the
first real consumer. The cabinet check-in modal
(`CheckinDetailsModal.svelte`, kit consumed there as the `imports/lib/apartx-ui`
submodule) would later: drop `import Viewer from 'viewerjs'` + its `galleryEl` /
`viewer` state + the build/destroy `$effect`; add
`let lightboxOpen = $state(false); let lightboxIndex = $state(0);`; keep the
`grid grid-cols-3` thumbnail markup but have each thumbnail set `lightboxIndex` +
`lightboxOpen`; render
`<Lightbox images={imageUrls.map((src) => ({ src }))} bind:open={lightboxOpen} bind:index={lightboxIndex} />`.
`getImageUrl` stays untouched. That change lands separately and bumps the cabinet
submodule pointer — none of it happens here.

## Gates / workflow

- Build in the standalone `projects/apartx-ui` checkout. `npm run build` is the
  real compile gate (must pass); `npm run check` for (mostly pre-existing) type
  noise.
- Land as a normal apartx-ui change/MR per repo conventions. **Do not push until
  reviewed.**

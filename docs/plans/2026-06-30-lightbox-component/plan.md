# Lightbox Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable, declarative `Lightbox` Svelte 5 component to the apartx-ui kit that wraps `viewerjs` (zoom/pan/rotate/keyboard nav) behind a clean `images`/`open`/`index`/`onClose` API, shipped under its own `apartx-ui/lightbox` subpath.

**Architecture:** `Lightbox.svelte` renders a visually-hidden `<ul>` of `<img>` and lazily instantiates one `viewerjs` `Viewer` over it (dynamic import → SSR-safe). `bind:open`/`bind:index` drive `viewer.view()`/`viewer.hide()`; viewerjs's own close events flow back through the binding. z-index is layer-aware via the kit's `getOverlayLayer()`. `viewerjs` is an implementation detail, added to kit `dependencies` and kept behind a subpath export (mirrors `swiper`/`./carousel`) so non-lightbox consumers don't pull it in.

**Tech Stack:** Svelte 5 (runes), `viewerjs ^1.11.6`, Tailwind v4, Vite/SvelteKit (demo). Spec: [design.md](./design.md).

**Verification approach (read before starting):** This kit unit-tests only *pure logic* (router, utils) — there are **no Svelte component tests**, and `viewerjs` is browser-only and DOM/layout-heavy, so jsdom unit tests don't fit. Per the kit CLAUDE.md the meaningful gate is `npm run build` (compiles every component through `vite-plugin-svelte`). Functional verification is the live demo route driven through the browser preview tools. This plan therefore uses **build + live-preview** as its test gate instead of TDD-style vitest specs. Run all commands from the standalone checkout `/Users/boomfly/Projects/apartx/projects/apartx-ui` (never inside the cabinet's nested submodule). Work happens on the existing branch `feature/lightbox-component`.

---

## File Structure

- **Create** `src/lib/lightbox/Lightbox.svelte` — the component (sole responsibility: wrap viewerjs behind the declarative API).
- **Create** `src/lib/lightbox/index.ts` — category barrel (`export { default as Lightbox } ...`).
- **Modify** `package.json` — add `./lightbox` export + `viewerjs` dependency.
- **Create** `src/routes/lightbox/+page.svelte` — demo/playground (live verify target).
- **Modify** `src/routes/+layout.svelte:54-64` — add a `/lightbox` nav entry.

> The component is deliberately **not** re-exported from the root `src/lib/index.ts` (same as carousel/virtual/maps) so the `viewerjs` dep stays out of bundles that don't import the subpath.

---

## Task 1: Packaging scaffold (dep, barrel, subpath export)

**Files:**
- Create: `src/lib/lightbox/index.ts`
- Modify: `package.json` (exports map + dependencies)

- [ ] **Step 1: Add `viewerjs` to kit dependencies**

Edit `package.json`. In the `"dependencies"` block, add the `viewerjs` line (keep alphabetical order — it goes after `tailwind-merge`, before `virtua`):

```json
    "tailwind-merge": "^3.5.0",
    "viewerjs": "^1.11.6",
    "virtua": "^0.49.1",
```

- [ ] **Step 2: Add the `./lightbox` subpath export**

Edit `package.json` `"exports"`. Add this block immediately after the `"./carousel"` block (mirror it exactly):

```json
    "./carousel": {
      "svelte": "./src/lib/carousel/index.ts",
      "types": "./src/lib/carousel/index.ts"
    },
    "./lightbox": {
      "svelte": "./src/lib/lightbox/index.ts",
      "types": "./src/lib/lightbox/index.ts"
    },
```

- [ ] **Step 3: Create the barrel**

Create `src/lib/lightbox/index.ts` with exactly:

```ts
// Lightbox (viewerjs). Heavy dep kept behind its own subpath
// (`apartx-ui/lightbox`) so consumers that don't need an image viewer don't
// pull in viewerjs. Declarative wrapper — viewerjs is an implementation detail;
// drive it with `images` + `bind:open` / `bind:index`.
export { default as Lightbox } from './Lightbox.svelte';
```

- [ ] **Step 4: Install the dependency**

Run (in the standalone checkout — NOT the cabinet submodule):

```bash
cd /Users/boomfly/Projects/apartx/projects/apartx-ui && npm install
```

Expected: `viewerjs` added to `node_modules`; `package-lock.json` updated; no errors.

- [ ] **Step 5: Verify viewerjs resolves and ships its CSS**

Run:

```bash
ls node_modules/viewerjs/dist/viewer.css node_modules/viewerjs/types/index.d.ts
```

Expected: both paths print (CSS file the component imports + viewerjs's bundled TS types, declared via its package `types` field — auto-resolved by TS, no explicit path needed).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/lightbox/index.ts
git commit -m "feat(lightbox): scaffold subpath export + viewerjs dep + barrel"
```

---

## Task 2: Implement `Lightbox.svelte`

**Files:**
- Create: `src/lib/lightbox/Lightbox.svelte`

- [ ] **Step 1: Write the component**

Create `src/lib/lightbox/Lightbox.svelte` with exactly this content:

```svelte
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import 'viewerjs/dist/viewer.css';
  import { getOverlayLayer } from '../ui/overlays/layer-context';

  type LightboxImage = { src: string; alt?: string };

  /**
   * Declarative image lightbox — a thin Svelte 5 wrapper around `viewerjs`
   * (zoom / pan / rotate / keyboard navigation come for free). viewerjs is an
   * implementation detail: drive the viewer with `images` + `bind:open` /
   * `bind:index`. The component renders only a visually-hidden gallery; keep your
   * own visible thumbnails and, on click, set `index` + `open = true`.
   *
   * @example
   *   let open = $state(false);
   *   let index = $state(0);
   *   <button onclick={() => { index = 0; open = true; }}>…thumbnail…</button>
   *   <Lightbox images={photos} bind:open bind:index />
   */
  let {
    images,
    open = $bindable(false),
    index = $bindable(0),
    onClose,
    options,
  }: {
    /** Images to show, in order. */
    images: LightboxImage[];
    /** Show/hide the viewer. Bindable — viewerjs-driven closes flip it back to false. */
    open?: boolean;
    /** Active / starting image index. Bindable. */
    index?: number;
    /** Fires when the viewer closes (ESC / backdrop / close button / `open=false`). */
    onClose?: () => void;
    /** Escape hatch: merged into `new Viewer(el, { ...defaults, ...options })`. */
    options?: Record<string, any>;
  } = $props();

  // viewerjs is browser-only and heavy → loaded lazily (SSR-safe, mirrors how
  // Carousel registers swiper on mount). Until it resolves, no instance exists.
  let ViewerCtor: typeof import('viewerjs').default | null = $state(null);
  let galleryEl: HTMLUListElement | undefined = $state();
  // Plain (non-reactive) instance refs: the open/index effect must NOT re-run
  // when these change — only when `open`/`index` do.
  let viewer: import('viewerjs').default | null = null;
  let shown = false;

  // Layer-aware z-index: sit above the overlay that opened us. viewerjs's default
  // (2015) already clears the kit's small z-bands (modal registry BASE 60 / STEP
  // 10); this makes "above the dialog" explicit and robust if a host raises z.
  const layer = getOverlayLayer();
  const zIndex = $derived(layer ? Math.max(2015, layer.z + 10) : 2015);

  onMount(async () => {
    const mod = await import('viewerjs');
    ViewerCtor = mod.default;
  });

  // viewerjs fires custom DOM events on the bound element. `hidden` = the viewer
  // finished closing (covers ESC / backdrop / its own close button) → sync the
  // binding and notify the consumer.
  function onHidden() {
    shown = false;
    if (open) open = false;
    onClose?.();
  }

  function openAt(i: number) {
    if (!viewer) return;
    viewer.view(i); // in modal mode, view() shows the viewer at that image
    shown = true;
  }

  // (Re)build the Viewer when the ctor becomes ready, the gallery element exists,
  // or the image set changes. `void images` registers the dependency so a changed
  // image set tears down and rebuilds (the hidden <li> list has already been
  // re-rendered by the time this effect runs).
  $effect(() => {
    void images;
    const Ctor = ViewerCtor;
    const el = galleryEl;
    if (!Ctor || !el) return;

    viewer?.destroy();
    shown = false;
    viewer = new Ctor(el, { inline: false, focus: false, zIndex, ...options });
    el.addEventListener('hidden', onHidden);

    // Honour an `open` that was set before the instance existed.
    if (untrack(() => open)) openAt(untrack(() => index));

    return () => {
      el.removeEventListener('hidden', onHidden);
      viewer?.destroy();
      viewer = null;
      shown = false;
    };
  });

  // React to open/index changes. Reads of `viewer`/`shown` are intentionally
  // untracked (plain vars) so this effect's only deps are `open` and `index`.
  $effect(() => {
    const o = open;
    const i = index;
    untrack(() => {
      if (!viewer) return;
      if (o && !shown) openAt(i);
      else if (o && shown) viewer.view(i); // already open → switch image
      else if (!o && shown) viewer.hide();
    });
  });
</script>

<!-- Visually-hidden gallery viewerjs binds to. Clipped to 0×0 (not display:none)
     so the <img> elements stay in the DOM for viewerjs to enumerate. The visible
     UI lives in the consumer; this only feeds the viewer. -->
<ul
  bind:this={galleryEl}
  aria-hidden="true"
  style="position:absolute;width:0;height:0;overflow:hidden;clip:rect(0 0 0 0);"
>
  {#each images as image, i (i)}
    <li><img src={image.src} alt={image.alt ?? ''} /></li>
  {/each}
</ul>
```

- [ ] **Step 2: Type/compile-check the component**

Run:

```bash
cd /Users/boomfly/Projects/apartx/projects/apartx-ui && npm run check 2>&1 | rg -i "lightbox" || echo "no lightbox-specific errors"
```

Expected: `no lightbox-specific errors` (the kit has pre-existing type noise elsewhere; what matters is that `Lightbox.svelte` adds none). If a `viewerjs` type error appears, confirm `node_modules/viewerjs/types/index.d.ts` exists (Task 1 Step 5) — TS resolves it via viewerjs's package `types` field automatically.

- [ ] **Step 3: Full build gate**

Run:

```bash
cd /Users/boomfly/Projects/apartx/projects/apartx-ui && npm run build
```

Expected: build completes with no errors. This compiles `Lightbox.svelte` through `vite-plugin-svelte` and resolves the dynamic `import('viewerjs')` + the CSS import — the real correctness gate.

- [ ] **Step 4: Commit**

```bash
git add src/lib/lightbox/Lightbox.svelte
git commit -m "feat(lightbox): declarative viewerjs wrapper (open/index/onClose, layer-aware z)"
```

---

## Task 3: Demo route + nav entry

**Files:**
- Create: `src/routes/lightbox/+page.svelte`
- Modify: `src/routes/+layout.svelte:54-64`

- [ ] **Step 1: Add the nav entry**

In `src/routes/+layout.svelte`, edit the `nav` array (currently ends `…{ path: '/maps', label: 'Maps' }, { path: '/hooks', label: 'Hooks' },`). Insert a Lightbox entry after Maps:

```js
    { path: '/maps', label: 'Maps' },
    { path: '/lightbox', label: 'Lightbox' },
    { path: '/hooks', label: 'Hooks' },
```

- [ ] **Step 2: Create the demo page**

Create `src/routes/lightbox/+page.svelte` with exactly:

```svelte
<script lang="ts">
  import { Lightbox } from '$lib/lightbox';

  // Public placeholder images (picsum) — deterministic via fixed ids.
  const images = [
    { src: 'https://picsum.photos/id/1015/1200/800', alt: 'River' },
    { src: 'https://picsum.photos/id/1025/1200/800', alt: 'Dog' },
    { src: 'https://picsum.photos/id/1003/800/1200', alt: 'Deer' },
    { src: 'https://picsum.photos/id/1039/1600/900', alt: 'Waterfall' },
  ];

  let open = $state(false);
  let index = $state(0);

  function openAt(i: number) {
    index = i;
    open = true;
  }
</script>

<div class="mx-auto max-w-3xl">
  <h1 class="text-headline-md text-on-surface mb-2">Lightbox</h1>
  <p class="text-body-md text-on-surface-variant mb-6">
    Click a thumbnail to open the viewer (zoom / pan / rotate / arrow-key nav from
    viewerjs). Close with Esc, the backdrop, or the toolbar button — <code>open</code>
    flips back to <code>false</code>.
  </p>

  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {#each images as image, i (i)}
      <button
        type="button"
        onclick={() => openAt(i)}
        class="aspect-square overflow-hidden rounded-md bg-surface-container outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <img src={image.src} alt={image.alt} class="h-full w-full object-cover" />
      </button>
    {/each}
  </div>

  <p class="text-label-md text-on-surface-variant mt-4">
    State — open: {open}, index: {index}
  </p>

  <Lightbox {images} bind:open bind:index onClose={() => console.log('lightbox closed')} />
</div>
```

- [ ] **Step 3: Build gate (compiles the demo too)**

```bash
cd /Users/boomfly/Projects/apartx/projects/apartx-ui && npm run build
```

Expected: build succeeds (now also compiling `src/routes/lightbox/+page.svelte`).

- [ ] **Step 4: Commit**

```bash
git add src/routes/lightbox/+page.svelte src/routes/+layout.svelte
git commit -m "docs(lightbox): demo route + nav entry"
```

---

## Task 4: Live verification in the browser preview

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Use the preview tool `preview_start` (it runs `npm run dev` for this SvelteKit app). If a server is already running, reuse it.

- [ ] **Step 2: Navigate to the demo**

`preview_eval`: `window.location.href = '/lightbox'` (or click the "Lightbox" nav item via `preview_click`). Then `preview_snapshot` — expected: the page heading "Lightbox" and a 4-thumbnail grid.

- [ ] **Step 3: Open the viewer**

`preview_click` the first thumbnail button. Then `preview_snapshot` — expected: viewerjs's full-screen viewer is present (a `.viewer-container` with the large image + toolbar). `preview_console_logs` — expected: no errors.

- [ ] **Step 4: Confirm state sync + close**

`preview_snapshot` should show "State — open: true". Press Escape via `preview_eval`:
`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))` — or `preview_click` the viewerjs close button. Then `preview_snapshot` — expected: viewer gone, "State — open: false", and `preview_console_logs` shows the `lightbox closed` log (proves the `hidden` event → `open=false` + `onClose` round-trip).

- [ ] **Step 5: Capture proof**

`preview_screenshot` with the viewer open (from Step 3) to share visual confirmation.

- [ ] **Step 6: Stop the preview server** (optional) via `preview_stop`.

> No commit — verification only. After this passes, the component work is complete. Do NOT push; the branch is left for review (and a future, separate cabinet migration per the spec's "Future consumer migration" section).

---

## Self-Review (completed during planning)

- **Spec coverage:** wrap-viewerjs ✓ (Task 2), declarative `images`/`open`/`index`/`onClose`/`options` API ✓ (Task 2 Step 1), lazy SSR-safe import ✓, layer-aware z-index via `getOverlayLayer()` ✓, self-contained CSS import ✓, `./lightbox` subpath + `viewerjs` in `dependencies` + barrel + not-in-root-index ✓ (Task 1), demo route ✓ (Task 3), build gate ✓ (Tasks 2–3), no cabinet migration ✓ (explicitly out of scope; Task 4 note). 
- **Placeholders:** none — every code step shows full content.
- **Type/name consistency:** `Lightbox`, `LightboxImage`, `images/open/index/onClose/options`, `galleryEl`, `viewer`, `shown`, `openAt`, `onHidden`, `getOverlayLayer` used identically across tasks; barrel name matches the import in the demo (`$lib/lightbox` → `Lightbox`) and the subpath export.

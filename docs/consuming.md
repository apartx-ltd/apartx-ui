# Consuming apartx-ui in a new SvelteKit / Vite app

How to wire the kit into a fresh consumer project. The reference implementation
of everything below is **apartx-help** (SvelteKit + adapter-node); apartx-admin,
apartx-cabinet and apartx-spaces follow the same rules inside Meteor bundlers.

The kit is **source-based**: there is no build step and no npm package. Consumers
vendor the repository and compile the raw `.svelte`/`.ts` sources with their own
bundler. That drives every rule in this guide.

## 1. Vendor the kit as a git submodule

```bash
git submodule add https://github.com/apartx-ltd/apartx-ui.git src/lib/apartx-ui
git submodule update --init
```

`src/lib/apartx-ui` is the conventional location for SvelteKit hosts. Pin to a
commit (submodules do this naturally); the kit uses `main` for active
development and tags stable releases.

**Never run `npm install` inside the submodule.** A `node_modules` inside
`src/lib/apartx-ui` creates a second `svelte` instance in the module graph,
which breaks hydration and bits-ui context at runtime (see §6). If it exists,
delete it.

## 2. Install the kit's dependencies in YOUR app root

Because the kit is not npm-installed, nothing installs its dependencies for
you: **both its `peerDependencies` and its `dependencies` must be present in
the consumer's own `package.json`.** Copy the versions from
`src/lib/apartx-ui/package.json` (they move together — re-check after every
submodule bump).

Always required:

```
svelte  bits-ui  svelte-fa
@fortawesome/fontawesome-svg-core  @fortawesome/free-solid-svg-icons
@fortawesome/free-regular-svg-icons  @fortawesome/free-brands-svg-icons
@material/material-color-utilities  @internationalized/date
clsx  tailwind-merge  dayjs  svelte-sonner  zod
tailwindcss  @tailwindcss/vite
```

Required only when you import the matching kit module:

| Kit module | Extra deps |
|---|---|
| `apartx-ui/chart` | `chart.js` |
| `apartx-ui/carousel` | `swiper` |
| `apartx-ui/lightbox` | `viewerjs` |
| `apartx-ui/virtual`, `apartx-ui/chat` | `virtua` |
| `apartx-ui/chat` (media), video playback | `media-chrome` |
| `apartx-ui/sync`, `apartx-ui/chat` (offline) | `dexie` |
| `CupertinoPane` overlay | `cupertino-pane` |
| `apartx-ui/maps` (types) | `@yandex/ymaps3-types` (dev) |

## 3. Vite config — subpath aliases instead of npm resolution

Mirror the kit's `exports` map with `resolve.alias` in **array form**. A plain
string alias for the bare `apartx-ui` would also capture `apartx-ui/styles/...`
as a prefix and mis-resolve it, so the bare entry must be an exact regex and
subpath entries must come first. Do **not** put these in SvelteKit's
`kit.alias` — it has the same prefix-swallowing problem.

```js
// vite.config.js
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const ui = (sub) => path.resolve(`./src/lib/apartx-ui/src/lib/${sub}`);
const apartxUiAliases = [
  // categories that live under src/lib/ui/*
  ...['structure', 'display', 'data', 'forms', 'overlays'].map((c) => ({
    find: `apartx-ui/${c}`, replacement: ui(`ui/${c}`),
  })),
  // top-level modules
  ...['modals', 'navigation', 'hooks', 'theme', 'virtual', 'chart',
      'carousel', 'lightbox', 'maps', 'chat', 'sync', 'styles'].map((m) => ({
    find: `apartx-ui/${m}`, replacement: ui(m),
  })),
  // prefix alias covers both `apartx-ui/router` and `apartx-ui/router/sveltekit`
  { find: 'apartx-ui/router', replacement: ui('router') },
  // bare import — EXACT match so it can't swallow the subpaths above
  { find: /^apartx-ui$/, replacement: ui('index.ts') },
];

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  resolve: { alias: apartxUiAliases },
  // The vendored kit ships a tsconfig.json that `extends` its generated
  // .svelte-kit/tsconfig.json — absent in a submodule checkout. esbuild
  // auto-resolves the nearest tsconfig per file and chokes on the broken
  // `extends`; pinning an empty tsconfigRaw disables that lookup.
  esbuild: { tsconfigRaw: '{}' },
  ssr: {
    // The kit uses extensionless internal imports that Node's ESM resolver
    // rejects during SSR — let Vite bundle these instead.
    noExternal: ['@material/material-color-utilities'],
  },
});
```

## 4. Tailwind v4 + kit styles + theme

Tailwind v4 is configured in CSS (no `tailwind.config.js`) via the
`@tailwindcss/vite` plugin already added above. In your CSS entry
(`src/app.css`):

```css
@import 'tailwindcss';

/* Scan the vendored kit sources for class usage — without this, kit
 * components render unstyled in production builds. */
@source './lib/apartx-ui/src/lib/**/*.{svelte,ts}';
@source './**/*.{svelte,js,ts}';

/* Kit CSS barrel: design tokens (@theme vars), typescale, utilities,
 * animations, page transitions. The `styles` alias points at the directory,
 * so import the barrel file explicitly. */
@import 'apartx-ui/styles/index.css';
```

**Theme palette.** Kit components read `--theme-*` CSS variables. Two ways to
define them:

- **SSR hosts (adapter-node): static CSS palette.** Define the `--theme-*`
  variables in `:root` (light) and `html.dark` (dark) blocks in `app.css`, and
  set `<html class="light|dark">` server-side from a cookie in
  `hooks.server.js`. The correct theme paints on first byte — no flash before
  hydration. See `apartx-help/src/app.css` + `hooks.server.js` for the full
  palette block to copy.
- **SPA hosts: runtime theme.** `applyTheme()` from `apartx-ui/theme`
  generates an M3 palette from a seed color at startup. Simpler, but unstyled
  first paint under SSR — don't use it there.

## 5. Routing: wire the Navigator once

The kit never owns routing. Nav-aware components (`<Link>`, `<BackButton>`,
`<BottomNav>`, …) consume a `Navigator` injected near the root. SvelteKit
hosts get a ready adapter:

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { useSvelteKitNavigation } from 'apartx-ui/router/sveltekit';
  useSvelteKitNavigation(); // wires Navigator + route key to $app/state
</script>
```

Non-SvelteKit hosts implement the `Navigator` contract from
`apartx-ui/navigation` and call `setNavigator(...)` themselves (example in the
kit README). Without a navigator, components degrade to native `<a href>`.

## 6. The one-instance rule (svelte, bits-ui)

Exactly **one** copy of `svelte` and `bits-ui` may exist in the module graph.
A second copy (usually a nested `node_modules` inside the submodule, or a
version-conflicted transitive dep) causes hydration crashes and broken
overlay/context state that look like kit bugs.

Check after every install or submodule bump:

```bash
npm ls svelte bits-ui        # exactly one version of each, at the root
ls src/lib/apartx-ui/node_modules 2>/dev/null && echo "DELETE THIS"
```

## 7. i18n

The kit has no i18n dependency. Every user-facing string in kit components is
a **prop with an English default** — pass translated strings at the call site
from whatever i18n stack the app uses. Never import an i18n library "into" the
kit.

## 8. Verify the integration

Your app's production build is the gate:

```bash
npm run build     # must pass — compiles every imported kit component
```

If it fails, check in order: nested `node_modules` in the submodule (§6),
missing app-root dependency (§2), missing alias for the subpath you imported
(§3), Tailwind entry missing `@source` for the kit (§4).

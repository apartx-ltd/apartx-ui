# apartx-ui

ApartX Svelte 5 UI Kit — a themeable component library shared across
ApartX front-ends (`apartx-admin`, and in future `apartx-cabinet` /
`apartx-spaces`).

- **Svelte 5** (runes throughout: `$props`/`$state`/`$derived`/`$effect`, snippets)
- **Tailwind CSS v4** with a semantic design-token system
- **Source-based, no build step** — consumers compile the raw `.svelte`/`.ts`
  sources directly through their own bundler (Meteor + rspack, Vite, etc.). The
  repo ships no compiled artifacts; `package.json` `exports` point at sources.

This repo also contains a SvelteKit **demo / playground** (`src/routes`) so the
components can be developed and reviewed in isolation.

## Layout

```
src/
├── lib/                      # === the library (what consumers import) ===
│   ├── index.ts              # main barrel — all components + utils
│   ├── ui/
│   │   ├── structure/        # Page, Header, Content, Footer, Toolbar, Title,
│   │   │                     #   BackButton, Searchbar, Segment, SplitPane,
│   │   │                     #   Menu, DrawerButton
│   │   ├── display/          # Button, Icon, Badge, Card, Callout, Chip, Avatar, Tabs,
│   │   │                     #   Separator, Progress, Skeleton, Loading, Fab,
│   │   │                     #   Link, Accordion, AccordionItem, PopoverJson, Text
│   │   ├── data/             # List, Item, ListHeader, DataTable, Pagination
│   │   ├── forms/            # TextField, Select, Checkbox, Switch, FormField,
│   │   │                     #   DatePicker, createForm
│   │   ├── overlays/         # Dialog, ConfirmDialog (+ confirm service),
│   │   │                     #   Drawer, Tooltip, DropdownMenu, ToasterMount
│   │   └── utils/            # cn, date
│   ├── hooks/                # useMobile, useDebounce, useLocalStorage,
│   │                         #   useDisclosure, useSearchQuery
│   ├── scanner/              # QrScanner — камера + видоискатель, onScan(text), paused;
│   │                         #   subpath apartx-ui/scanner, jsqr — optional peer
│   ├── theme/                # applyTheme, generateTokens (runtime palette)
│   └── styles/               # tokens.css (@theme), typescale.css
└── routes/                   # === demo playground (not published) ===
```

## Demo

```bash
npm install
npm run dev        # http://localhost:5173 — one route per category
npm run build      # production build of the demo (also validates compilation)
npm run check      # svelte-check
```

## Consuming the kit (source-based via git submodule)

Add as a submodule in the consumer repo and point a path alias at `src/lib`:

```bash
git submodule add https://github.com/apartx-ltd/apartx-ui.git apartx-ui
```

Then import from the main barrel or a category subpath:

```svelte
<script>
  import { Button, Dialog } from 'apartx-ui';
  // or, tree-friendly: import { Button } from 'apartx-ui/display';
</script>
```

The consumer's bundler must:

1. Compile `.svelte` / `.svelte.ts` from the submodule (do **not** exclude it
   from the svelte loader rule).
2. Resolve the `apartx-ui` alias to `apartx-ui/src/lib` (and the subpaths).
3. Scan the submodule for Tailwind classes — add to the app's `app.css`:
   `@source '../../apartx-ui/src/lib/**/*.{svelte,ts}';`
4. Import the kit stylesheet barrel once (after `@import 'tailwindcss'`):
   `@import 'apartx-ui/styles';`. Import the barrel, not individual files —
   it carries tokens, typescale, role aliases, utilities and animations, and
   picks up anything added later. Cherry-picking silently drops whatever the
   list misses (`<Text>` renders unstyled without `typography-roles.css`).

`bits-ui`, `svelte`, and `svelte-fa` are **peer dependencies** — keep a single
version across the consumer and the kit (a second `bits-ui` instance breaks
Dialog/DatePicker/Accordion context).

### Theming

The kit ships a neutral ApartX-blue fallback palette in `styles/tokens.css`.
To rebrand at runtime, call `applyTheme(seedHex)` once near app start; it
generates the full palette from a seed and sets the `--theme-*` CSS variables.

### Typography — `<Text>` and the `text-<role>` aliases

Text is described by a **role**, not by a hand-picked "scale + colour" pair:

```svelte
<script>
  import { Text } from 'apartx-ui/display';
</script>

<Text role="hint">Verify your phone or email first</Text>
<Text role="caption" tone="error" as="span">That code has expired</Text>

<p class="text-hint">…</p>   <!-- where the component is inconvenient -->
```

Roles (tag · scale · default tone; unmarked = the default `on-surface`):
`page-title` (h1 · headline-md), `section-title` (h2 · title-lg),
`group-title` (h3 · title-md), `item-title` (div · title-md), `item-subtitle`
(div · title-sm · muted), `body` (p · body-lg), `hint` (p · body-md · muted),
`caption` (p · body-sm · muted), `action` (span · label-lg), `label` (span ·
label-md · muted), `overline` (span · label-sm · muted).

Tones: `default`, `muted`, `inherit`, `primary`, `secondary`, `tertiary`,
`error`, `success`, `warning`. Use `tone="inherit"` for text on a coloured
surface (`bg-* text-on-*` on the container) — the colour is inherited rather
than repeated on every child.

`role` is **required**: there is no dominant role, and a silent default would
mask a forgotten choice. `as` overrides the role's tag; a `tone` prop or a bare
utility class always wins over the alias, because the aliases are authored into
`@layer components` and utilities outrank them.

The aliases live in `styles/typography-roles.css` (pulled in by the
`apartx-ui/styles` barrel); the role list itself is `ui/utils/typography.ts`.

Not to be confused with `structure/Title` — that is the toolbar heading
(truncating, for the header slot), not a text role. For a page heading inside
the content use `<Text role="page-title">`.

### Callout — "action needed" on a page

A tonal container with an optional icon, a title, an explanation and stacked
full-width actions. Use it instead of a hand-coloured `Card` with a heading, a
paragraph and a button:

```svelte
<Callout icon={faIdCard} title="Self check-in" data-testid="checkin-callout">
  Verify your identity before arrival.
  {#snippet actions()}<Button variant="filled">Start check-in</Button>{/snippet}
</Callout>
<Callout tone="error" title="Cancelled" />
```

`tone` is an M3 container pair — `primary` (default), `secondary`, `tertiary`,
`error` — so text and icon always contrast the fill and follow the brand theme.
The title renders as `<Text role="group-title" as="h3">`, the body as
`<Text role="hint">`, both with `tone="inherit"`. `title` accepts a string or a
snippet; extra attributes (`data-testid`, `role`) land on the root.

### Navigation — router-agnostic

The kit never owns routing. Instead a host adapts its router to the `Navigator`
contract (`apartx-ui/navigation`) and injects it once near the Svelte root.
Nav-aware components (`<Link>`, …) consume it; without it they degrade to native
`<a href>`.

```svelte
<script>
  import { setNavigator, matchActive, type Navigator } from 'apartx-ui/navigation';
  import { goto } from '$app/navigation';   // or your router
  import { page } from '$app/state';

  const navigator: Navigator = {
    push: (href) => goto(href),
    replace: (href) => goto(href, { replaceState: true }),
    back: () => history.back(),
    get current() {
      return { pathname: page.url.pathname, search: page.url.search, hash: page.url.hash };
    },
    isActive: (href, opts) => matchActive(page.url.pathname, href, opts),
  };
  setNavigator(navigator);
</script>
```

`<Link>` also accepts a per-instance `navigate` prop override.

### Page transitions — `<PageTransition>`

Animate view changes without owning routing — pass a `key` that changes per
route. Respects `prefers-reduced-motion`.

```svelte
<script>
  import { PageTransition } from 'apartx-ui/navigation';
  import { page } from '$app/state';
</script>

<PageTransition key={page.url.pathname}>
  {@render children()}
</PageTransition>
```

**`slideStyle`** (`'auto' | 'ios' | 'shared-axis'`, default `'auto'`) chooses the mobile
slide: `ios` is a full-width opaque push; `shared-axis` is a short Material slide with a
content fade. `'auto'` resolves by OS (iOS → `ios`, Android/other → `shared-axis`).
Orthogonal to `mode`; ignored on desktop (always crossfades). Accepts a `() => SlideStyle`
function, resolved lazily per navigation like `direction`.

### VirtualRouter and `configureNav`

`<VirtualRouter hashParam prefix?>` routes a **subtree** (a side panel, say) by the
`#<hashParam>=<path>` pair of the real URL, while the rest of the app keeps routing by
the real pathname. Nested `<Router>`/`<Route>`/`useRouter()` read the virtual path;
`push`/`replace`/`back` rewrite only that fragment pair (other pairs and the pathname are
untouched) and go through the real router. `prefix` is the base the subtree's routes are
declared under (`/accounts`); it is not written into the fragment.

Fragment format: `#key=value&key2=value2`. Values stay readable (`#panel=/accounts/42?tab=1`);
only `%`, `&` and `#` are percent-escaped. Helpers: `parseHashParams`, `formatHashParams`,
`splitUrl`, `withHashParams(url, { key: value | null })`.

`configureNav({ keepHash, intercept })` is an optional, global hook on `navigate`/`replace`.
Without a call, navigation behaves exactly as before. Each call **replaces** the previous
config wholesale (keys you omit are dropped, not kept).

- `keepHash: string[]` — fragment pairs carried over from the current URL onto a target
  that doesn't set them (so the panel survives ordinary page navigation). Per call, opt out
  with `{ keepHash: false }`: `navigate(to, { keepHash: false })`,
  `useRouter().push/replace(url, { keepHash: false })` — `intercept` still runs. Closing a
  panel = navigate to an address without the pair and with `keepHash: false`.
- `intercept(to, from) => string | null` — gets the address *after* `keepHash`; returns the
  final address (possibly a different one) or `null` to cancel the navigation. `from` is
  `{ pathname, search, hash, origin?, scopedTo? }`.
- Order: `keepHash`, then `intercept`. Both run when the target is resolved, i.e. *before*
  the leave guard (`useNavigationGuard`); a guard-confirmed retry is not resolved twice.
- Once `configureNav` has been called, `navigate` does not ask the leave guard when only the
  fragment changes (pathname and search stay) — same as the browser history adapter. A dirty
  form inside the panel is therefore not guarded on in-panel navigation. Without a
  `configureNav` call the guard is asked as before.

`intercept` sees two shapes of `to`:

- **Raw navigation** (`navigate`, `use:link`, plain `<Link>`, chat links): `to` is the target
  path with the current pairs carried over — `/accounts/bookings#panel=/properties/p1`;
  `from.scopedTo` is `undefined`.
- **From inside a `VirtualRouter`** (its `useRouter().push/replace`, scoped `<Link>`, the
  scoped `Navigator`): `to` is the *current* path with the panel pair rewritten —
  `/accounts/chats/c1#panel=/billing`; `from.scopedTo` is the full virtual target the subtree
  asked for (`/accounts/billing`, with search). Return `from.scopedTo + from.hash` (or any
  other URL) to send it to the main screen instead.

`origin` is the router scope the navigation started from: `VirtualRouter` renders
`data-router-scope="<hashParam>"`, and `<Link>`, `use:link` and chat links pass the nearest
scope as `from.origin` (absent in the main area), so `intercept` can e.g. redirect a link
clicked inside the panel to the panel itself. `routerScopeOf(el)` reads it.

`<Link to>` inside a `VirtualRouter` takes a virtual path but renders the **full real
href** including the fragment, so ctrl/middle-click and copy-link work. An absolute/external
`to` (`https://…`) stays a plain link. `VirtualRouter` also provides a scoped `Navigator`
(`getNavigator()`) to its subtree, so kit components navigate inside the panel.
Nested `VirtualRouter`s are not supported.
Hash-only navigations skip the leave guard; a host that wants to protect a dirty panel form
on close calls `requestLeave(() => navigate(url, { keepHash: false }))` (`isLeaveBlocked()` tells whether a guard is dirty).

#### Panel history

A `VirtualRouter` keeps a journal of every navigation, per `hashParam` (module-level, so it
keeps recording while the panel is closed; a page reload loses it). The journal needs the
history adapter's index: `HistoryAdapter.position?: number` is the index of the current
entry (the browser adapter exposes `history.state.idx`). Custom adapters should expose it;
without `position` the old rule applies (any history entry counts as "back" — history first).

`back(href?)` of the panel router:

1. If the previous history entry is a step of the same panel at the same main address
   (`pathname + search`), it calls `history.back()` — the browser Back and the panel's Back
   agree.
2. Otherwise it replaces to the route's `<Route back>`, which wins over the page's `href`
   inside a `VirtualRouter` (the route knows the parent inside the panel, `href` is the page's
   fallback on the main screen), else to `href`.
3. Otherwise it does nothing.

`currentHasParent` is reactive (rule 1 holds, or the route has a `back`).

`<VirtualRouter backAtRoot="hide">` (`'show'` by default, read once at mount) makes the kit
`BackButton` of the owning toolbar (see Host chrome) disappear while there is nothing to go
back to. A `BackButton` with `href` is always shown.

#### Host chrome

A host that wraps a subtree (a side panel) can contribute a control to the subtree's pages
— typically a close button — without the pages knowing about it:
`setHostChrome({ end })` once above the subtree (`getHostChrome()` reads it).

Per `Page`, exactly one kit `Toolbar` owns the host chrome and renders `end` after its own
`end`. The first toolbar by rank owns it: a toolbar inside `Header` beats others; a `Header`
toolbar mounted later takes over; after the owner unmounts, the remaining toolbars re-claim in
tree order. `BackButton`s of the owning toolbar follow `backAtRoot`.

Nothing claims in `Dialog`, `BottomSheet`, `Drawer`, `DocumentDialog` (and a `Page` inside
them), in `Footer`, or in a `Toolbar` outside `Page`. `BackButton`s in overlays and in
non-owning toolbars are unaffected. On SSR the host `end` appears after hydration. Without
`setHostChrome` nothing changes.

```svelte
<!-- side panel host -->
<script>
  import { setHostChrome, VirtualRouter } from 'apartx-ui';
  setHostChrome({ end: closeButton });
</script>

{#snippet closeButton()}
  <IconButton aria-label="Close" onclick={closePanel}><Icon name="close" /></IconButton>
{/snippet}

<VirtualRouter hashParam="panel" prefix="/accounts" backAtRoot="hide">
  <Routes />
</VirtualRouter>
```

Chat cards: `openLink(target, ctx?)` hands the registered link handler a `LinkOpenContext`
(`{ origin? }`) as the second argument when the clicked element sits in a router scope
(no scope → called with one argument, as before). Chat links reach `from.origin` of
`intercept` only if the host handler forwards it: `navigate(path, { origin: ctx?.origin })`.

Host example:

```svelte
<script>
  import { configureNav, VirtualRouter, Router, Route } from 'apartx-ui/router';

  configureNav({
    keepHash: ['panel'],
    intercept: (to, from) =>
      // openInPanel(to) — host helper: the URL that opens `to` in the panel, or null to cancel
      from.origin === 'panel' || !to.startsWith('/accounts') ? to : openInPanel(to),
  });
</script>

<VirtualRouter hashParam="panel" prefix="/accounts">
  <Router>
    <Route path="/accounts/:id">…</Route>
  </Router>
</VirtualRouter>
```

## Scope

Pure, standalone UI lives here. App-specific concerns intentionally **stay in
the consumer**: Meteor hooks (`useTracker`/`useMethod`/`useSubscription`), the
i18n wrapper, app routing (`useRouter`, `match-route`), and brand assets. All
user-facing text is passed in via props (English defaults), so the consumer
owns translation.

**Product knowledge stays out too** (since 0.10.0). The kit ships *mechanisms*
and the host supplies *meaning*: the modal registry (`apartx-ui/modals`) does not
know which modals exist; the link registry (`apartx-ui/links`) parses
`#/<type>/<id>` but not what a type opens; `<ToasterMount>` mounts sonner and
owns the z-band, but the error toast's action row, help articles, support
hand-off and push-permission prompts belong to a product layer built on top of
the kit; chat (`apartx-ui/chat`) is a generic engine — booking/role markers,
avatars and per-app link types come in through snippets and the slot context.
When a component needs a product concept (an article id, a support channel, a
booking) to work, it is in the wrong package.

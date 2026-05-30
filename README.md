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
│   │   ├── display/          # Button, Icon, Badge, Card, Chip, Avatar, Tabs,
│   │   │                     #   Separator, Progress, Skeleton, Loading, Fab,
│   │   │                     #   Link, Accordion, AccordionItem, PopoverJson
│   │   ├── data/             # List, Item, ListHeader, DataTable, Pagination
│   │   ├── forms/            # TextField, Select, Checkbox, Switch, FormField,
│   │   │                     #   DatePicker, createForm
│   │   ├── overlays/         # Dialog, ConfirmDialog (+ confirm service),
│   │   │                     #   Drawer, Tooltip, DropdownMenu, ToasterMount
│   │   └── utils/            # cn, date
│   ├── hooks/                # useMobile, useDebounce, useLocalStorage,
│   │                         #   useDisclosure, useNotification, useSearchQuery
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
4. Import the token styles once (after `@import 'tailwindcss'`):
   `@import 'apartx-ui/styles/tokens.css';` and `typescale.css`.

`bits-ui`, `svelte`, and `svelte-fa` are **peer dependencies** — keep a single
version across the consumer and the kit (a second `bits-ui` instance breaks
Dialog/DatePicker/Accordion context).

### Theming

The kit ships a neutral ApartX-blue fallback palette in `styles/tokens.css`.
To rebrand at runtime, call `applyTheme(seedHex)` once near app start; it
generates the full palette from a seed and sets the `--theme-*` CSS variables.

### Routing — `<Link>`

The kit is router-agnostic. `<Link>` falls back to native `<a href>` navigation
unless a navigator is injected. Wire it once near your Svelte root:

```svelte
<script>
  import { setLinkNavigate } from 'apartx-ui/display';
  import { goto } from '$app/navigation'; // or your router's push/replace
  setLinkNavigate((href, opts) => goto(href, { replaceState: opts?.replace }));
</script>
```

Per-instance override is also available via the `navigate` prop on `<Link>`.

## Scope

Pure, standalone UI lives here. App-specific concerns intentionally **stay in
the consumer**: Meteor hooks (`useTracker`/`useMethod`/`useSubscription`), the
i18n wrapper, app routing (`useRouter`, `match-route`), and brand assets. All
user-facing text is passed in via props (English defaults), so the consumer
owns translation.

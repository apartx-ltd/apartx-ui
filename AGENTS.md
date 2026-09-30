# apartx-ui — agent guide

Guidance for AI agents and developers working in the ApartX Svelte 5 UI Kit.
`CLAUDE.md` is a symlink to this file — keep them one document. See the
workspace root guidance of the consuming app for cross-project rules.

## What this is

A **source-based** Svelte 5 component library (themeable design system, Tailwind v4),
extracted from `apartx-admin` so it can be shared across ApartX front-ends.
There is **no build step**: consumers compile the raw `.svelte`/`.ts` sources
through their own bundler. `package.json` `exports` point straight at
`src/lib/**`. A SvelteKit demo lives in `src/routes`.

## Documentation index

- [README.md](README.md) — component catalog, Navigator contract example
- [docs/consuming.md](docs/consuming.md) — wiring the kit into a new SvelteKit/Vite consumer (submodule, aliases, deps, Tailwind, theme)
- [docs/agents/README.md](docs/agents/README.md) — agent playbooks: catalog, operator guide, launch prompt template
- [docs/agents/build-ota.md](docs/agents/build-ota.md) — agent playbook: build an OTA booking site on the ApartX public API with this kit
- [docs/agents/build-pms.md](docs/agents/build-pms.md) — agent playbook: build a landlord PMS dashboard (calendar, ARI, bookings) on the ApartX Landlord API with this kit
- [History.md](History.md) — release notes per version

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
- **No product knowledge** (the 0.10.0 boundary, README § Scope). The kit ships
  mechanisms — modal registry, link registry, toast host, chat engine — and the
  host supplies meaning. Nothing in `src/lib` may know a help-article protocol, a
  support channel, a booking/property, a push-permission policy or an app's
  link types; those live in a product layer on top of the kit and reach the kit
  through registries, snippets and slot context. Gate:
  `rg -n "resolveErrorHelp|helpUrl|articleId|pushGuideKey|onContactSupport|chat\.booking|tenantUserId|landlordUserId" src/lib -g '!*.test.*'`
  must print nothing (tests may use such words as sample data).
- **SvelteKit carve-out for the router.** The kit stays framework-agnostic, but
  `apartx-ui/router/sveltekit` ships a `svelteKitHistoryAdapter` for SvelteKit hosts.
  `src/lib/router/sveltekit.ts` is the **only** *runtime* file allowed to import `$app/*`;
  the core `apartx-ui/router` barrel must never import it. `src/lib/router/sveltekit.test.ts`
  is an accepted exception — it mocks `$app/navigation`/`$app/state` to unit-test the
  adapter's guards, which legitimately requires naming those specifiers. Gate:
  `rg "\$app/" src/lib | rg -v "src/lib/router/sveltekit\.(ts|test\.ts)"` must print nothing.
- **All user-facing text is a prop with an English default** so consumers
  translate at the call site.
- **Navigation is router-agnostic** — the kit never owns routing/history. Hosts
  adapt their router to the `Navigator` contract (`apartx-ui/navigation`,
  `setNavigator`/`getNavigator`); nav-aware components (`<Link>`, …) consume it
  and fall back to native `<a href>`. `<PageTransition>` animates view changes
  without owning routing. Never re-add a hard router dependency to `src/lib`.
- **Callback prop naming** (keep new components consistent with these):
  - **State change** → `on<Thing>Change(value)` — matches bits-ui
    (`onOpenChange`, `onValueChange`, `onSnapChange`, `onCameraChange`,
    `onBreakChange`, `onPerPageChange`, …). Use this for "X became Y".
  - **Lifecycle / animated transitions** → `onWill<Event>` / `onDid<Event>`
    (iOS-style): `onWillPresent`/`onDidPresent`, `onWillDismiss`/`onDidDismiss`.
    `will` = the transition is starting (content still on screen); `did` = it
    has finished (e.g. fully closed & unmounted). Overlays (`CupertinoPane`,
    `BottomSheet`) share these exact names. Do **not** invent `onClosing`/
    `onOpened`/etc. for the same concept.
  - **Discrete actions** → `on<Event>` imperative: `onClick`, `onSelect`,
    `onConfirm`, `onCancel`, `onBackdropTap`, `onPickMarker`, `onLoadMore`.
  - Renaming a callback prop on an **already-released** component is a breaking
    change for `apartx-admin`/`apartx-cabinet` — normalize new components up
    front; don't sweep-rename shipped ones without updating every consumer.
- **Barrels:** every category has an `index.ts`; the root `src/lib/index.ts`
  re-exports all categories. Keep new components exported from both.
- **Internal imports:** `cn` from `'../utils/cn'`; cross-category components by
  relative `.svelte` path (e.g. `'../display/Icon.svelte'`).
- `bits-ui`, `svelte`, `svelte-fa` are peer deps — never bump independently of
  consumers; a duplicate `bits-ui` breaks overlay context.

### Плотность модалок

`Dialog` объявляет плотность тела пропом `layout`:

- `layout="form"` (дефолт) — тело с отступами, для форм и текста: `px-4 py-3 sm:px-6 sm:py-4`.
- `layout="list"` — тело без боковых отступов: край держит `Item` (`px-4`), поэтому строки
  и разделители идут во всю ширину.
- `layout="flush"` — тело без отступов вовсе: содержимое во всю площадь (iframe, карта,
  канвас, медиа). `dialogBodyClass` возвращает пустую строку, а не `p-0`.

Значения адаптивные: на узком экране 16px, с `sm` — 24px. Шапка `Dialog` выровнена с
`Toolbar` (16px на узком экране), так что заголовок и содержимое стоят по одной линии.

Прикладной код **не пишет `bodyClass="p-0"`** и не задаёт собственных боковых отступов
телу модалки — вместо этого объявляет подходящий `layout`. `bodyClass` остаётся аварийным
люком для нестандартных случаев (встроенный редактор, карта во всю площадь).

Занулить отступы руками **нельзя**, и это не вопрос вкуса: `cn` — это tailwind-merge, а он
разрешает конфликты только внутри одного набора модификаторов. `p-0` вычищает `px-4 py-3` и
не трогает `sm:px-6 sm:py-4`, а в CSS вариант идёт после базовой утилиты и побеждает — итог
ровно обратный задуманному: модалка теряет отступы на мобилке и молча держит 24px на
десктопе. `!p-0` «работает» лишь потому, что побеждает `!important`ом в каскаде, ничего не
вычищая из мержа. Поэтому `dialogBodyClass('flush')` возвращает пустую строку: дефолт не
подмешивается вовсе, и конфликтовать нечему.

### Safe-area: инсет забирает контейнер у края

Кордова-хост кладёт высоту статус-бара и home indicator в `--safe-area-inset-top/bottom` на
`<html>`. Отступает на инсет контейнер, который касается края экрана, и обнуляет переменную
своим прямым детям:

- `Page` — сверху, по унаследованной переменной; полоску под статус-баром красит цветом
  `surface`;
- панель `Dialog` с `fullScreen` — сверху и снизу;
- панель `Drawer` — сверху и снизу.

Панели оверлеев привязаны к вьюпорту и берут корневые копии `--safe-area-root-top/bottom`
(`styles/tokens.css`): `Drawer` не портируется и внутри `Page` унаследовал бы ноль.

`Header`, `Toolbar`, `Footer` внутри контейнера видят 0; вне контейнера отступают сами.

Правила для прикладного кода:

- Каждый экран — `Page`. Шапка экрана живёт внутри `Page`, а не над ним, иначе отступят оба.
- Вертикальный `padding` контейнеру (`Page`, `contentClass` полноэкранного `Dialog`, `class`
  у `Drawer`) классом не задают: утилиты инсета идут в `cn` последними и перебьют его.
  Отступ делают на дочернем элементе. `p-0` при этом безопасен.
- `edgeToEdge` у `Dialog` — для содержимого, которое красит область под статус-баром своим
  фоном (iframe со своей шапкой, получающий инсет параметром; камера). Панель сверху не
  отступает, дети видят настоящий инсет и отступ контента делают сами. Без пропа над таким
  содержимым осталась бы полоска цвета панели.
- Свой `fixed`-оверлей внутри контейнера отступает по `--safe-area-root-top`, а не по
  `--safe-area-inset-top`.
- Абсолютно позиционированный у верха элемент внутри `Page` отступом не защищён.

Константы утилит — `ui/utils/safe-area.ts`; в `cn` они всегда последние. Tailwind хоста
обязан сканировать `.ts` кита, иначе утилиты не сгенерируются.

## Versioning

Consumers pin to a commit via submodule. Use `main` for active development;
tag stable releases so `apartx-admin`/`apartx-cabinet`/`apartx-spaces` don't
drift apart.

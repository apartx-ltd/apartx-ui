# История изменений — apartx-ui

## 2026-06-08

### Версия 0.1.5

Bottom-sheet поверх карты: тёма/z-index/острые углы `CupertinoPane`, хуки камеры карты и брейка шторки.

### Добавлено

* **`MapView` — `onCameraChange({ center, zoom })`.** Дёргается в конце жеста пана/зума (Yandex: `YMapListener.onActionEnd`, Google: `idle`). Для персиста позиции карты (например, в URL). `setCenter`-эффект `MapView` получил epsilon-guard, чтобы запись камеры обратно в пропы не пере-применяла ту же позицию и не зацикливалась.
* **`CupertinoPane` — `onBreakChange(break)`.** Отдаёт брейк (`top`/`middle`/`bottom`), вычисленный по реальной позиции (`getPanelTransformY()` против `breakpoints.breaks`), а не через библиотечный `currentBreak()`, который рассинхронизируется. Дёргается на drag/transition-settle.
* **`CupertinoPane` — `squareCornersAtTop`.** На верхнем брейке верхние углы шторки становятся острыми (0), на остальных — скруглённые. Завязано на позицию (`getPanelTransformY`), не на ненадёжный `currentBreak()`; обновляется на `onDrag`/`onDragEnd`/`onTransitionEnd`/`onDidPresent` + trailing-таймер (библиотечный `transitionend` на drag-snap ненадёжен — браузерный баг). Проброшен `onDrag` как pass-through проп.

### Изменено

* **`CupertinoPane` — тема и z-index по токенам кита.** Фон/текст/хэндл/destroy-кнопка маппятся на M3-токены (`--color-surface-container`/`-on-surface`/…), шторка следует светлой/тёмной теме приложения вместо хардкод-белого. `.pane`/`.backdrop` подняты в overlay-диапазон кита (z-50/z-40), чтобы шторка была над page-chrome (FAB z-20, контролы карты z-10).

## 2026-06-08

### Версия 0.1.4

Провайдер-независимые контролы карты (kit-rendered M3), escape-hatch для нативных опций, фиксы темы хрома и загрузки кластеризатора.

### Добавлено

* **`MapView` — провайдер-независимые контролы.** Проп `controls: boolean | { attribution, zoom, geolocation, scale, layer }` (общий резолвер `providers/controls.ts`). `attribution`/`scale` — нативные пассивные (Yandex `copyrights`/`YMapScaleControl`, Google `disableDefaultUI`/`scaleControl`); `zoom`/`geolocation`/`layer` — **kit-rendered M3-кнопки** (`maps/controls/`), которые дёргают карту через новый императивный API `MapHandle` (`zoomIn`/`zoomOut`, `getLayer`/`setLayer`/`availableLayers`). Geolocation — на стороне кита через `navigator.geolocation` → `setCenter`, нативный контрол не нужен. `availableLayers()` отдаёт только поддержанные провайдером типы (Yandex map/satellite, Google map/satellite/hybrid) — свитчер не предлагает врущих тогглов. Inline-SVG в кнопках (кит по дизайну не тянет icon-сеты).
* **`MapView` — `controlsPosition`** (`top-left|top-right|bottom-left|bottom-right`, дефолт `bottom-right`) для оверлея контролов.
* **`MapViewOptions.providerOptions`** — escape-hatch для нативных опций провайдера без кросс-провайдерного аналога, по ключу провайдера (`{ yandex: {…}, google: {…} }`); применяется подобъект активного провайдера, мержится в нативную карту последним (перекрывает нормализованные пропы).

### Изменено

* **`MapProviderName`** — единый источник в `providers/types.ts` (раньше дублировался в `providers/index`), ре-экспорт сохранён.
* **Google-провайдер** — симметрия с Yandex: нормализованные `controls`/`scale`/`layer` (`mapType`)/`zoom`.
* **`MapConfig`** — обновляет поля `config` гранулярно, а не заменяет объект целиком: смена темы больше не инвалидирует читателей `apiKey`/`lang`/`mapId`, поэтому `MapView` ретинтит карту на месте, а не пересоздаёт её (пересоздание переподключало кластеризатор и роняло маркеры на каждый тоггл темы).

### Исправлено

* **Тема хрома `YMap`.** Тема задавалась только слою тайлов (`YMapDefaultSchemeLayer`), а копирайт/distribution/контролы остаются на теме самого `YMap` — в dark-mode хром оставался светлым (белый фон кнопки) и наследовал белый текст приложения → «Открыть Яндекс Карты» белым по белому. Тема теперь прокидывается и в `YMap` (и обновляется в `setTheme`).
* **Загрузка кластеризатора Yandex.** `ymaps3.import` без зарегистрированных loader'ов падал с `no loader for pkg @yandex/ymaps3-clusterer` (молчаливый деград на plain-маркеры). Перед импортом регистрируется CDN (`ymaps3.import.registerCdn`) и используется версионированный пакет `@yandex/ymaps3-clusterer@0.0.1`.

## 2026-06-07

### Версия 0.1.3

`VirtualList` — восстановление позиции скролла по `name`; пресет `ChatList` переименован в `MessagesList`.

### Добавлено

* **`VirtualList` — restore скролла через проп `name`.** По аналогии с `<Content name=…>`: задан `name` → позиция запоминается/восстанавливается между ремаунтами (например, навигация туда-обратно), `name` служит ключом в module-scoped `Map`. Для виртуального списка наивный `scrollTop` неточен (в DOM только видимые строки), поэтому сохраняем virtua `CacheSnapshot` (измеренные высоты) + offset: высоты восстанавливаем через `cache`-проп `VList` (блок `{#key name}` пересоздаёт список с нужным кэшем), offset — через `scrollTo` после маунта с retry до 12 кадров (virtua подключает скроллер на кадр позже и клампит, пока высоты не устаканятся) и подавлением сохранений на время restore. Без `name` поведение прежнее. Экспортирован `clearVirtualScroll(name)`.

### Изменено

* **Пресет `ChatList` → `MessagesList`.** Имя вводило в заблуждение: компонент — пресет для ленты *сообщений* (stick-to-bottom), а не списка чатов. Файл, barrel-экспорт (`apartx-ui/virtual`) и JSDoc обновлены. Консьюмеров `ChatList` не было.

## 2026-06-05

### Версия 0.1.2

`Toolbar` разносит элементы по умолчанию; длинные опции `Select` переносятся.

### Изменено

* **`Toolbar` — отступ и перенос между элементами из коробки.** Контейнер children получил `flex-wrap` + `gap-2`: раньше у него не было `gap`, и любой `gap-*`, переданный на сам `Toolbar` через `class`, на расстояние между детьми не влиял (разносил только `start | children | end`) — из-за чего несколько элементов слипались. Добавлены escape-hatch пропсы `startClass`/`contentClass`/`endClass` для точечного переопределения обёрток слотов (например `contentClass="gap-4"`).
* **`Select` — перенос длинных опций.** Пункты выпадающего списка (`min-w-0 break-words`, выравнивание по верху) переносятся на вторую строку вместо обрезки — длинные значения без пробелов (`lock_renew_subscription_agent_reward`) больше не вылезают за ширину панели.

## 2026-06-03

### Версия 0.1.1

Адаптивная пагинация для мобильных экранов.

### Изменено

* **`Pagination` — responsive-вёрстка.** На узких экранах (`< sm`) компонент раскладывается в 3 центрированные строки: счётчик `1–10 of 308` → «Rows per page» → навигация. Числовой ряд страниц на мобиле компактный (первая … текущая … последняя, новый `pageItemsMobile`), полная нумерация — на `sm+`. Порядок строк управляется `order`-классами, разметка кнопок страниц вынесена в сниппет `pager` (без дублирования mobile/desktop). API не изменился.

import { getContext } from 'svelte';
import { getHistory } from '../history/registry';
import { setRouteBack } from './active-route';
import { ROUTER_LOCATION_CTX, type RouterLocationSource } from './location-source';
import { goBack, currentHasParent } from './back';
import { navigate } from './nav';
import { resolveNavTarget } from './nav-config';
import { getInitialLocation, type RouterLocation } from './context';

type Action = 'forward' | 'back' | 'none';

interface RouterState extends RouterLocation {
  action: Action;
}

const isBrowser = typeof window !== 'undefined';

function snapshot(seed: RouterLocation | null): RouterState {
  // Client: read the live browser location. Server: use the seeded initial
  // location from context (never window). Falls back to '/' if neither exists.
  const loc = isBrowser ? getHistory().location : seed;
  return {
    pathname: loc?.pathname ?? '/',
    search: loc?.search ?? '',
    hash: loc?.hash ?? '',
    action: getHistory().action,
  };
}

/**
 * SSR-safe router hook. On the server the first snapshot comes from the
 * context-seeded `url` (App.svelte); on the client it reads `window` and
 * subscribes to history changes for SPA navigation.
 */
export function useRouter() {
  // Внутри <VirtualRouter> путь и переходы берутся из его источника (путь из фрагмента).
  const source = getContext<RouterLocationSource | undefined>(ROUTER_LOCATION_CTX);
  if (source) return fromSource(source);
  return realRouter();
}

function realRouter() {
  const seed = getInitialLocation();
  const state = $state<{ current: RouterState }>({ current: snapshot(seed) });

  $effect(() => {
    // Effects only run on the client — safe to attach the history listener here.
    const unsubscribe = getHistory().listen(() => {
      state.current = snapshot(seed);
    });
    return () => unsubscribe?.();
  });

  return {
    get current() {
      return state.current;
    },
    get pathname() {
      return state.current.pathname;
    },
    get action() {
      return state.current.action;
    },
    push(url: string, opts?: { action?: Action; keepOverlays?: boolean; root?: boolean; force?: boolean; origin?: string }) {
      // Через navigate() — overlay-aware (вариант A). Прямой history.push при открытом
      // оверлее кладёт запись ПОВЕРХ синтетической, а guarded back закрывающегося
      // оверлея тут же её съедает: страница отрисована, URL откатился. navigate()
      // закрывает оверлеи и заменяет их верхнюю запись назначением; `action`
      // по-прежнему доходит до history на пути без оверлеев.
      navigate(url, opts);
    },
    replace(url: string, opts?: { action?: Action; root?: boolean; force?: boolean; origin?: string }) {
      // Сознательно НЕ overlay-aware: replace поверх открытого оверлея — легитимный
      // паттерн (spaces: property из шторки карты замещает её синтетическую запись,
      // шторка живёт в survival store). Автозакрытие оверлеев здесь сломало бы его.
      // origin — только для resolveNavTarget; в опции записи истории не идёт.
      const { origin, ...hOpts } = opts ?? {};
      const location = getHistory().location;
      if (!location) { getHistory().replace(url, hOpts); return; }
      const to = resolveNavTarget(url, { ...location, origin });
      if (to === null) return;
      getHistory().replace(to, hOpts);
    },
    back(href?: string) {
      // Есть куда вернуться в текущем стеке — всегда history-back (страница ИЛИ закрытие
      // оверлея), href не трогаем. Некуда (холодный заход, диплинк-корень) — href, если
      // дан, заменой текущей записи с обратным транзишеном; без href — <Route back>.
      // Раньше href-форма пушила href всегда и «назад» никогда не шёл по истории.
      if (href && !getHistory().canGoBack) {
        getHistory().replace(href, { action: 'back' });
        return;
      }
      goBack();
    },
    goBack() {
      goBack();
    },
    get currentHasParent() {
      return currentHasParent();
    },
    setRouteBack(v: string | null) {
      setRouteBack(v);
    },
    /** Полный адрес для DOM-href; у реального роутера путь и есть адрес. */
    resolveHref(url: string) {
      return url;
    },
  };
}

/** Тот же объект, что у реального роутера, поверх источника пути VirtualRouter. */
function fromSource(source: RouterLocationSource): ReturnType<typeof realRouter> {
  return {
    get current() {
      return source.current;
    },
    get pathname() {
      return source.current.pathname;
    },
    get action() {
      return source.current.action;
    },
    push: (url, opts) => source.push(url, opts),
    replace: (url, opts) => source.replace(url, opts),
    back: (href) => source.back(href),
    goBack: () => source.goBack(),
    get currentHasParent() {
      return source.currentHasParent;
    },
    setRouteBack: (v) => source.setRouteBack(v),
    resolveHref: (url) => source.resolveHref(url),
  };
}

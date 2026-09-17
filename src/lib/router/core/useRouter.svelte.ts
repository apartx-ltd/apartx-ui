import { getHistory } from '../history/registry';
import { goBack, currentHasParent } from './back';
import { navigate } from './nav';
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
    push(url: string, opts?: { action?: Action; keepOverlays?: boolean; root?: boolean }) {
      // Через navigate() — overlay-aware (вариант A). Прямой history.push при открытом
      // оверлее кладёт запись ПОВЕРХ синтетической, а guarded back закрывающегося
      // оверлея тут же её съедает: страница отрисована, URL откатился. navigate()
      // закрывает оверлеи и заменяет их верхнюю запись назначением; `action`
      // по-прежнему доходит до history на пути без оверлеев.
      navigate(url, opts);
    },
    replace(url: string, opts?: { action?: Action; root?: boolean }) {
      // Сознательно НЕ overlay-aware: replace поверх открытого оверлея — легитимный
      // паттерн (spaces: property из шторки карты замещает её синтетическую запись,
      // шторка живёт в survival store). Автозакрытие оверлеев здесь сломало бы его.
      getHistory().replace(url, opts);
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
  };
}

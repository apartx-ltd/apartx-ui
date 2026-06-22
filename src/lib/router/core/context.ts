import { getContext, setContext, type Snippet } from 'svelte';
import type { RouteLoader } from './lazy';

export interface RouterLocation {
  pathname: string;
  search: string;
  hash: string;
}

const KEY = Symbol('router-location');

/**
 * Seed the initial location for SSR. Called once by App.svelte with the value
 * derived from its `url` prop (server) or `window.location` (client). Because it
 * is set via Svelte context, the value is scoped to a single component tree /
 * single SSR render — there is no module-level mutable state that could leak
 * between concurrent server requests.
 */
export function setInitialLocation(loc: RouterLocation): void {
  setContext(KEY, loc);
}

/** Read the seeded initial location, or null if App did not provide one. */
export function getInitialLocation(): RouterLocation | null {
  return (getContext(KEY) as RouterLocation | undefined) ?? null;
}

/** Контекст-ключ для связи Router ↔ дочерние Route. */
export const ROUTER_CTX = Symbol('apartx-router');

export interface RouteRecord {
  path: string;
  exact?: boolean;
  /** Eager-импортированный компонент страницы (синхронный рендер для SSR/SEO). */
  component?: any;
  /**
   * Ленивый загрузчик чанка страницы: `() => import('./Page.svelte')`. Альтернатива
   * `component` для code-splitting. <Router> рендерит `loading`-сниппет на первом
   * визите, затем кэширует компонент (см. ./lazy) — повторные визиты и back/forward
   * синхронны, без мелькания. На ошибке загрузки рендерит `error`-сниппет.
   */
  loader?: RouteLoader;
  /** Альтернатива component: inline-сниппет `{#snippet}` с params. */
  snippet?: Snippet<[Record<string, string>]>;
  /** Доп. пропсы, прокинутые в component. */
  props?: Record<string, any>;
  /**
   * Стабильный transition-key. Если задан у активного роута, внешний `PageTransition`
   * ключуется ИМ (а не pathname) — так переключение табов внутри shell НЕ ре-анимирует
   * внешний outlet. Иначе key = pathname (детальные экраны анимируются как обычно).
   */
  stableKey?: string;
  /**
   * Обратный opt-out для `<Router keyByMatch>`: на этом роуте вернуть keying по
   * pathname (ремаунт на каждый URL), хотя весь роутер ключуется по матчу. Нужен
   * параметрическим detail-роутам (`:id`), которым важен свежий mount на каждый id.
   * Без `keyByMatch` не имеет эффекта. Игнорируется, если задан `stableKey`.
   */
  volatileKey?: boolean;
  /**
   * Внутренний: стабильный id записи, выдаётся `<Router>` при регистрации. Под
   * `keyByMatch` служит transition-key (идентичность выигравшего роута), поэтому
   * два сиблинга с одинаковым `path` (exact-список + prefix-switch) не коллизятся.
   * Не задаётся снаружи.
   */
  _recordId?: string;
  /**
   * Логический родитель для «назад» при cold deep-link-входе (нет истории внутри
   * приложения). Строка-путь или функция от params (когда родитель параметризован,
   * напр. payment → /bookings/:bookingId). Используется router.back()/видимостью
   * нативной кнопки только когда canGoBack === false.
   */
  back?: string | ((params: Record<string, string>) => string);
}

export interface RouterContextValue {
  /** base этого роутера (вложенный наследует родительский). */
  base: string;
  register: (r: RouteRecord) => void;
  unregister: (r: RouteRecord) => void;
}

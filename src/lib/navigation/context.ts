import { getContext, setContext } from 'svelte';

/**
 * Router-agnostic navigation for the UI Kit.
 *
 * The kit never owns routing/history. Instead a host adapts its router to this
 * `Navigator` contract and injects it once near the root via `setNavigator`.
 * Nav-aware components (`<Link>`, and later `<BackButton>`/`<NavTabs>`/…) consume
 * it through `getNavigator`. When no navigator is provided, components degrade
 * gracefully (e.g. `<Link>` falls back to native `<a href>`).
 */

export interface RouteSnapshot {
  pathname: string;
  search: string;
  hash: string;
}

export interface Navigator {
  /** Navigate to `href`, pushing a history entry. */
  push(href: string): void;
  /** Navigate to `href`, replacing the current history entry. */
  replace(href: string): void;
  /**
   * Go back. With no argument, pops one history entry (native back). With an
   * `href`, navigates there but still plays the *backward* view transition —
   * for "up to parent" buttons whose target may not be the previous entry
   * (e.g. a deep-linked detail page with no list behind it).
   */
  back(href?: string): void;
  /** Reactive snapshot of the current location. */
  readonly current: RouteSnapshot;
  /** Whether `href` matches the current location (prefix match unless `exact`). */
  isActive(href: string, opts?: { exact?: boolean }): boolean;
}

/** Per-instance navigation override accepted by `<Link navigate={…}>`. */
export type LinkNavigate = (href: string, opts?: { replace?: boolean }) => void;

const NAVIGATOR_KEY = Symbol('apartx-ui:navigator');

/** Call during component init (e.g. a root layout) to wire the kit to your router. */
export function setNavigator(navigator: Navigator): void {
  setContext(NAVIGATOR_KEY, navigator);
}

/** Read the injected navigator, if any. Returns `undefined` when none was provided. */
export function getNavigator(): Navigator | undefined {
  return getContext<Navigator | undefined>(NAVIGATOR_KEY);
}

const ROUTE_KEY = Symbol('apartx-ui:route-key');

/** Reactive accessor for the current route's scroll key (e.g. the pathname). */
export type RouteKeyGetter = () => string | undefined;

/**
 * Provide the current route key near the root (e.g. in the router's switch),
 * so scroll-aware components like `<Content>` can remember/restore scroll per
 * route without every page passing an explicit `name`. Pass a getter so the
 * value stays reactive as navigation happens.
 */
export function setRouteKey(get: RouteKeyGetter): void {
  setContext(ROUTE_KEY, get);
}

/** Read the route-key getter, if a host provided one. */
export function getRouteKey(): RouteKeyGetter | undefined {
  return getContext<RouteKeyGetter | undefined>(ROUTE_KEY);
}

/**
 * Default `isActive` matcher — useful when writing a custom `Navigator`.
 * Prefix-matches by path segment so `/users` is active on `/users/42`.
 */
export function matchActive(
  current: string,
  href: string,
  opts?: { exact?: boolean },
): boolean {
  const a = current.replace(/\/+$/, '') || '/';
  const b = href.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
  if (opts?.exact) return a === b;
  if (b === '/') return a === '/';
  return a === b || a.startsWith(b + '/');
}

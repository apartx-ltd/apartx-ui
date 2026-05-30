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
  /** Go back one history entry. */
  back(): void;
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

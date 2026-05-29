import { getContext, setContext } from 'svelte';

/**
 * Router-agnostic navigation for `<Link>`.
 *
 * The UI Kit must not depend on any app's router. Instead, a consumer injects a
 * navigate function once near the root of its Svelte tree via `setLinkNavigate`
 * (or per-instance via the `navigate` prop on `<Link>`). When no navigator is
 * provided, `<Link>` falls back to native `<a href>` navigation.
 */
export type LinkNavigate = (href: string, opts?: { replace?: boolean }) => void;

const LINK_NAVIGATE_KEY = Symbol('apartx-ui:link-navigate');

/** Call during component init (e.g. a root layout) to wire the kit's `<Link>` to your router. */
export function setLinkNavigate(navigate: LinkNavigate): void {
  setContext(LINK_NAVIGATE_KEY, navigate);
}

/** Read the injected navigator, if any. Returns `undefined` when none was provided. */
export function getLinkNavigate(): LinkNavigate | undefined {
  return getContext<LinkNavigate | undefined>(LINK_NAVIGATE_KEY);
}

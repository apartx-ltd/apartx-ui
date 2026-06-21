// projects/apartx-ui/src/lib/router/index.ts
// Engine
export { useRouter } from './core/useRouter.svelte';
export { default as Router } from './core/Router.svelte';
export { default as Route } from './core/Route.svelte';
export { default as Link } from './core/Link.svelte';
export { navigate, link } from './core/nav';
export { goBack, canGoBack, currentHasParent } from './core/back';
export {
  setInitialLocation, ROUTER_CTX,
  type RouterLocation, type RouteRecord, type RouterContextValue,
} from './core/context';
export {
  matchRoute, matchParams, pick, rankRoute, stripBase, type MatchOptions,
} from './core/match-route';
export { setRouteBack, getRouteBack, subscribeRouteBack } from './core/active-route';
export type { RouteLoader } from './core/lazy';

// History seam
export type { HistoryAdapter, Action } from './history/adapter';
export { browserHistoryAdapter } from './history/browser';
export { setHistoryAdapter, getHistory } from './history/registry';

// Overlay
export {
  createOverlayStack, type OverlayStack,
  overlayCount, subscribeOverlay, openOverlay, closeOverlay, initOverlayStack,
} from './overlay/overlay-stack';

// Navigator binding
export { createNavigatorFromRouter } from './navigator';

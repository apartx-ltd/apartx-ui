export {
  setNavigator,
  getNavigator,
  matchActive,
  setRouteKey,
  getRouteKey,
  setBackVisibility,
  getBackVisibility,
  setHostChrome,
  getHostChrome,
  type Navigator,
  type RouteSnapshot,
  type LinkNavigate,
  type RouteKeyGetter,
  type BackVisibilityGetter,
  type HostChrome,
} from './context';
export { default as PageTransition } from './PageTransition.svelte';
export type SlideStyle = 'auto' | 'ios' | 'shared-axis';

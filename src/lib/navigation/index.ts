export {
  setNavigator,
  getNavigator,
  matchActive,
  setRouteKey,
  getRouteKey,
  setBackVisibility,
  getBackVisibility,
  type Navigator,
  type RouteSnapshot,
  type LinkNavigate,
  type RouteKeyGetter,
  type BackVisibilityGetter,
} from './context';
export { default as PageTransition } from './PageTransition.svelte';
export type SlideStyle = 'auto' | 'ios' | 'shared-axis';

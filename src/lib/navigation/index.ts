export {
  setNavigator,
  getNavigator,
  matchActive,
  setRouteKey,
  getRouteKey,
  type Navigator,
  type RouteSnapshot,
  type LinkNavigate,
  type RouteKeyGetter,
} from './context';
export { default as PageTransition } from './PageTransition.svelte';
export type SlideStyle = 'auto' | 'ios' | 'shared-axis';

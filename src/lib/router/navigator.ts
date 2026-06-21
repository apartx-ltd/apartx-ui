// projects/apartx-ui/src/lib/router/navigator.ts
import type { Navigator } from '../navigation/context';
import { matchActive } from '../navigation/context';
import type { useRouter } from './core/useRouter.svelte';

type Router = ReturnType<typeof useRouter>;

/**
 * Build the kit `Navigator` from the router engine, removing the per-method
 * wrapping boilerplate. The consumer injects it explicitly:
 *   setNavigator(createNavigatorFromRouter(router));
 *   setRouteKey(() => router.pathname);
 */
export function createNavigatorFromRouter(router: Router): Navigator {
  return {
    push: (href) => router.push(href),
    replace: (href) => router.replace(href),
    back: (href) => router.back(href),
    get current() {
      const c = router.current;
      return { pathname: c.pathname, search: c.search, hash: c.hash };
    },
    isActive: (href, opts) => matchActive(router.pathname, href, opts),
  };
}

<script>
  import { cn } from '../utils/cn';
  import { scrollRestore } from '../utils/scroll-restore';
  import { getRouteKey } from '../../navigation/context';

  // `name` is a logical scroll key (NOT the DOM id): when set, the scroll
  // position is remembered and restored when this screen is revisited (e.g. on
  // back navigation). Kept separate from `id` so it never leaks to the DOM or
  // hits the duplicate-id hazard while two pages overlap during a transition.
  // When `name` is omitted, fall back to the route key a host may have provided
  // via `setRouteKey` — so scroll-restore works per route without every page
  // wiring it explicitly.
  let { children, name, padding = false, class: className, ...restProps } = $props();

  const routeKey = getRouteKey();
  const scrollKey = $derived(name ?? routeKey?.());
</script>

<main
  class={cn(
    'flex-1 overflow-y-auto overflow-x-hidden relative',
    padding && 'p-4',
    className
  )}
  use:scrollRestore={scrollKey}
  {...restProps}
>
  {@render children()}
</main>

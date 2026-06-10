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
  let { children, name, padding = false, class: className, onscroll, ...restProps } = $props();

  const routeKey = getRouteKey();
  const scrollKey = $derived(name ?? routeKey?.());

  // Hide the native scrollbar until the first scroll, then resume native
  // behaviour. Browsers flash their default scrollbar whenever a scroller's
  // content size changes (first paint / async content) and it lingers until the
  // user interacts — visually noisy. Same treatment as the kit VirtualList.
  let scrolled = $state(false);
</script>

<main
  class={cn(
    'flex-1 overflow-y-auto overflow-x-hidden relative',
    !scrolled && 'no-scrollbar',
    padding && 'p-4',
    className
  )}
  onscroll={(e) => {
    scrolled = true;
    onscroll?.(e);
  }}
  use:scrollRestore={scrollKey}
  {...restProps}
>
  {@render children()}
</main>

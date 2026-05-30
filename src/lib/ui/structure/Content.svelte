<script>
  import { cn } from '../utils/cn';
  import { scrollRestore } from '../utils/scroll-restore';

  // `name` is a logical scroll key (NOT the DOM id): when set, the scroll
  // position is remembered and restored when this screen is revisited (e.g. on
  // back navigation). Kept separate from `id` so it never leaks to the DOM or
  // hits the duplicate-id hazard while two pages overlap during a transition.
  let { children, name, padding = false, class: className, ...restProps } = $props();
</script>

<main
  class={cn(
    'flex-1 overflow-y-auto overflow-x-hidden relative',
    padding && 'p-4',
    className
  )}
  use:scrollRestore={name}
  {...restProps}
>
  {@render children()}
</main>

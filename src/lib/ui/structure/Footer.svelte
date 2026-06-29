<script>
  import { cn } from '../utils/cn';

  let { children, class: className, ...restProps } = $props();
</script>

<!-- Bottom action-bar container. `pb-[var(--safe-area-inset-bottom)]` reserves the bottom
     safe-area inset (home indicator / gesture bar); `[--kit-safe-top:0px]` zeroes that var so a
     <Toolbar> nested in a footer doesn't add a top inset there. On web the inset var is unset
     → 0. A centered <Dialog> zeroes --safe-area-inset-bottom for its subtree. -->
<footer
  class={cn(
    'flex-shrink-0 bg-surface z-10 pb-[var(--safe-area-inset-bottom,0px)] [--kit-safe-top:0px]',
    className
  )}
  {...restProps}
>
  {@render children()}
</footer>

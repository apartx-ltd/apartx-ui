<script>
  import { cn } from '../utils/cn';
  import { safeBottomStrip } from '../utils/safe-area';

  let { children, class: className, ...restProps } = $props();
</script>

<!-- Bottom action-bar container. `pb-[var(--safe-area-inset-bottom)]` reserves the bottom
     safe-area inset (home indicator / gesture bar); `[--kit-safe-top:0px]` zeroes that var so a
     <Toolbar> nested in a footer doesn't add a top inset there. On web the inset var is unset
     → 0. A centered <Dialog> zeroes --safe-area-inset-bottom for its subtree.
     Внутри контейнера (Page, панель Dialog/Drawer) инсет забирает контейнер, футер видит 0 и
     докрашивает полоску под собой своим фоном (safeBottomStrip) — AGENTS.md → «Safe-area». -->
<footer
  class={cn(
    'flex-shrink-0 bg-surface z-10 pb-[var(--safe-area-inset-bottom,0px)] [--kit-safe-top:0px]',
    safeBottomStrip,
    className
  )}
  {...restProps}
>
  {@render children()}
</footer>

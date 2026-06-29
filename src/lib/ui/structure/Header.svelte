<script>
  import { cn } from '../utils/cn';

  let { children, class: className, ...restProps } = $props();
</script>

<!-- Top app-bar container. The scoped style reserves the top safe-area inset (status
     bar / notch) and zeroes --kit-safe-top for the subtree so a nested <Toolbar> — which
     also consumes the inset — doesn't double it. On web the inset var is unset → 0. A
     centered <Dialog> zeroes --safe-area-inset-top for its subtree, so a Header inside a
     centered card stays flush. -->
<header
  class={cn(
    'shrink-0 bg-surface z-10',
    className
  )}
  {...restProps}
>
  {@render children()}
</header>

<style>
  header {
    padding-top: var(--safe-area-inset-top, 0px);
    --kit-safe-top: 0px;
  }
</style>

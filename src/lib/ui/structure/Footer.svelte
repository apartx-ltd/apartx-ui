<script>
  import { cn } from '../utils/cn';

  let { children, class: className, ...restProps } = $props();
</script>

<!-- Bottom action-bar container. The scoped style reserves the bottom safe-area inset
     (home indicator / gesture bar); it also zeroes --kit-safe-top so a <Toolbar> nested
     in a footer doesn't add a top inset there. On web the inset var is unset → 0. A
     centered <Dialog> zeroes --safe-area-inset-bottom for its subtree. -->
<footer
  class={cn(
    'flex-shrink-0 bg-surface z-10',
    className
  )}
  {...restProps}
>
  {@render children()}
</footer>

<style>
  footer {
    padding-bottom: var(--safe-area-inset-bottom, 0px);
    --kit-safe-top: 0px;
  }
</style>

<script>
  import { cn } from '../utils/cn';

  let { children, start, end, class: className, startClass, contentClass, endClass, ...restProps } = $props();
</script>

<div
  class={cn(
    'kit-toolbar flex items-center gap-2 ps-4 pe-2 min-h-14',
    className
  )}
  {...restProps}
>
  {#if start}
    <div class={cn('shrink-0 flex items-center -ms-2 empty:hidden', startClass)}>{@render start()}</div>
  {/if}

  <div class={cn('flex-1 flex flex-wrap items-center gap-2 min-w-0', contentClass)}>
    {@render children()}
  </div>

  {#if end}
    <div class={cn('shrink-0 flex items-center', endClass)}>
      {@render end()}
    </div>
  {/if}
</div>

<style>
  /* The toolbar consumes the top safe-area inset (status bar / notch). --kit-safe-top
     defaults to the real inset; <Header>/<Footer> set it to 0 for their subtree so a
     Toolbar nested in them doesn't double the inset (they reserve it themselves). A
     centered <Dialog> zeroes --safe-area-inset-top, collapsing this to 0. On web both
     vars are unset → 0. :global because the class is applied via cn() (not a literal),
     so Svelte's scoped-CSS pruning would otherwise drop the rule. */
  :global(.kit-toolbar) {
    padding-top: var(--kit-safe-top, var(--safe-area-inset-top, 0px));
  }
</style>

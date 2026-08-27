<script>
  import { cn } from '../utils/cn';

  let { children, start, end, class: className, startClass, contentClass, endClass, ...restProps } = $props();
</script>

<!-- The toolbar consumes the top safe-area inset (status bar / notch) via
     `pt-[var(--kit-safe-top, var(--safe-area-inset-top))]`. --kit-safe-top defaults to the real
     inset; <Header>/<Footer> set it to 0 for their subtree so a Toolbar nested in them doesn't
     double the inset (they reserve it themselves). A centered <Dialog> zeroes
     --safe-area-inset-top, collapsing this to 0. On web both vars are unset → 0.
     min-height counts the inset on top of the 56px row: the padding sits inside the border
     box, so a bare `min-h-14` would let the inset eat the row and a STANDALONE toolbar's
     content strip compress under the status bar (under Header/Footer the var is 0 and the
     calc collapses to the plain 56px). -->
<div
  class={cn(
    'flex items-center gap-2 ps-4 pe-2 min-h-[calc(3.5rem_+_var(--kit-safe-top,var(--safe-area-inset-top,0px)))] pt-[var(--kit-safe-top,var(--safe-area-inset-top,0px))]',
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

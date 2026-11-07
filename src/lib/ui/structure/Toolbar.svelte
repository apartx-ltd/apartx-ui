<script>
  import { getContext, setContext } from 'svelte';
  import { cn } from '../utils/cn';
  import { getHostChrome } from '../../navigation/context';
  import { getChromeClaim, HOST_TOOLBAR_KEY, IN_HEADER_KEY } from './chrome-claim.svelte';

  let { children, start, end, class: className, startClass, contentClass, endClass, ...restProps } = $props();

  // Хром хоста (setHostChrome): претендует только тулбар внутри Page и вне оверлеев/Footer, и
  // только если хост дал `end`. Владелец — первый по рангу (в Header — 2, иначе 1; при равенстве
  // — смонтированный первым); при освобождении заявки оставшиеся претендуют заново.
  const hostEnd = getHostChrome()?.end;
  const claim = hostEnd ? getChromeClaim() : undefined;
  const me = Symbol('toolbar');
  const rank = getContext(IN_HEADER_KEY) ? 2 : 1;
  const isOwner = $derived(!!claim && claim.owner === me);

  if (claim) {
    $effect(() => {
      if (claim.owner === null || rank > claim.rank) {
        claim.owner = me;
        claim.rank = rank;
      }
    });
    $effect(() => () => {
      if (claim.owner === me) {
        claim.owner = null;
        claim.rank = 0;
      }
    });
  }

  // BackButton читает, в тулбаре-владельце ли он (геттер — владение меняется на лету).
  setContext(HOST_TOOLBAR_KEY, () => isOwner);
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

  {#if end || isOwner}
    <div class={cn('shrink-0 flex items-center', endClass)}>
      {@render end?.()}
      {#if isOwner}{@render hostEnd?.()}{/if}
    </div>
  {/if}
</div>

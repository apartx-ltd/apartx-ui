<script>
  import { cn } from '../utils/cn';

  let {
    children,
    start,
    end,
    href,
    onclick,
    active = false,
    class: className,
    ...restProps
  } = $props();

  let interactive = $derived(!!href || !!onclick);
</script>

{#if href}
  <a
    {href}
    class={cn(
      'flex items-center gap-3 px-4 py-3 text-body-lg text-on-surface no-underline',
      interactive && 'hover:bg-on-surface/8 active:bg-on-surface/12 cursor-pointer',
      active && 'bg-secondary-container text-on-secondary-container',
      className
    )}
    role="listitem"
    {...restProps}
  >
    {#if start}<div class="flex-shrink-0 flex items-center">{@render start()}</div>{/if}
    <div class="flex-1 min-w-0">{@render children()}</div>
    {#if end}<div class="flex-shrink-0 flex items-center">{@render end()}</div>{/if}
  </a>
{:else}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class={cn(
      'flex items-center gap-3 px-4 py-3 text-body-lg text-on-surface',
      interactive && 'hover:bg-on-surface/8 active:bg-on-surface/12 cursor-pointer',
      active && 'bg-secondary-container text-on-secondary-container',
      className
    )}
    role="listitem"
    {onclick}
    {...restProps}
  >
    {#if start}<div class="flex-shrink-0 flex items-center">{@render start()}</div>{/if}
    <div class="flex-1 min-w-0">{@render children()}</div>
    {#if end}<div class="flex-shrink-0 flex items-center">{@render end()}</div>{/if}
  </div>
{/if}

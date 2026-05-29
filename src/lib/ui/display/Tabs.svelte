<script>
  import { cn } from '../utils/cn';

  let {
    value = $bindable(''),
    items = [],
    onchange,
    variant,
    class: className,
    ...restProps
  } = $props();

  function onSelect(val) {
    value = val;
    onchange?.(val);
  }
</script>

<div
  class={cn(
    'flex border-b border-outline-variant',
    variant === 'scrollable' ? 'overflow-x-auto' : '',
    className,
  )}
  role="tablist"
  {...restProps}
>
  {#each items as item (item.value)}
    <button
      type="button"
      role="tab"
      class={cn(
        'px-4 py-3 text-label-lg transition-colors relative cursor-pointer whitespace-nowrap',
        variant !== 'scrollable' ? 'flex-1' : '',
        value === item.value
          ? 'text-primary'
          : 'text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8'
      )}
      aria-selected={value === item.value}
      onclick={() => onSelect(item.value)}
    >
      {item.label}
      {#if value === item.value}
        <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
      {/if}
    </button>
  {/each}
</div>

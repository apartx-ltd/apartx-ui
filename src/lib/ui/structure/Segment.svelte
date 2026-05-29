<script>
  import { cn } from '../utils/cn';

  /**
   * @type {{ value: string, items: Array<{value: string, label: string}>, class?: string }}
   */
  let { value = $bindable(''), items = [], class: className, ...restProps } = $props();
</script>

<div
  class={cn(
    'flex items-center rounded-full bg-surface-variant p-0.5 gap-0.5',
    className
  )}
  role="tablist"
  {...restProps}
>
  {#each items as item (item.value)}
    <button
      type="button"
      role="tab"
      class={cn(
        'flex-1 px-3 py-1.5 rounded-full text-label-lg transition-colors cursor-pointer',
        value === item.value
          ? 'bg-secondary-container text-on-secondary-container shadow-level-1'
          : 'text-on-surface-variant hover:bg-on-surface/8'
      )}
      aria-selected={value === item.value}
      onclick={() => { value = item.value; }}
    >
      {item.label}
    </button>
  {/each}
</div>

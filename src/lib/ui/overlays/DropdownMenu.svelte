<script>
  import { cn } from '../utils/cn';

  let {
    children,
    trigger,
    open = $bindable(false),
    align = 'end',
    class: className,
    ...restProps
  } = $props();

  function toggle() { open = !open; }
  function close() { open = false; }
</script>

<div class={cn('relative inline-flex', className)} {...restProps}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div onclick={toggle}>
    {@render trigger()}
  </div>

  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-40" onclick={close}></div>

    <div
      class={cn(
        'absolute z-50 mt-1 py-1 min-w-48 rounded-xs bg-surface shadow-level-2 overflow-hidden',
        align === 'end' ? 'right-0 top-full' : 'left-0 top-full'
      )}
      role="menu"
    >
      {@render children()}
    </div>
  {/if}
</div>

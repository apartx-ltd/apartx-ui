<script>
  import { cn } from '../utils/cn';

  let {
    children,
    open = $bindable(false),
    side = 'right',
    onclose,
    class: className,
    ...restProps
  } = $props();

  function close() {
    open = false;
    onclose?.();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') close();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex" onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="absolute inset-0 bg-scrim/40" onclick={close}></div>

    <div
      class={cn(
        'relative z-10 h-full flex flex-col bg-surface shadow-level-3 overflow-hidden',
        side === 'right' ? 'ml-auto' : 'mr-auto',
        'w-80 max-w-[85vw]',
        className
      )}
      {...restProps}
    >
      {@render children()}
    </div>
  </div>
{/if}

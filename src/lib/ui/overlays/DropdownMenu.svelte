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
  <div
    onclick={toggle}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
    role="button"
    tabindex="0"
    aria-haspopup="menu"
    aria-expanded={open}
  >
    {@render trigger()}
  </div>

  {#if open}
    <div
      class="fixed inset-0 z-40"
      onclick={close}
      onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); } }}
      role="button"
      tabindex="-1"
      aria-label="Close menu"
    ></div>

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

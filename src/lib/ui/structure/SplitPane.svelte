<script>
  import { cn } from '../utils/cn';

  let {
    children,
    aside,
    sidebarWidth = 250,
    breakpoint = 768,
    class: className,
    ...restProps
  } = $props();

  let isMobile = $state(false);
  let drawerOpen = $state(false);

  $effect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    isMobile = mq.matches;
    const handler = (e) => { isMobile = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  export function openDrawer() { drawerOpen = true; }
  export function closeDrawer() { drawerOpen = false; }
</script>

<div
  class={cn('flex flex-1 overflow-hidden', className)}
  {...restProps}
>
  {#if !isMobile && aside}
    <div class="flex-shrink-0 overflow-hidden flex" style:width="{sidebarWidth}px">
      {@render aside()}
    </div>
    <div class="w-0.5 bg-outline-variant flex-shrink-0"></div>
  {/if}

  <div class="flex-1 flex flex-col overflow-hidden min-w-0">
    {@render children()}
  </div>
</div>

{#if isMobile && drawerOpen && aside}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex"
    onkeydown={(e) => e.key === 'Escape' && closeDrawer()}
  >
    <!-- Scrim -->
    <div
      class="absolute inset-0 bg-scrim/40"
      onclick={closeDrawer}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeDrawer(); } }}
      role="button"
      tabindex="0"
      aria-label="Close"
    ></div>
    <!-- Drawer -->
    <div class="relative z-10 h-full flex" style:width="{sidebarWidth}px">
      {@render aside()}
    </div>
  </div>
{/if}

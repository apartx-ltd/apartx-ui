<script>
  import { cn } from '../utils/cn';
  import { useOverlay } from '../../hooks/useOverlay.svelte';

  let {
    children,
    trigger,
    open = $bindable(false),
    align = 'end',
    respectBack = true,
    class: className,
    ...restProps
  } = $props();

  function toggle() { open = !open; }
  function close() { open = false; }

  // Participate in the overlay-stack so browser/native Back closes the menu.
  // z-band: scrim at menuZ-1, menu content at menuZ (layer.z + 2 when nested in
  // a stacked overlay; 60 standalone — above a Dialog's z-50). Mirrors Select.
  const overlay = useOverlay(() => open, close, { respectBack });
  const menuZ = $derived(overlay.z != null ? overlay.z + 2 : 60);

  let triggerEl = $state();
  let pos = $state({ top: 0, left: 0, width: 0 });

  function reposition() {
    if (!triggerEl) return;
    const r = triggerEl.getBoundingClientRect();
    pos = { top: r.bottom, left: align === 'end' ? r.right : r.left, width: r.width };
  }

  // Keep the portalled menu glued to the trigger while it is open.
  $effect(() => {
    if (!open) return;
    reposition();
    const handler = () => reposition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  });

  // Move a node to <body> so it escapes clipping/stacking ancestors.
  function portal(node) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }
</script>

<div bind:this={triggerEl} class={cn('relative inline-flex', className)} {...restProps}>
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
</div>

{#if open}
  <div use:portal>
    <!-- pointer-events-auto: a portalled body-descendant inherits body {pointer-events:none}
         set by an open bits-ui Dialog, so re-enable it here (mirrors Select). -->
    <div
      class="fixed inset-0 pointer-events-auto"
      style={`z-index:${menuZ - 1};`}
      onclick={close}
      onkeydown={(e) => { if (e.key === 'Escape') close(); }}
      role="button"
      tabindex="-1"
      aria-label="Close menu"
    ></div>
    <div
      class={cn(
        'fixed pointer-events-auto py-1 min-w-48 rounded-xs bg-surface shadow-level-2 overflow-hidden',
        align === 'end' ? '-translate-x-full' : ''
      )}
      style={`top:${pos.top + 4}px;left:${pos.left}px;z-index:${menuZ};`}
      role="menu"
    >
      {@render children()}
    </div>
  </div>
{/if}

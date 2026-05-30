<script>
  import { cn } from '../utils/cn';
  import { overlayFade, sheet } from '../utils/motion';

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

  // Left/right drawer. `right` slides in from the right edge (panel pinned right),
  // anything else from the left.
  let fromRight = $derived(side === 'right');
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex" onkeydown={handleKeydown}>
    <!-- Scrim. Enter is a CSS @keyframes class (static → present at the first
         paint, so iOS WebKit can't flash it at full opacity for one frame);
         exit stays a Svelte transition. Background is an explicit rgb()/alpha,
         NOT Tailwind's `bg-scrim/40` — that compiles to `color-mix()`, which
         iOS 15 Safari ignores, falling back to opaque black. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dr-scrim dr-scrim-in absolute inset-0" onclick={close} out:overlayFade|global></div>

    <!-- Slide wrapper carries the enter animation as a fully-static class literal
         (no dynamic `class=`, via the {#if} branches) so it is on the cloned
         template node at the first paint. The inner box keeps the public
         `class`/rest props. Exit is `out:sheet`. -->
    {#if fromRight}
      <div class="dr-slide dr-slide-right" out:sheet|global={{ side: 'right' }}>{@render panel()}</div>
    {:else}
      <div class="dr-slide dr-slide-left" out:sheet|global={{ side: 'left' }}>{@render panel()}</div>
    {/if}
  </div>
{/if}

{#snippet panel()}
  <div
    class={cn(
      'flex h-full flex-col bg-surface shadow-level-3 overflow-hidden w-80 max-w-[85vw]',
      className,
    )}
    {...restProps}
  >
    {@render children()}
  </div>
{/snippet}

<style>
  /* iOS-15-safe scrim: explicit alpha, no color-mix(). */
  .dr-scrim {
    background-color: rgb(0 0 0 / 0.4);
  }
  /* Enter via CSS @keyframes with backwards fill: the `from` (hidden/off-screen)
     is applied at the first style resolution, before paint — no first-frame
     flash. After the animation the element reverts to its natural settled state,
     so the Svelte `out:` exit animates cleanly from there. */
  .dr-scrim-in {
    animation: drScrimIn 200ms cubic-bezier(0.2, 0, 0, 1) backwards;
  }
  @keyframes drScrimIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .dr-slide {
    position: relative;
    z-index: 10;
    height: 100%;
  }
  .dr-slide-left {
    margin-right: auto;
    animation: drInLeft 260ms cubic-bezier(0.2, 0, 0, 1) backwards;
  }
  .dr-slide-right {
    margin-left: auto;
    animation: drInRight 260ms cubic-bezier(0.2, 0, 0, 1) backwards;
  }
  @keyframes drInLeft {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: none;
    }
  }
  @keyframes drInRight {
    from {
      transform: translateX(100%);
    }
    to {
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dr-scrim-in,
    .dr-slide-left,
    .dr-slide-right {
      animation-duration: 1ms;
    }
  }
</style>

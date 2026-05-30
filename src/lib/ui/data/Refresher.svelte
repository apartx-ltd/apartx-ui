<script lang="ts">
  import { cn } from '../utils/cn';
  import Icon from '../display/Icon.svelte';
  import Loading from '../display/Loading.svelte';

  /**
   * Pull-to-refresh container (touch events, dependency-free). When the inner
   * scroll area is at the top and the user drags down past `threshold`,
   * releasing fires `onRefresh`; the spinner stays until the returned promise
   * settles. Mouse/desktop users can use a separate refresh control.
   *
   * @example
   * <Refresher onRefresh={async () => { await reload(); }}>
   *   …scrollable content…
   * </Refresher>
   */
  let {
    children,
    onRefresh,
    threshold = 64,
    maxPull = 120,
    disabled = false,
    pullingText = 'Pull to refresh',
    releaseText = 'Release to refresh',
    refreshingText = 'Refreshing…',
    class: className,
    ...restProps
  }: {
    children: any;
    onRefresh?: () => Promise<void> | void;
    threshold?: number;
    maxPull?: number;
    disabled?: boolean;
    pullingText?: string;
    releaseText?: string;
    refreshingText?: string;
    class?: string;
    [key: string]: any;
  } = $props();

  let container = $state<HTMLElement | null>(null);
  let startY = 0;
  let pulling = $state(false);
  let pull = $state(0);
  let refreshing = $state(false);

  let armed = $derived(pull >= threshold);

  function onTouchStart(e: TouchEvent) {
    if (disabled || refreshing) return;
    if ((container?.scrollTop ?? 0) > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }

  function onTouchMove(e: TouchEvent) {
    if (!pulling) return;
    const delta = e.touches[0].clientY - startY;
    if (delta <= 0) {
      pull = 0;
      return;
    }
    // Resist the pull so it feels elastic and can't run away.
    pull = Math.min(maxPull, delta * 0.5);
    if (pull > 4 && e.cancelable) e.preventDefault();
  }

  async function onTouchEnd() {
    if (!pulling) return;
    pulling = false;
    if (armed && !refreshing) {
      refreshing = true;
      pull = threshold;
      try {
        await onRefresh?.();
      } finally {
        refreshing = false;
        pull = 0;
      }
    } else {
      pull = 0;
    }
  }
</script>

<div
  bind:this={container}
  class={cn('relative overflow-y-auto overscroll-contain', className)}
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ontouchend={onTouchEnd}
  ontouchcancel={onTouchEnd}
  {...restProps}
>
  <!-- Indicator sits above the content and is revealed by the translate below. -->
  <div
    class="absolute inset-x-0 top-0 flex flex-col items-center justify-end gap-1 pointer-events-none text-on-surface-variant"
    style="height:{pull}px; opacity:{Math.min(1, pull / threshold)}"
  >
    {#if refreshing}
      <Loading />
      <span class="text-label-sm">{refreshingText}</span>
    {:else}
      <span class={cn('transition-transform', armed && 'rotate-180')}><Icon name="arrow-down" /></span>
      <span class="text-label-sm">{armed ? releaseText : pullingText}</span>
    {/if}
  </div>

  <div
    class="will-change-transform"
    style="transform: translateY({pull}px); transition:{pulling ? 'none' : 'transform 0.2s ease'}"
  >
    {@render children()}
  </div>
</div>

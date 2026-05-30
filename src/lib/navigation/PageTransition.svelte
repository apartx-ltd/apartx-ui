<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  /**
   * Animate page changes. Wrap route content and pass a `key` that changes per
   * route (e.g. the pathname); the block re-mounts and transitions on change.
   *
   * Respects `prefers-reduced-motion`: falls back to a quick crossfade with no
   * movement. Purely visual — does not touch routing.
   *
   * @example
   *   <PageTransition key={page.url.pathname}>
   *     {@render children()}
   *   </PageTransition>
   */
  let {
    key,
    children,
    duration = 180,
    y = 8,
    class: className,
  }: {
    key: unknown;
    children: () => any;
    duration?: number;
    y?: number;
    class?: string;
  } = $props();

  // SSR-safe: matchMedia is read lazily on the client when a transition runs.
  function reducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );
  }

  function enter(node: Element) {
    if (reducedMotion()) return fade(node, { duration: Math.min(duration, 120) });
    return fly(node, { y, duration, easing: cubicOut });
  }
</script>

{#key key}
  <div in:enter class={className}>
    {@render children()}
  </div>
{/key}

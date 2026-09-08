<script lang="ts">
  // Хост для jsdom-теста: снипеты в mount() не передать, поэтому они объявлены здесь,
  // а retry/post проброшены наружу через bind:this.
  import EmbedFrame from '../EmbedFrame.svelte';
  import type { EmbedFrameStatus, EmbedFramePost } from '../embed-frame';

  let {
    src = null,
    isReady,
    onMessage = undefined,
    onStatusChange = undefined,
    timeoutMs = 10000,
  }: {
    src?: string | null;
    isReady: (data: unknown) => boolean;
    onMessage?: (data: unknown, post: EmbedFramePost) => void;
    onStatusChange?: (status: EmbedFrameStatus) => void;
    timeoutMs?: number;
  } = $props();

  let frame = $state<ReturnType<typeof EmbedFrame> | null>(null);
  export function retry() { frame?.retry(); }
  export function post(message: unknown) { frame?.post(message); }
</script>

<EmbedFrame bind:this={frame} {src} {isReady} {onMessage} {onStatusChange} {timeoutMs} data-testid="embed-iframe" title="embed">
  {#snippet loading()}<span data-testid="embed-loading">loading</span>{/snippet}
  {#snippet timeout({ retry })}<button data-testid="embed-retry" onclick={retry}>retry</button>{/snippet}
</EmbedFrame>

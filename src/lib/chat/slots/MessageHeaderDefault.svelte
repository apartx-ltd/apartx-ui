<script lang="ts">
  import type { Message } from '../types';
  // Author label for incoming messages (group chats). Only at the start of a visual run and only when
  // the host populates `authorName` — a DM host simply leaves it empty. `me` is per-message from the renderer.
  let { message, authorName = '', me = false, isGroupStart = false }:
    { message: Message; authorName?: string; me?: boolean; isGroupStart?: boolean } = $props();
</script>

{#if authorName && isGroupStart && !me}
  <span class="text-xs font-medium text-on-surface-variant">{authorName}</span>
{/if}

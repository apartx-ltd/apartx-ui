<script lang="ts">
  import type { Message } from '../types';
  let { message, authorName = '' }: { message: Message; authorName?: string } = $props();
</script>

{#if authorName}
  <span class="text-xs font-medium text-on-surface-variant">{authorName}</span>
{/if}

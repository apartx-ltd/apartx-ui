<script lang="ts">
  import type { Message } from '$lib/chat';
  let { message }: { message: Message } = $props();
</script>

<div class="my-1 text-center text-xs text-on-surface-variant italic">{message.text}</div>

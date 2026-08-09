<script lang="ts">
  import type { Message } from '../types';
  import MessageText from '../MessageText.svelte';

  let { message }: { message: Message } = $props();
  const mode = $derived(message.meta?.parseMode === 'markdown' ? 'markdown' : 'plain');
</script>

<MessageText text={message.text ?? ''} {mode} />

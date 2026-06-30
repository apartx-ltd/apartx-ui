<script lang="ts">
  import type { Message } from '../types';
  let { message }: { message: Message } = $props();
</script>

<span class="whitespace-pre-wrap break-words">{message.text ?? ''}</span>

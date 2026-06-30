<script lang="ts">
  import type { Message } from '$lib/chat';
  let { message }: { message: Message } = $props();
  const meta = $derived(message.meta ?? {});
</script>

<div class="rounded-lg border border-outline-variant bg-surface px-3 py-2">
  <div class="text-label-lg font-medium text-primary">{message.text}</div>
  <div class="text-body-sm text-on-surface-variant">{meta.checkIn} → {meta.checkOut} · {meta.guests} guests</div>
</div>

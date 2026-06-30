<script lang="ts">
  import { onMount } from 'svelte';
  import {
    createChatSession, registerChatDefaults, setMessageRendererRegistry, setChatI18n,
    createLocalStorageDraftStore, ChatMessageList, MessageInput, type Message,
  } from '$lib/chat';
  import { createMockTransport } from './mock-transport';
  import SystemSlotBody from './demo-renderers/SystemSlotBody.svelte';
  import BookingSlotBody from './demo-renderers/BookingSlotBody.svelte';
  import MediaSlot from './demo-renderers/MediaSlot.svelte';
  import VideoSlot from './demo-renderers/VideoSlot.svelte';

  setChatI18n((key, opts) => (opts?.defaultValue as string) ?? key);

  registerChatDefaults();
  setMessageRendererRegistry({
    system: { header: null, body: SystemSlotBody, time: null },
    booking: { body: BookingSlotBody },
    image: { media: MediaSlot },
    video: { media: VideoSlot },
  });

  const mock = createMockTransport();
  const session = createChatSession(mock.transport, {
    chatId: 'demo-chat',
    meUserId: 'me',
    pageSize: 20,
    draftStore: createLocalStorageDraftStore('demo-chat'),
    draftKeyPrefix: 'demo-user',
  });

  onMount(() => {
    session.open();
    return () => { session.dispose(); mock.dispose(); };
  });

  function labelFor(m: Message) {
    return {
      timeLabel: m.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateLabel: m.createdAt.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      authorName: m.userId === 'me' ? 'You' : 'Tenant',
    };
  }
</script>

<div class="mx-auto flex h-full max-w-5xl gap-6">
  <div class="flex min-w-0 flex-1 flex-col rounded-xl border border-outline-variant">
    <header class="flex items-center justify-between border-b border-outline-variant px-4 py-3">
      <span class="text-title-md">Chat demo</span>
      <span class="rounded-full bg-surface-variant px-3 py-1 text-label-sm">
        status: {session.status} · older: {session.olderStatus} · {session.messages.length} msgs
      </span>
    </header>

    {#if session.status === 'loading'}
      <div class="grid flex-1 place-items-center text-on-surface-variant">Loading…</div>
    {:else if session.status === 'error'}
      <div class="grid flex-1 place-items-center text-error">Failed to load chat.</div>
    {:else}
      <div class="min-h-0 flex-1">
        <ChatMessageList {session} meUserId="me" {labelFor} />
      </div>
    {/if}

    <MessageInput {session} placeholder="Type a message…" sendLabel="Send" />
  </div>

  <aside class="hidden w-64 shrink-0 flex-col gap-2 sm:flex">
    <div class="text-label-lg text-on-surface-variant">Simulate</div>
    <button class="rounded-md bg-surface-variant px-3 py-2 text-left text-label-lg" onclick={() => mock.injectInbound()}>📥 Incoming message</button>
    <button class="rounded-md bg-surface-variant px-3 py-2 text-left text-label-lg" onclick={() => mock.injectPhoto()}>🖼 Incoming photo</button>
    <button class="rounded-md bg-surface-variant px-3 py-2 text-left text-label-lg" onclick={() => mock.injectVideo()}>🎬 Incoming video</button>
    <button class="rounded-md bg-surface-variant px-3 py-2 text-left text-label-lg" onclick={() => (mock.failNextSend = true)}>💥 Fail next send (→ retry)</button>
    <button class="rounded-md bg-surface-variant px-3 py-2 text-left text-label-lg" onclick={() => (mock.failNextFetch = true)}>⛔ Fail next loadOlder</button>
    <button class="rounded-md bg-surface-variant px-3 py-2 text-left text-label-lg" onclick={() => mock.deleteNewest(false)}>🗑 Soft-delete newest</button>
    <button class="rounded-md bg-surface-variant px-3 py-2 text-left text-label-lg" onclick={() => mock.deleteNewest(true)}>❌ Hard-delete newest</button>
    <button class="rounded-md bg-surface-variant px-3 py-2 text-left text-label-lg" onclick={() => session.composer.setReply(session.messages.at(-1)!)}>↩ Reply to newest</button>

    <div class="mt-3 text-label-sm text-on-surface-variant">
      Scroll up to load older (watch <code>olderStatus</code>). Type & reload to see the draft persist.
      Sent bubbles show the delivery tick advancing ✓ → ✓✓ → ✓✓(blue).
    </div>
  </aside>
</div>

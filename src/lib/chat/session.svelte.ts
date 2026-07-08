import type { ChatTransport, ChatSessionOptions, Message, MediaDraftInput } from './types';
import {
  emptyWindow, applyInitialPage, applyOlderPage, applyLiveUpsert,
  applyOptimisticSend, resolveSend, failSend, applyDelete, patchMessageMeta,
} from './reducer';
import { unreadAnchor } from './helpers';
import { createComposer, type Composer } from './composer.svelte';

export interface ChatSession {
  readonly status: 'loading' | 'ready' | 'error';
  readonly messages: readonly Message[];
  readonly olderStatus: 'idle' | 'loading' | 'exhausted' | 'error';
  /**
   * The "Unread messages" divider anchor, FROZEN at open() from the entry state — the id of the
   * first incoming unread message present when the chat was opened, or null if none were unread.
   * Deliberately not re-derived from live `messages`: once you are in the chat, arriving messages
   * are read on render, so a live-derived anchor would flash the divider onto each new message and
   * yank it away a tick later. Freezing it means the divider marks only where you left off on entry.
   */
  readonly unreadAnchorId: string | null;
  readonly composer: Composer;
  open(): Promise<void>;
  loadOlder(): Promise<void>;
  read(message: Message): void;
  markRead(message: Message): Promise<void>;
  send(): Promise<void>;
  /**
   * Send a picked media attachment (image/video/document). Shows an optimistic bubble immediately
   * (`sendState: 'sending'`, `meta.uploadProgress` advancing as the host uploads), then swaps to the
   * server message. Throws if the transport has no `sendMedia` seam (text-only host).
   */
  sendMedia(input: MediaDraftInput): Promise<void>;
  retry(message: Message): Promise<void>;
  dispose(): void;
}

let _tok = 0;
const nextToken = () => `t${Date.now()}_${++_tok}`;

export function createChatSession(transport: ChatTransport, opts: ChatSessionOptions): ChatSession {
  const pageSize = opts.pageSize ?? 25;

  let win = $state(emptyWindow());
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  // Unread-divider anchor. Two modes, chosen by whether the host supplies a `lastMessageSeq` ceiling:
  //  • WITH ceiling (entryMaxSeq set): DERIVED from the live window, bounded by frozen entryLrs/entryMaxSeq
  //    — backlog that loads a beat after open() (re-open with unread) surfaces the divider, while messages
  //    arriving WHILE viewing (seq above the ceiling) never move it. This fixes the "reopened chat shows no
  //    unread divider" bug.
  //  • WITHOUT ceiling (legacy hosts): FROZEN once at open() — preserves the original contract exactly
  //    (a live arrival must not conjure a divider) for callers that can't provide the newest-seq bound.
  let entryLrs = $state<number | null>(null);
  let entryMaxSeq = $state<number | null>(null);
  let frozenAnchor = $state<string | null>(null);
  let entrySet = $state(false);
  const unreadAnchorId = $derived.by(() => {
    if (!entrySet) return null;
    if (entryMaxSeq == null) return frozenAnchor; // legacy frozen-at-open (no ceiling)
    return unreadAnchor(win.messages, opts.meUserId, entryLrs, entryMaxSeq);
  });
  let unsub: (() => void) | null = null;

  const composer = createComposer({
    key: `${opts.draftKeyPrefix ?? 'chat-draft'}:${opts.chatId}`,
    store: opts.draftStore,
    debounceMs: opts.draftDebounceMs,
    authorNameOf: opts.authorNameOf ?? ((m) => m.userId ?? ''),
  });

  async function open() {
    status = 'loading';
    // Subscribe FIRST so nothing emitted during the fetch is lost (dedupe-by-id absorbs overlap).
    unsub = transport.subscribeLive(opts.chatId, (e) => {
      if (e.type === 'upsert') win = applyLiveUpsert(win, e.message);
      else win = applyDelete(win, e.targetId, e.hard);
    });
    try {
      const page = await transport.fetchOlder({ chatId: opts.chatId, limit: pageSize });
      // applyInitialPage seeds from the page alone; re-merge any live events that landed during the
      // fetch (subscribe-then-fetch) so the overlap window isn't lost. Dedupe-by-id keeps it idempotent.
      const arrivedDuringFetch = win.messages;
      win = applyInitialPage(win, page, pageSize);
      for (const msg of arrivedDuringFetch) win = applyLiveUpsert(win, msg);
      // Size the initial window to include the unread region so the divider anchor is renderable.
      // Expand backward until the oldest loaded message crosses into read territory (oldest.seq <= lastReadSeq),
      // bounded by MAX_INITIAL / a hard guard for pathological huge-unread chats.
      const lrs = opts.lastReadSeq?.() ?? null;
      if (lrs != null) {
        const MAX_INITIAL = 200;
        let guard = 0;
        while (
          win.olderStatus !== 'exhausted' &&
          win.messages.length < MAX_INITIAL &&
          (win.messages[0]?.seq ?? Infinity) > lrs &&
          guard++ < 12
        ) {
          const before = win.messages[0]?.createdAt;
          const older = await transport.fetchOlder({ chatId: opts.chatId, before, limit: pageSize });
          if (!older.length) break;
          win = applyOlderPage(win, older, pageSize);
        }
      }
      // Capture the divider BOUNDS from the entry state (once): the read watermark and the newest seq
      // that existed at open. With a ceiling the anchor is derived reactively (see above); without one
      // we freeze it now to preserve the legacy contract. Re-open (a fresh session) re-captures both.
      entryLrs = lrs;
      entryMaxSeq = opts.lastMessageSeq?.() ?? null;
      frozenAnchor = unreadAnchor(win.messages, opts.meUserId, lrs, entryMaxSeq);
      entrySet = true;
      status = 'ready';
    } catch {
      status = 'error';
    }
  }

  async function loadOlder() {
    if (win.olderStatus === 'loading' || win.olderStatus === 'exhausted') return;
    const before = win.messages[0]?.createdAt;
    win = { ...win, olderStatus: 'loading' };
    try {
      const page = await transport.fetchOlder({ chatId: opts.chatId, before, limit: pageSize });
      win = applyOlderPage(win, page, pageSize);
    } catch {
      win = { ...win, olderStatus: 'error' };
    }
  }

  function read(_message: Message) {
    // Local-only optimistic read is a host/display concern (unread badge). The kit drives the SERVER
    // watermark via markRead(); per-message local read state is reflected by the host's own projection.
    // Kept as a no-op hook so shells can call it uniformly; override via host if a local flag is needed.
  }

  async function markRead(message: Message) {
    await transport.markRead({ chatId: opts.chatId, message });
  }

  async function send() {
    const text = composer.draft.trim();
    if (!text) return;
    const clientToken = nextToken();
    const tempId = `tmp_${clientToken}`;
    const replyMessageId = composer.replyTo?._id;
    const optimistic: Message = {
      _id: tempId, chatId: opts.chatId, userId: opts.meUserId, text,
      createdAt: new Date(), sendState: 'sending', meta: { clientToken, replyMessageId },
    };
    win = applyOptimisticSend(win, optimistic);
    composer.clear();
    try {
      const server = await transport.sendMessage({ chatId: opts.chatId, text, replyMessageId, clientToken });
      win = resolveSend(win, tempId, server);
    } catch {
      win = failSend(win, tempId);
    }
  }

  async function sendMedia(input: MediaDraftInput) {
    if (!transport.sendMedia) throw new Error('[chat] transport has no sendMedia seam');
    const clientToken = nextToken();
    const tempId = `tmp_${clientToken}`;
    const replyMessageId = composer.replyTo?._id;
    // Optimistic media bubble: `sendState: 'sending'` (kit-canonical) + meta the media slot reads
    // (width/height reserve the box, previewUrl shows something instantly, uploadProgress advances).
    const optimistic: Message = {
      _id: tempId, chatId: opts.chatId, userId: opts.meUserId, type: input.type, text: input.text,
      createdAt: new Date(), sendState: 'sending',
      meta: {
        clientToken, replyMessageId,
        width: input.width, height: input.height,
        previewUrl: input.previewUrl, uploadProgress: 0,
      },
    };
    win = applyOptimisticSend(win, optimistic);
    composer.clearReply(); // media caption is separate from the text draft — don't wipe the draft
    try {
      const server = await transport.sendMedia({
        chatId: opts.chatId, clientToken, replyMessageId,
        file: input.file, type: input.type, text: input.text,
        width: input.width, height: input.height, previewUrl: input.previewUrl,
        onProgress: (fraction) => { win = patchMessageMeta(win, tempId, { uploadProgress: fraction }); },
      });
      win = resolveSend(win, tempId, server);
    } catch {
      win = failSend(win, tempId);
    }
  }

  async function retry(message: Message) {
    const clientToken = message.meta?.clientToken ?? nextToken();
    win = { ...win, messages: win.messages.map((x) => (x._id === message._id ? { ...x, sendState: 'sending' } : x)) };
    try {
      const server = await transport.sendMessage({ chatId: opts.chatId, text: message.text ?? '', replyMessageId: message.meta?.replyMessageId, clientToken });
      win = resolveSend(win, message._id, server);
    } catch {
      win = failSend(win, message._id);
    }
  }

  function dispose() {
    unsub?.();
    unsub = null;
    composer.dispose();
  }

  return {
    get status() { return status; },
    get messages() { return win.messages; },
    get olderStatus() { return win.olderStatus; },
    get unreadAnchorId() { return unreadAnchorId; },
    composer,
    open, loadOlder, read, markRead, send, sendMedia, retry, dispose,
  };
}

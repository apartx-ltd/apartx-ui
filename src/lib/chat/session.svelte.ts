import type { ChatTransport, ChatSessionOptions, Message } from './types';
import {
  emptyWindow, applyInitialPage, applyOlderPage, applyLiveUpsert,
  applyOptimisticSend, resolveSend, failSend, applyDelete,
} from './reducer';
import { createComposer, type Composer } from './composer.svelte';

export interface ChatSession {
  readonly status: 'loading' | 'ready' | 'error';
  readonly messages: readonly Message[];
  readonly olderStatus: 'idle' | 'loading' | 'exhausted' | 'error';
  readonly composer: Composer;
  open(): Promise<void>;
  loadOlder(): Promise<void>;
  read(message: Message): void;
  markRead(message: Message): Promise<void>;
  send(): Promise<void>;
  retry(message: Message): Promise<void>;
  dispose(): void;
}

let _tok = 0;
const nextToken = () => `t${Date.now()}_${++_tok}`;

export function createChatSession(transport: ChatTransport, opts: ChatSessionOptions): ChatSession {
  const pageSize = opts.pageSize ?? 25;

  let win = $state(emptyWindow());
  let status = $state<'loading' | 'ready' | 'error'>('loading');
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
    composer,
    open, loadOlder, read, markRead, send, retry, dispose,
  };
}

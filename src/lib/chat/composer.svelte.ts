import type { DraftStore, Message, ReplySnapshot } from './types';

export interface ComposerOptions {
  /** Persistence key, e.g. `${prefix}:${chatId}`. */
  key: string;
  /** Optional persistence; omit for in-memory only. */
  store?: DraftStore;
  /** Resolve an author display name for a reply snapshot. */
  authorNameOf: (message: Message) => string;
  /** Debounce ms for persisting drafts. Default 400. */
  debounceMs?: number;
  /** Max chars kept in a reply preview. Default 120. */
  previewLen?: number;
}

export interface Composer {
  readonly draft: string;
  readonly replyTo: ReplySnapshot | null;
  setDraft(text: string): void;
  setReply(message: Message): void;
  clearReply(): void;
  /** Wipe draft + reply and remove the persisted entry (called after a successful send). */
  clear(): void;
  dispose(): void;
}

export function createComposer(opts: ComposerOptions): Composer {
  const previewLen = opts.previewLen ?? 120;
  const debounceMs = opts.debounceMs ?? 400;

  let draft = $state('');
  let replyTo = $state<ReplySnapshot | null>(null);

  // Hydrate from persistence.
  if (opts.store) {
    const raw = opts.store.get(opts.key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { draft?: string; replyTo?: ReplySnapshot | null };
        draft = parsed.draft ?? '';
        replyTo = parsed.replyTo ?? null;
      } catch { /* corrupt entry — ignore */ }
    }
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  function persistDebounced() {
    if (!opts.store) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!draft && !replyTo) { opts.store!.remove(opts.key); return; }
      opts.store!.set(opts.key, JSON.stringify({ draft, replyTo }));
    }, debounceMs);
  }

  return {
    get draft() { return draft; },
    get replyTo() { return replyTo; },
    setDraft(text: string) { draft = text; persistDebounced(); },
    setReply(message: Message) {
      replyTo = {
        _id: message._id,
        authorName: opts.authorNameOf(message),
        textPreview: (message.text ?? '').slice(0, previewLen),
      };
      persistDebounced();
    },
    clearReply() { replyTo = null; persistDebounced(); },
    clear() {
      draft = '';
      replyTo = null;
      if (timer) { clearTimeout(timer); timer = null; }
      opts.store?.remove(opts.key);
    },
    dispose() { if (timer) { clearTimeout(timer); timer = null; } },
  };
}

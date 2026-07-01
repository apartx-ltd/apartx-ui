// Chat-core types. Pure data contracts — NO Meteor, NO svelte imports.

/** A chat message as the kit sees it. The host maps its own docs onto this shape. */
export interface Message {
  _id: string;
  chatId: string;
  /** Gap-free per-conversation sequence (iron-core). Absent on optimistic (not-yet-acked) messages. */
  seq?: number;
  userId?: string;            // author
  type?: string;              // renderer key; undefined → default text slots
  text?: string;
  createdAt: Date;
  read?: boolean | string[];  // legacy read[] array OR boolean (host-projected)
  delivery?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'; // server delivery projection (feature B)
  removedAt?: Date | null;    // soft-deleted
  meta?: Record<string, any>; // includes replyMessageId, clientToken, messenger, fileId, …
  /** Client-only optimistic state; absent for server messages. */
  sendState?: 'sending' | 'failed';
}

/** Normalized live event — the host adapter guarantees full docs (refetches behind the seam if needed). */
export type LiveEvent =
  | { type: 'upsert'; message: Message }
  | { type: 'delete'; targetId: string; hard: boolean };

/** Outgoing draft handed to the transport. `clientToken` is echoed back in the server message's meta for dedup. */
export interface OutgoingDraft {
  chatId: string;
  text: string;
  replyMessageId?: string;
  clientToken: string;
  attachments?: AttachmentRef[]; // host-opaque (e.g. {chatFileId}); passed through untouched (P4.1 = text-first)
}
export type AttachmentRef = Record<string, any>;

/** The single Meteor seam — the host implements this. */
export interface ChatTransport {
  fetchOlder(args: { chatId: string; before?: Date; limit: number }): Promise<Message[]>;
  subscribeLive(chatId: string, onEvent: (e: LiveEvent) => void): () => void; // returns unsubscribe
  sendMessage(draft: OutgoingDraft): Promise<Message>;
  markRead(args: { chatId: string; message: Message }): Promise<void>;
}

/** Persistence seam for composer drafts. Synchronous, localStorage-shaped. */
export interface DraftStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** Snapshot of the message being replied to — survives the original scrolling out of the loaded window. */
export interface ReplySnapshot {
  _id: string;
  authorName: string;
  textPreview: string;
}

/** The reducer's value — a plain object so the reducer is pure and unit-testable without runes. */
export interface MessageWindow {
  messages: Message[];                                  // ordered oldest→newest
  olderStatus: 'idle' | 'loading' | 'exhausted' | 'error';
}

export interface ChatSessionOptions {
  chatId: string;
  meUserId: string;
  /** Page size for fetchOlder. Default 25. */
  pageSize?: number;
  /** Draft persistence; omit to disable reload-survival (in-memory only). */
  draftStore?: DraftStore;
  /** Key namespace prefix for draft persistence (host injects, usually includes userId). Default 'chat-draft'. */
  draftKeyPrefix?: string;
  /** Debounce ms for persisting composer drafts. Default 400. */
  draftDebounceMs?: number;
}

/** Renderer registry slot set — one component per slot, all optional. */
export interface SlotSet {
  header?: any;
  body?: any;
  time?: any;
  footer?: any;
  media?: any;
}

/** i18n seam — a translate function. */
export type ChatT = (key: string, opts?: Record<string, any>) => string;

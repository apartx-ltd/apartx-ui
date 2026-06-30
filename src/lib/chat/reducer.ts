import type { Message, MessageWindow } from './types';

export function emptyWindow(): MessageWindow {
  return { messages: [], olderStatus: 'idle' };
}

/**
 * Order key: seq when present (gap-free iron-core), else createdAt (legacy/optimistic).
 * Optimistic messages (no seq) sort to the tail by createdAt — they are always the newest.
 */
function orderKey(m: Message): number {
  return m.seq ?? Number.MAX_SAFE_INTEGER - (Date.now() - m.createdAt.getTime());
}

function sortByOrder(list: Message[]): Message[] {
  return [...list].sort((a, b) => orderKey(a) - orderKey(b));
}

/** Merge `incoming` into `base` deduping by _id (incoming wins), then sort. */
function mergeById(base: Message[], incoming: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const x of base) byId.set(x._id, x);
  for (const x of incoming) byId.set(x._id, x);
  return sortByOrder([...byId.values()]);
}

export function applyInitialPage(w: MessageWindow, page: Message[], pageSize: number): MessageWindow {
  return {
    messages: sortByOrder(page),
    olderStatus: page.length < pageSize ? 'exhausted' : 'idle',
  };
}

export function applyOlderPage(w: MessageWindow, page: Message[], pageSize: number): MessageWindow {
  return {
    messages: mergeById(w.messages, page),
    olderStatus: page.length < pageSize ? 'exhausted' : 'idle',
  };
}

export function applyLiveUpsert(w: MessageWindow, message: Message): MessageWindow {
  return { ...w, messages: mergeById(w.messages, [message]) };
}

export function applyOptimisticSend(w: MessageWindow, optimistic: Message): MessageWindow {
  return { ...w, messages: mergeById(w.messages, [optimistic]) };
}

/**
 * Replace the optimistic temp message with the server message. Removes the temp by _id, then upserts the real one
 * (dedupe handles the case where its live upsert already landed via clientToken).
 */
export function resolveSend(w: MessageWindow, tempId: string, serverMessage: Message): MessageWindow {
  const without = w.messages.filter((x) => x._id !== tempId);
  return { ...w, messages: mergeById(without, [{ ...serverMessage, sendState: undefined }]) };
}

export function failSend(w: MessageWindow, tempId: string): MessageWindow {
  return {
    ...w,
    messages: w.messages.map((x) => (x._id === tempId ? { ...x, sendState: 'failed' } : x)),
  };
}

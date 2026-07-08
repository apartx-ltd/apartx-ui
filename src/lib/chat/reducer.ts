import type { Message, MessageWindow } from './types';

export function emptyWindow(): MessageWindow {
  return { messages: [], olderStatus: 'idle' };
}

/**
 * Chronological order: primarily by `createdAt`, with `seq` as a stable tiebreaker for
 * same-instant server messages (gap-free iron-core). This interleaves seq-less server
 * messages (service/system notes inserted outside the event log) at their real time.
 *
 * Optimistic (not-yet-acked) messages carry `sendState` and always sort to the tail —
 * they are the newest and must not jump above acked messages on client clock skew.
 */
function isPending(m: Message): boolean {
  return m.sendState != null;
}

function compareMessages(a: Message, b: Message): number {
  const pa = isPending(a) ? 1 : 0;
  const pb = isPending(b) ? 1 : 0;
  if (pa !== pb) return pa - pb;
  const ta = a.createdAt.getTime();
  const tb = b.createdAt.getTime();
  if (ta !== tb) return ta - tb;
  return (a.seq ?? Number.MAX_SAFE_INTEGER) - (b.seq ?? Number.MAX_SAFE_INTEGER);
}

function sortByOrder(list: Message[]): Message[] {
  return [...list].sort(compareMessages);
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

/** Merge a meta patch onto an in-window message by _id (e.g. optimistic upload progress). No-op if absent. */
export function patchMessageMeta(w: MessageWindow, id: string, metaPatch: Record<string, any>): MessageWindow {
  return {
    ...w,
    messages: w.messages.map((x) => (x._id === id ? { ...x, meta: { ...x.meta, ...metaPatch } } : x)),
  };
}

export function failSend(w: MessageWindow, tempId: string): MessageWindow {
  return {
    ...w,
    messages: w.messages.map((x) => (x._id === tempId ? { ...x, sendState: 'failed' } : x)),
  };
}

export function applyDelete(w: MessageWindow, targetId: string, hard: boolean): MessageWindow {
  if (hard) return { ...w, messages: w.messages.filter((x) => x._id !== targetId) };
  return {
    ...w,
    messages: w.messages.map((x) => (x._id === targetId ? { ...x, removedAt: new Date() } : x)),
  };
}

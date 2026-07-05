import type { StoredMessage } from './chat-db';

/** Read-by-me for the unread badge / read-on-render gate. Directional:
 *  - own message → whether recipients read it (receipts array) — unchanged;
 *  - other's message → seq <= my watermark (lastReadSeq); falls back to the
 *    legacy read[] membership when the message predates seq (mixed data). */
export function isReadByMe(m: StoredMessage, meUserId: string, lastReadSeq: number | null | undefined): boolean {
  if (m.type === 'service') return true;
  const readArr = Array.isArray(m.read) ? m.read : null;
  if (m.userId === meUserId) return readArr ? readArr.length > 0 : !!m.read;
  if (m.seq != null && lastReadSeq != null) return m.seq <= lastReadSeq;
  return readArr ? readArr.includes(meUserId) : !!m.read; // legacy fallback
}

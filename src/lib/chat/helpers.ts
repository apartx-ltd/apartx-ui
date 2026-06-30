import type { Message } from './types';

export type DeliveryTick = 'sent' | 'delivered' | 'read' | 'failed';

/** True if anyone OTHER than me has read the message (legacy read[] / boolean). */
export function isReadByOther(message: Message, meUserId?: string): boolean {
  const read = message.read;
  if (read === true) return true;
  if (Array.isArray(read)) return read.some((u) => u !== meUserId);
  return false;
}

/**
 * 3-state WhatsApp-style tick (feature B). Prefers the server `delivery` projection; falls back to read[] when absent
 * (a message with no chat-deliveries rows). queued/sent → 'sent'.
 */
export function deliveryTick(message: Message, meUserId?: string): DeliveryTick {
  switch (message.delivery) {
    case 'failed': return 'failed';
    case 'read': return 'read';
    case 'delivered': return 'delivered';
    case 'queued':
    case 'sent': return 'sent';
    default: return isReadByOther(message, meUserId) ? 'read' : 'sent';
  }
}

/** First message of a visual group (author changed from the previous message). */
export function groupStart(message: Message, prev: Message | null): boolean {
  if (!prev) return true;
  return message.userId !== prev.userId;
}

/** Show a date separator when this message is on a different calendar day than the previous. */
export function showDate(message: Message, prev: Message | null): boolean {
  if (!prev) return true;
  const a = message.createdAt, b = prev.createdAt;
  return a.getFullYear() !== b.getFullYear() || a.getMonth() !== b.getMonth() || a.getDate() !== b.getDate();
}

/** True if the message was authored by me: my primary id or one of my alias ids (`meIds`). */
export function isOwnMessage(message: { userId?: string }, meUserId?: string, meIds?: string[]): boolean {
  return message.userId === meUserId || (meIds ?? []).includes(message.userId as string);
}

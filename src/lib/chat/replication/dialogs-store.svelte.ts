import type { ChatReplication } from './chat-replication';
import type { StoredDialog } from './chat-db';
import { liveArray } from './live-query.svelte';

export function createDialogsStore(replication: ChatReplication) {
  const feed = liveArray<StoredDialog>(() => replication.db.chatDialogs.orderBy('updatedAt').reverse().toArray());
  return {
    get dialogs() { return feed.current; },
    get totalUnread() { return feed.current.reduce((s, d) => s + (d.unread || 0), 0); },
    unreadByKind(kind: string) {
      return feed.current.filter((d) => d.kind === kind).reduce((s, d) => s + (d.unread || 0), 0);
    },
    dispose() { feed.stop(); },
  };
}

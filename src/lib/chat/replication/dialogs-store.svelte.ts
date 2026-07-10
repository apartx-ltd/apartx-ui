import type { ChatReplication } from './chat-replication';
import type { StoredDialog } from './chat-db';
import { liveArray } from './live-query.svelte';

export function createDialogsStore(replication: ChatReplication) {
  const feed = liveArray<StoredDialog>(() => replication.db.chatDialogs.orderBy('updatedAt').reverse().toArray());
  return {
    get dialogs() { return feed.current; },
    // false until the Dexie liveQuery delivers its first batch — lets the host list show a loader
    // instead of an empty state during the initial gap (dialogs is [] before the first emission).
    get loaded() { return feed.loaded; },
    get totalUnread() { return feed.current.reduce((s, d) => s + (d.unread || 0), 0); },
    unreadByKind(kind: string) {
      return feed.current.filter((d) => d.kind === kind).reduce((s, d) => s + (d.unread || 0), 0);
    },
    dispose() { feed.stop(); },
  };
}

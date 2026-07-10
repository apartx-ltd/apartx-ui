import { liveQuery, type Observable } from 'dexie';

export function liveArray<T>(query: () => Promise<T[]>): { get current(): T[]; get loaded(): boolean; stop(): void } {
  let current = $state<T[]>([]);
  // `loaded` flips true on the first liveQuery emission. Consumers use it to distinguish "not yet
  // loaded" (current is still the initial []) from "loaded and genuinely empty" — so a list can show
  // a loader until the first batch arrives instead of flashing an empty state for one frame.
  let loaded = $state(false);
  const sub = (liveQuery(query) as Observable<T[]>).subscribe({
    next: (v) => {
      current = v;
      loaded = true;
    },
  });
  return { get current() { return current; }, get loaded() { return loaded; }, stop: () => sub.unsubscribe() };
}

export interface DiffItem { _id: string; updatedAt?: Date }
export function makeSnapshotDiffer<T extends DiffItem>() {
  let prev = new Map<string, number>(); // _id -> updatedAt ms
  return function diff(next: T[]): { upserts: T[]; deletedIds: string[] } {
    const nextMap = new Map<string, number>();
    const upserts: T[] = [];
    for (const x of next) {
      const v = x.updatedAt ? x.updatedAt.getTime() : 0;
      nextMap.set(x._id, v);
      if (prev.get(x._id) !== v) upserts.push(x);
    }
    const deletedIds: string[] = [];
    for (const id of prev.keys()) if (!nextMap.has(id)) deletedIds.push(id);
    prev = nextMap;
    return { upserts, deletedIds };
  };
}

import { describe, it, expect, beforeEach } from 'vitest';
import { Replication } from './replication';
import type {
  ReplicationOptions,
  ReplicationDbRef,
  PullResult,
  Checkpoint,
} from './types';

/**
 * Unit tests for Replication.reSync() reconciliation.
 *
 * Uses lightweight mocks for Dexie table/db — Replication is mostly
 * async logic over the Dexie interface, easy to test in isolation.
 */

interface Doc {
  _id: string;
  name: string;
  removedAt?: Date;
}

/** In-memory mock for a Dexie table */
function createMockTable() {
  const store = new Map<string, Doc>();

  return {
    store,
    bulkPut(docs: Doc[]) {
      for (const doc of docs) store.set(doc._id, doc);
      return Promise.resolve();
    },
    bulkDelete(ids: string[]) {
      for (const id of ids) store.delete(id);
      return Promise.resolve();
    },
    toCollection() {
      return {
        primaryKeys() {
          return Promise.resolve(Array.from(store.keys()));
        },
      };
    },
  };
}

/** In-memory mock for _replicationMeta table */
function createMockMeta() {
  const store = new Map<string, any>();
  return {
    get(key: string) {
      return Promise.resolve(store.get(key));
    },
    put(item: any) {
      store.set(item.key, item);
      return Promise.resolve();
    },
    delete(key: string) {
      store.delete(key);
      return Promise.resolve();
    },
    toCollection() {
      return {
        primaryKeys() {
          return Promise.resolve(Array.from(store.keys()));
        },
      };
    },
    store,
  };
}

/** Mock db that wraps table + meta */
function createMockDb(table: ReturnType<typeof createMockTable>, meta: ReturnType<typeof createMockMeta>): ReplicationDbRef {
  return {
    name: 'test-db',
    _replicationMeta: meta as any,
    transaction(_mode: string, _tables: any[], fn: () => Promise<void>) {
      return fn();
    },
  } as any;
}

type PullHandler = (
  checkpoint: Checkpoint | null,
  batchSize: number,
  scope: string | null,
) => Promise<PullResult<Doc>>;

function createReplication(
  table: ReturnType<typeof createMockTable>,
  db: ReplicationDbRef,
  pullHandler: PullHandler,
  extraOptions?: Partial<ReplicationOptions<Doc>>,
): Replication<Doc> {
  const options: ReplicationOptions<Doc> = {
    name: 'bookings',
    db,
    table: table as any,
    pull: {
      handler: pullHandler,
      batchSize: 100,
    },
    live: false, // disable polling for tests
    ...extraOptions,
  };
  return new Replication<Doc>(options);
}

describe('Replication reSync reconciliation', () => {
  let table: ReturnType<typeof createMockTable>;
  let meta: ReturnType<typeof createMockMeta>;
  let db: ReplicationDbRef;

  beforeEach(() => {
    table = createMockTable();
    meta = createMockMeta();
    db = createMockDb(table, meta);
  });

  it('should delete ghost documents not returned by server', async () => {
    // Seed local table with 3 docs — doc 'ghost' was hard-deleted on server
    table.store.set('a', { _id: 'a', name: 'Booking A' });
    table.store.set('b', { _id: 'b', name: 'Booking B' });
    table.store.set('ghost', { _id: 'ghost', name: 'Ghost booking' });

    // Server only returns docs a and b (ghost is gone)
    const pullHandler: PullHandler = async () => ({
      documents: [
        { _id: 'a', name: 'Booking A' },
        { _id: 'b', name: 'Booking B' },
      ],
      checkpoint: { updatedAt: new Date(), id: 'b' },
      hasMore: false,
    });

    const replication = createReplication(table, db, pullHandler);

    // Start global scope so reSync has something to re-pull
    replication.start();

    await replication.reSync();

    expect(table.store.has('a')).to.be.true;
    expect(table.store.has('b')).to.be.true;
    expect(table.store.has('ghost')).to.be.false;
  });

  it('should handle scoped replication and delete ghosts across scopes', async () => {
    // Seed local docs from two scopes
    table.store.set('jan-1', { _id: 'jan-1', name: 'Jan booking' });
    table.store.set('feb-1', { _id: 'feb-1', name: 'Feb booking' });
    table.store.set('ghost-jan', { _id: 'ghost-jan', name: 'Ghost' });

    // Server returns jan-1 for scope 2026-01 and feb-1 for scope 2026-02
    const pullHandler: PullHandler = async (_cp, _bs, scope) => {
      if (scope === '2026-01') {
        return {
          documents: [{ _id: 'jan-1', name: 'Jan booking' }],
          checkpoint: { updatedAt: new Date(), id: 'jan-1' },
          hasMore: false,
        };
      }
      if (scope === '2026-02') {
        return {
          documents: [{ _id: 'feb-1', name: 'Feb booking' }],
          checkpoint: { updatedAt: new Date(), id: 'feb-1' },
          hasMore: false,
        };
      }
      return { documents: [], checkpoint: null, hasMore: false };
    };

    const replication = createReplication(table, db, pullHandler);
    replication.setActiveScopes(['2026-01', '2026-02']);

    // Wait for initial pulls to complete
    await new Promise(r => setTimeout(r, 50));

    await replication.reSync();

    expect(table.store.has('jan-1')).to.be.true;
    expect(table.store.has('feb-1')).to.be.true;
    expect(table.store.has('ghost-jan')).to.be.false;
  });

  it('should skip reconciliation when pull throws an error', async () => {
    // Seed local docs including a ghost
    table.store.set('a', { _id: 'a', name: 'Booking A' });
    table.store.set('ghost', { _id: 'ghost', name: 'Ghost' });

    const pullHandler: PullHandler = async () => {
      throw new Error('Network error');
    };

    const replication = createReplication(table, db, pullHandler);
    replication.start();

    const errors: unknown[] = [];
    replication.onError((err) => errors.push(err));

    await replication.reSync();

    // Ghost should NOT be deleted because pull failed
    expect(table.store.has('ghost')).to.be.true;
    expect(table.store.has('a')).to.be.true;
    // Error should have been emitted
    expect(errors.length).to.be.greaterThan(0);
  });

  it('should handle empty local table gracefully', async () => {
    // No local docs at all
    const pullHandler: PullHandler = async () => ({
      documents: [{ _id: 'new-1', name: 'New booking' }],
      checkpoint: { updatedAt: new Date(), id: 'new-1' },
      hasMore: false,
    });

    const replication = createReplication(table, db, pullHandler);
    replication.start();

    await replication.reSync();

    expect(table.store.has('new-1')).to.be.true;
    expect(table.store.size).to.equal(1);
  });

  it('should handle multi-batch pulls and collect all IDs', async () => {
    // Seed ghost
    table.store.set('ghost', { _id: 'ghost', name: 'Ghost' });

    let callCount = 0;
    const pullHandler: PullHandler = async (checkpoint) => {
      callCount++;
      if (!checkpoint) {
        // First batch
        return {
          documents: [
            { _id: 'a', name: 'A' },
            { _id: 'b', name: 'B' },
          ],
          checkpoint: { updatedAt: new Date(), id: 'b' },
          hasMore: true,
        };
      }
      // Second batch
      return {
        documents: [{ _id: 'c', name: 'C' }],
        checkpoint: { updatedAt: new Date(), id: 'c' },
        hasMore: false,
      };
    };

    const replication = createReplication(table, db, pullHandler);
    replication.start();

    await replication.reSync();

    expect(table.store.has('a')).to.be.true;
    expect(table.store.has('b')).to.be.true;
    expect(table.store.has('c')).to.be.true;
    expect(table.store.has('ghost')).to.be.false;
    // Pull handler should have been called for both batches
    expect(callCount).to.be.greaterThanOrEqual(2);
  });

  it('should handle soft-deleted docs during reconciliation', async () => {
    table.store.set('a', { _id: 'a', name: 'A' });
    table.store.set('soft-del', { _id: 'soft-del', name: 'Soft deleted' });
    table.store.set('ghost', { _id: 'ghost', name: 'Ghost' });

    // Server returns 'a' as normal and 'soft-del' with removedAt
    const pullHandler: PullHandler = async () => ({
      documents: [
        { _id: 'a', name: 'A' },
        { _id: 'soft-del', name: 'Soft deleted', removedAt: new Date() },
      ],
      checkpoint: { updatedAt: new Date(), id: 'soft-del' },
      hasMore: false,
    });

    const replication = createReplication(table, db, pullHandler);
    replication.start();

    await replication.reSync();

    // 'a' stays, 'soft-del' removed by deletedField logic, 'ghost' removed by reconciliation
    expect(table.store.has('a')).to.be.true;
    expect(table.store.has('soft-del')).to.be.false;
    expect(table.store.has('ghost')).to.be.false;
  });

  it('should clear _reconcileIds after reSync completes', async () => {
    const pullHandler: PullHandler = async () => ({
      documents: [],
      checkpoint: null,
      hasMore: false,
    });

    const replication = createReplication(table, db, pullHandler);
    replication.start();

    await replication.reSync();

    // _reconcileIds is private, but we can verify it's cleaned up
    // by checking that a normal executePull doesn't accidentally collect IDs
    // (indirect test — the field should be null after reSync)
    expect((replication as any)._reconcileIds).to.be.null;
  });
});

describe('Replication reSync race condition with scroll', () => {
  let table: ReturnType<typeof createMockTable>;
  let meta: ReturnType<typeof createMockMeta>;
  let db: ReplicationDbRef;

  beforeEach(() => {
    table = createMockTable();
    meta = createMockMeta();
    db = createMockDb(table, meta);
  });

  it('should use pending scope keys when setActiveScopes is called during reSync', async () => {
    table.store.set('jan-1', { _id: 'jan-1', name: 'Jan booking' });

    let pullResolve: (() => void) | null = null;
    let reSyncPullStarted = false;

    const pullHandler: PullHandler = async (_cp, _bs, scope) => {
      // Block only the reSync pull (checkpoint is null after reSync clears checkpoints)
      if (!reSyncPullStarted && _cp === null) {
        reSyncPullStarted = true;
        await new Promise<void>(resolve => { pullResolve = resolve; });
      }
      return {
        documents: scope === '2026-01'
          ? [{ _id: 'jan-1', name: 'Jan booking' }]
          : scope === '2026-03'
          ? [{ _id: 'mar-1', name: 'Mar booking' }]
          : [],
        checkpoint: { updatedAt: new Date(), id: 'x' },
        hasMore: false,
      };
    };

    const replication = createReplication(table, db, pullHandler);
    replication.setActiveScopes(['2026-01']);
    await new Promise(r => setTimeout(r, 50));

    // Start reSync — it will block on the slow pull (checkpoint=null after clearing)
    reSyncPullStarted = false;
    const reSyncPromise = replication.reSync();

    // Wait for the reSync pull to be in-flight
    await new Promise(r => setTimeout(r, 50));

    // Simulate scroll: user scrolled to March while reSync is running
    replication.setActiveScopes(['2026-03']);

    // The call should be deferred, not executed immediately
    expect((replication as any)._pendingScopeKeys).to.deep.equal(['2026-03']);
    expect((replication as any)._reSyncing).to.be.true;

    // Unblock the pull
    pullResolve!();
    await reSyncPromise;

    // After reSync completes, scopes should be restarted with the pending keys
    expect((replication as any)._reSyncing).to.be.false;
    expect((replication as any)._pendingScopeKeys).to.be.null;
    // The scope map should contain '2026-03' (from scroll), not '2026-01' (original)
    expect(replication.getScope('2026-03')).to.not.be.undefined;
    expect(replication.getScope('2026-01')).to.be.undefined;
  });

  it('should defer sync() calls during reSync and execute after', async () => {
    const pullHandler: PullHandler = async () => ({
      documents: [{ _id: 'a', name: 'A' }],
      checkpoint: { updatedAt: new Date(), id: 'a' },
      hasMore: false,
    });

    const replication = createReplication(table, db, pullHandler);
    replication.start();
    await new Promise(r => setTimeout(r, 50));

    let pullResolve: (() => void) | null = null;
    let callCount = 0;

    // Replace pull handler with slow one for reSync
    (replication as any).options.pull.handler = async (_cp: any, _bs: any, _scope: any) => {
      callCount++;
      if (callCount === 1) {
        await new Promise<void>(resolve => { pullResolve = resolve; });
      }
      return {
        documents: [{ _id: 'a', name: 'A' }],
        checkpoint: { updatedAt: new Date(), id: 'a' },
        hasMore: false,
      };
    };

    const reSyncPromise = replication.reSync();
    await new Promise(r => setTimeout(r, 10));

    // sync() during reSync should be deferred
    replication.sync();
    expect((replication as any)._pendingSync).to.be.true;

    pullResolve!();
    await reSyncPromise;

    // _pendingSync should be consumed
    expect((replication as any)._pendingSync).to.be.false;
  });

  it('should use last setActiveScopes call when scrolled multiple times during reSync', async () => {
    let pullResolve: (() => void) | null = null;
    let reSyncPullStarted = false;

    const pullHandler: PullHandler = async (_cp) => {
      // Block only the reSync pull (checkpoint is null after reSync clears checkpoints)
      if (!reSyncPullStarted && _cp === null) {
        reSyncPullStarted = true;
        await new Promise<void>(resolve => { pullResolve = resolve; });
      }
      return {
        documents: [],
        checkpoint: null,
        hasMore: false,
      };
    };

    const replication = createReplication(table, db, pullHandler);
    replication.setActiveScopes(['2026-01']);
    await new Promise(r => setTimeout(r, 50));

    reSyncPullStarted = false;
    const reSyncPromise = replication.reSync();
    await new Promise(r => setTimeout(r, 50));

    // Simulate multiple scrolls — last-write-wins
    replication.setActiveScopes(['2026-02']);
    replication.setActiveScopes(['2026-03']);
    replication.setActiveScopes(['2026-04', '2026-05']);

    expect((replication as any)._pendingScopeKeys).to.deep.equal(['2026-04', '2026-05']);

    pullResolve!();
    await reSyncPromise;

    // Should end up with the last scroll's scopes
    expect(replication.getScope('2026-04')).to.not.be.undefined;
    expect(replication.getScope('2026-05')).to.not.be.undefined;
    expect(replication.getScope('2026-01')).to.be.undefined;
    expect(replication.getScope('2026-02')).to.be.undefined;
    expect(replication.getScope('2026-03')).to.be.undefined;
  });

  it('should fall back to original scopeKeys when no scroll happens during reSync', async () => {
    const pullHandler: PullHandler = async () => ({
      documents: [],
      checkpoint: null,
      hasMore: false,
    });

    const replication = createReplication(table, db, pullHandler);
    replication.setActiveScopes(['2026-01', '2026-02']);
    await new Promise(r => setTimeout(r, 50));

    await replication.reSync();

    // No scroll happened — original scope keys should be restored
    expect(replication.getScope('2026-01')).to.not.be.undefined;
    expect(replication.getScope('2026-02')).to.not.be.undefined;
  });

  it('should not restart scopes when setActiveScopes([]) is called during reSync', async () => {
    let pullResolve: (() => void) | null = null;
    let callCount = 0;

    const pullHandler: PullHandler = async () => {
      callCount++;
      if (callCount === 1) {
        await new Promise<void>(resolve => { pullResolve = resolve; });
      }
      return {
        documents: [],
        checkpoint: null,
        hasMore: false,
      };
    };

    const replication = createReplication(table, db, pullHandler);
    replication.setActiveScopes(['2026-01']);
    await new Promise(r => setTimeout(r, 50));

    const reSyncPromise = replication.reSync();
    await new Promise(r => setTimeout(r, 10));

    // stopReplication scenario: empty scopes
    replication.setActiveScopes([]);

    pullResolve!();
    await reSyncPromise;

    // Empty pending scopes → no scopes should be restarted
    expect(replication.getScope('2026-01')).to.be.undefined;
  });
});

describe('Replication reSync inactive scope cleanup', () => {
  let table: ReturnType<typeof createMockTable>;
  let meta: ReturnType<typeof createMockMeta>;
  let db: ReplicationDbRef;

  beforeEach(() => {
    table = createMockTable();
    meta = createMockMeta();
    db = createMockDb(table, meta);
  });

  /**
   * Simple reconcileFilter mock: scope keys are month prefixes (e.g. '2026-01').
   * Doc IDs starting with that prefix belong to that scope.
   */
  function monthReconcileFilter(scopeKeys: string[]) {
    return (tbl: any) => {
      const ids = Array.from((tbl as ReturnType<typeof createMockTable>).store.keys()) as string[];
      return Promise.resolve(ids.filter(id => scopeKeys.some(k => id.startsWith(k))));
    };
  }

  it('should delete data from inactive scopes and keep active scope data', async () => {
    // Seed local data: active (Jan, Feb) and inactive (Nov-2025) bookings
    table.store.set('2026-01-a', { _id: '2026-01-a', name: 'Jan booking A' });
    table.store.set('2026-01-b', { _id: '2026-01-b', name: 'Jan booking B' });
    table.store.set('2026-02-a', { _id: '2026-02-a', name: 'Feb booking A' });
    table.store.set('2025-11-old', { _id: '2025-11-old', name: 'Old Nov booking' });
    table.store.set('2025-11-demo', { _id: '2025-11-demo', name: 'Demo Nov booking' });

    // Simulate that Nov was previously synced (has a meta checkpoint)
    meta.store.set('bookings:2025-11', { key: 'bookings:2025-11', checkpoint: { updatedAt: new Date(), id: 'x' } });
    meta.store.set('bookings:2026-01', { key: 'bookings:2026-01', checkpoint: { updatedAt: new Date(), id: 'y' } });
    meta.store.set('bookings:2026-02', { key: 'bookings:2026-02', checkpoint: { updatedAt: new Date(), id: 'z' } });

    // Server returns data for active scopes only
    const pullHandler: PullHandler = async (_cp, _bs, scope) => {
      if (scope === '2026-01') {
        return {
          documents: [
            { _id: '2026-01-a', name: 'Jan booking A' },
            { _id: '2026-01-b', name: 'Jan booking B' },
          ],
          checkpoint: { updatedAt: new Date(), id: '2026-01-b' },
          hasMore: false,
        };
      }
      if (scope === '2026-02') {
        return {
          documents: [{ _id: '2026-02-a', name: 'Feb booking A' }],
          checkpoint: { updatedAt: new Date(), id: '2026-02-a' },
          hasMore: false,
        };
      }
      return { documents: [], checkpoint: null, hasMore: false };
    };

    const replication = createReplication(table, db, pullHandler, {
      reconcileFilter: monthReconcileFilter,
    });
    replication.setActiveScopes(['2026-01', '2026-02']);
    await new Promise(r => setTimeout(r, 50));

    await replication.reSync();

    // Active scope data should be present
    expect(table.store.has('2026-01-a')).to.be.true;
    expect(table.store.has('2026-01-b')).to.be.true;
    expect(table.store.has('2026-02-a')).to.be.true;

    // Inactive scope data (2025-11) should be deleted
    expect(table.store.has('2025-11-old')).to.be.false;
    expect(table.store.has('2025-11-demo')).to.be.false;

    // Inactive scope checkpoint stays cleared (no pull for it)
    expect(meta.store.has('bookings:2025-11')).to.be.false;
    // Active scope checkpoints are re-created by reconciliation pull
    expect(meta.store.has('bookings:2026-01')).to.be.true;
    expect(meta.store.has('bookings:2026-02')).to.be.true;
  });

  it('should not delete any data when there are no inactive scopes', async () => {
    table.store.set('2026-01-a', { _id: '2026-01-a', name: 'Jan booking' });
    meta.store.set('bookings:2026-01', { key: 'bookings:2026-01', checkpoint: { updatedAt: new Date(), id: 'x' } });

    const pullHandler: PullHandler = async (_cp, _bs, scope) => {
      if (scope === '2026-01') {
        return {
          documents: [{ _id: '2026-01-a', name: 'Jan booking' }],
          checkpoint: { updatedAt: new Date(), id: '2026-01-a' },
          hasMore: false,
        };
      }
      return { documents: [], checkpoint: null, hasMore: false };
    };

    const replication = createReplication(table, db, pullHandler, {
      reconcileFilter: monthReconcileFilter,
    });
    replication.setActiveScopes(['2026-01']);
    await new Promise(r => setTimeout(r, 50));

    await replication.reSync();

    expect(table.store.has('2026-01-a')).to.be.true;
    expect(table.store.size).to.equal(1);
  });

  it('should skip inactive scope deletion when no reconcileFilter (global replication)', async () => {
    // Properties replication: no reconcileFilter, global scope
    table.store.set('prop-1', { _id: 'prop-1', name: 'Property 1' });
    table.store.set('prop-old', { _id: 'prop-old', name: 'Old property' });
    meta.store.set('bookings', { key: 'bookings', checkpoint: { updatedAt: new Date(), id: 'x' } });
    // Simulate an orphan meta key that looks like a scope
    meta.store.set('bookings:orphan', { key: 'bookings:orphan', checkpoint: { updatedAt: new Date(), id: 'y' } });

    const pullHandler: PullHandler = async () => ({
      documents: [{ _id: 'prop-1', name: 'Property 1' }],
      checkpoint: { updatedAt: new Date(), id: 'prop-1' },
      hasMore: false,
    });

    // No reconcileFilter — global replication like properties
    const replication = createReplication(table, db, pullHandler);
    replication.start();
    await new Promise(r => setTimeout(r, 50));

    await replication.reSync();

    // prop-1 stays (returned by server), prop-old removed by reconciliation (not returned)
    expect(table.store.has('prop-1')).to.be.true;
    expect(table.store.has('prop-old')).to.be.false;
    // Orphan meta key should still be cleaned
    expect(meta.store.has('bookings:orphan')).to.be.false;
    // Global checkpoint is re-created by executePull after clearing
    expect(meta.store.has('bookings')).to.be.true;
  });
});

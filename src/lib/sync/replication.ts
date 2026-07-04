import type { Checkpoint, ReplicationOptions } from './types';
import { sleep, sanitizeForStorage } from './helpers';

type ScopeStatus = 'idle' | 'syncing' | 'error' | 'initial';

type ErrorListener = (error: unknown, scope: string | null) => void;

class ScopeState<T extends { _id: string }> {
  status: ScopeStatus = 'initial';
  lastSyncAt: Date | null = null;
  error: unknown = null;
  private abortController: AbortController | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private usingLocks = false;

  constructor(
    public readonly scopeKey: string | null,
    private replication: Replication<T>
  ) {}

  async start(): Promise<void> {
    this.abortController = new AbortController();

    if ('locks' in navigator) {
      this.usingLocks = true;
      this.acquireLock().catch(() => {}); // errors already handled via emitError in pullWithRetry
    } else {
      await this.pullWithRetry();
      if (this.replication.options.live !== false) {
        this.startPolling();
      }
    }
  }

  stop(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.usingLocks = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  sync(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.pullWithRetry()
      .then(() => {
        if (!this.usingLocks && this.replication.options.live !== false && this.abortController && !this.abortController.signal.aborted) {
          this.startPolling();
        }
      })
      .catch((err) => {
        this.replication.emitError(err, this.scopeKey);
        if (!this.usingLocks && this.replication.options.live !== false && this.abortController && !this.abortController.signal.aborted) {
          this.startPolling();
        }
      });
  }

  private async acquireLock(): Promise<void> {
    const dbName = this.replication.options.db.name;
    const lockName = `sync-${dbName}-${this.replication.options.name}:${this.scopeKey ?? 'global'}`;
    const signal = this.abortController!.signal;

    try {
      await navigator.locks.request(lockName, { signal }, async () => {
        await this.pullWithRetry();

        if (this.replication.options.live !== false) {
          const interval = this.replication.options.pollInterval ?? 30_000;
          while (!signal.aborted) {
            await sleep(interval, signal);
            if (signal.aborted) break;
            await this.pullWithRetry();
          }
        }
      });
    } catch {
      // Lock released on abort
    }
  }

  private startPolling(): void {
    const interval = this.replication.options.pollInterval ?? 30_000;
    this.pollTimer = setInterval(() => this.pullWithRetry(), interval);
  }

  private async pullWithRetry(): Promise<void> {
    const retryTime = this.replication.options.retryTime ?? 5_000;
    const maxRetries = 3;
    const signal = this.abortController?.signal;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (signal?.aborted) return;

      try {
        this.status = 'syncing';
        await this.replication.executePull(this.scopeKey);
        this.status = 'idle';
        this.lastSyncAt = new Date();
        this.error = null;
        return;
      } catch (err) {
        this.error = err;
        this.status = 'error';
        this.replication.emitError(err, this.scopeKey);
        if (attempt < maxRetries - 1) {
          await sleep(retryTime * (attempt + 1), signal);
        }
      }
    }
  }
}

export class Replication<T extends { _id: string } = any> {
  private scopes = new Map<string, ScopeState<T>>();
  private globalScope: ScopeState<T> | null = null;
  private errorListeners: ErrorListener[] = [];
  private _generation = 0;
  private _reconcileIds: Set<string> | null = null;
  private _reSyncing = false;
  private _reSyncPromise: Promise<void> | null = null;
  private _pendingScopeKeys: string[] | null = null;
  private _pendingSync = false;

  constructor(public readonly options: ReplicationOptions<T>) {}

  private metaKey(scopeKey: string | null): string {
    return scopeKey ? `${this.options.name}:${scopeKey}` : this.options.name;
  }

  async executePull(scopeKey: string | null): Promise<number> {
    const { db } = this.options;
    const gen = this._generation;
    const metaKey = this.metaKey(scopeKey);
    const meta = await db._replicationMeta.get(metaKey);
    let checkpoint: Checkpoint | null = meta?.checkpoint ?? null;
    const batchSize = this.options.pull.batchSize ?? 100;
    const deletedField = this.options.deletedField ?? 'removedAt';
    let totalProcessed = 0;

    let hasMore = true;
    while (hasMore) {
      if (this._generation !== gen) return totalProcessed;

      const result = await this.options.pull.handler(checkpoint, batchSize, scopeKey);

      if (this._generation !== gen) return totalProcessed;

      if (result.documents.length > 0) {
        const toDelete: string[] = [];
        const toUpsert: any[] = [];

        for (const doc of result.documents) {
          if ((doc as any)[deletedField]) {
            toDelete.push(doc._id);
          } else {
            toUpsert.push(doc);
          }
        }

        if (this._reconcileIds) {
          for (const doc of toUpsert) {
            this._reconcileIds.add(doc._id);
          }
        }

        await db.transaction('rw', [this.options.table, db._replicationMeta], async () => {
          if (toUpsert.length) await this.options.table.bulkPut(toUpsert.map(sanitizeForStorage));
          if (toDelete.length) await this.options.table.bulkDelete(toDelete);
          await db._replicationMeta.put({
            key: metaKey,
            checkpoint: result.checkpoint,
            lastSyncAt: Date.now(),
            status: 'idle',
          });
        });

        totalProcessed += result.documents.length;
      }

      checkpoint = result.checkpoint;
      hasMore = result.hasMore ?? (result.documents.length >= batchSize);
    }

    if (totalProcessed === 0 && this._generation === gen) {
      // Skip write when checkpoint unchanged
      const cpChanged = !meta
        || meta.checkpoint?.id !== checkpoint?.id
        || meta.checkpoint?.updatedAt?.getTime() !== checkpoint?.updatedAt?.getTime();
      if (cpChanged) {
        await db._replicationMeta.put({
          key: metaKey,
          checkpoint,
          lastSyncAt: Date.now(),
          status: 'idle',
        });
      }
    }

    return totalProcessed;
  }

  start(): void {
    if (this.globalScope) return;
    this.globalScope = new ScopeState<T>(null, this);
    void this.globalScope.start();
  }

  stop(): void {
    this.globalScope?.stop();
    this.globalScope = null;
    for (const [, state] of this.scopes) {
      state.stop();
    }
    this.scopes.clear();
  }

  setActiveScopes(scopeKeys: string[]): void {
    if (this._reSyncing) {
      this._pendingScopeKeys = scopeKeys;
      return;
    }

    const newSet = new Set(scopeKeys);

    for (const [key, state] of this.scopes) {
      if (!newSet.has(key)) {
        state.stop();
        this.scopes.delete(key);
      }
    }

    for (const key of scopeKeys) {
      if (!this.scopes.has(key)) {
        const state = new ScopeState<T>(key, this);
        this.scopes.set(key, state);
        void state.start();
      }
    }
  }

  getScope(key: string): ScopeState<T> | undefined {
    return this.scopes.get(key);
  }

  sync(): void {
    if (this._reSyncing) {
      this._pendingSync = true;
      return;
    }

    if (this.globalScope) {
      this.globalScope.sync();
    }
    for (const [, state] of this.scopes) {
      state.sync();
    }
  }

  async reSync(): Promise<void> {
    if (this._reSyncPromise) return this._reSyncPromise;
    this._reSyncPromise = this._doReSync();
    try {
      await this._reSyncPromise;
    } finally {
      this._reSyncPromise = null;
    }
  }

  private async _doReSync(): Promise<void> {
    const { db } = this.options;

    // Block concurrent setActiveScopes/sync during reSync
    this._reSyncing = true;
    this._pendingScopeKeys = null;
    this._pendingSync = false;

    // Invalidate any in-progress executePull calls so they skip writes
    this._generation++;
    const gen = this._generation;

    // Save current scope configuration before stopping
    const hadGlobal = !!this.globalScope;
    const scopeKeys = Array.from(this.scopes.keys());

    // Collect ALL previously synced scope keys from meta (includes inactive months)
    const allMetaKeys = await db._replicationMeta.toCollection().primaryKeys() as string[];
    const prefix = this.options.name + ':';
    const allScopeKeys = allMetaKeys
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length));
    const inactiveScopeKeys = allScopeKeys.filter(k => !scopeKeys.includes(k));

    // Stop all scopes to abort acquireLock loops
    if (this.globalScope) {
      this.globalScope.stop();
      this.globalScope = null;
    }
    for (const [, state] of this.scopes) {
      state.stop();
    }
    this.scopes.clear();

    // Clear ALL replication checkpoints (active + inactive), NOT the data table.
    // Keeping existing data for active scopes avoids an empty UI flash.
    await db.transaction('rw', [db._replicationMeta], async () => {
      const name = this.options.name;
      for (const k of allMetaKeys) {
        if (k === name || k.startsWith(name + ':')) {
          await db._replicationMeta.delete(k);
        }
      }
    });

    // Delete data for inactive scopes — will be re-pulled fresh when user scrolls there
    if (inactiveScopeKeys.length > 0 && this.options.reconcileFilter) {
      const inactiveIds = await this.options.reconcileFilter(inactiveScopeKeys)(this.options.table);
      if (inactiveIds.length > 0) {
        await this.options.table.bulkDelete(inactiveIds);
      }
    }

    // --- Reconciliation: full re-pull then delete ghost documents ---
    this._reconcileIds = new Set<string>();

    try {
      const pullScopes: Array<string | null> = [];
      if (hadGlobal) pullScopes.push(null);
      for (const key of scopeKeys) pullScopes.push(key);

      // Pull all scopes sequentially (checkpoint=null → full pull)
      for (const scope of pullScopes) {
        if (this._generation !== gen) return;
        await this.executePull(scope);
      }

      if (this._generation !== gen) return;

      // Delete local docs not received from server (hard-deleted ghosts)
      const localIds = this.options.reconcileFilter
        ? await this.options.reconcileFilter(scopeKeys)(this.options.table)
        : await this.options.table.toCollection().primaryKeys() as string[];
      const receivedIds = this._reconcileIds;
      const toDelete = localIds.filter(id => !receivedIds.has(id));
      if (toDelete.length > 0) {
        await this.options.table.bulkDelete(toDelete);
      }
    } catch (err) {
      this.emitError(err, null);
    } finally {
      this._reconcileIds = null;
      this._reSyncing = false;
    }

    if (this._generation !== gen) return;

    // Use pending scope keys from scroll events during reSync, or fall back to saved keys
    const finalScopeKeys = this._pendingScopeKeys ?? scopeKeys;
    const shouldSync = this._pendingSync;
    this._pendingScopeKeys = null;
    this._pendingSync = false;

    // Restart normal polling
    if (hadGlobal) {
      this.start();
    }
    if (finalScopeKeys.length > 0) {
      this.setActiveScopes(finalScopeKeys);
    }
    if (shouldSync) {
      this.sync();
    }
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.push(listener);
    return () => {
      this.errorListeners = this.errorListeners.filter((l) => l !== listener);
    };
  }

  emitError(error: unknown, scope: string | null): void {
    for (const listener of this.errorListeners) {
      try {
        listener(error, scope);
      } catch {
        // don't let listener errors propagate
      }
    }
  }
}

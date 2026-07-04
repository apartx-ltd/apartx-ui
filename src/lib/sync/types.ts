import type Dexie from 'dexie';

export interface Checkpoint {
  updatedAt: Date;
  id: string;
}

export interface PullResult<T> {
  documents: T[];
  checkpoint: Checkpoint | null;
  hasMore?: boolean;
}

export type PullHandler<T> = (
  checkpoint: Checkpoint | null,
  batchSize: number,
  scope: string | null
) => Promise<PullResult<T>>;

export interface ReplicationDbRef {
  name: string;
  _replicationMeta: Dexie.Table;
  transaction: Dexie['transaction'];
}

export interface ReplicationOptions<T extends { _id: string }> {
  name: string;
  db: ReplicationDbRef;
  table: Dexie.Table;
  pull: {
    handler: PullHandler<T>;
    batchSize?: number;
  };
  deletedField?: string;
  live?: boolean;
  pollInterval?: number;
  retryTime?: number;
  reconcileFilter?: (scopeKeys: string[]) => (table: Dexie.Table) => Promise<string[]>;
}

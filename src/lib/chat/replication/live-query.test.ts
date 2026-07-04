import { describe, it, expect } from 'vitest';
import { makeSnapshotDiffer, type DiffItem } from './live-query.svelte';

interface Row extends DiffItem { text?: string }

const at = (iso: string): Date => new Date(iso);

describe('makeSnapshotDiffer', () => {
  it('yields all rows as upserts on the first snapshot', () => {
    const diff = makeSnapshotDiffer<Row>();
    const r = diff([
      { _id: 'a', updatedAt: at('2026-07-01T00:00:00Z') },
      { _id: 'b', updatedAt: at('2026-07-01T00:00:01Z') },
    ]);
    expect(r.upserts.map((x) => x._id).sort()).toEqual(['a', 'b']);
    expect(r.deletedIds).toEqual([]);
  });

  it('emits no upsert when updatedAt is unchanged', () => {
    const diff = makeSnapshotDiffer<Row>();
    diff([{ _id: 'a', updatedAt: at('2026-07-01T00:00:00Z') }]);
    const r = diff([{ _id: 'a', updatedAt: at('2026-07-01T00:00:00Z') }]);
    expect(r.upserts).toEqual([]);
    expect(r.deletedIds).toEqual([]);
  });

  it('emits an upsert when updatedAt changes', () => {
    const diff = makeSnapshotDiffer<Row>();
    diff([{ _id: 'a', updatedAt: at('2026-07-01T00:00:00Z') }]);
    const r = diff([{ _id: 'a', updatedAt: at('2026-07-01T00:05:00Z') }]);
    expect(r.upserts.map((x) => x._id)).toEqual(['a']);
    expect(r.deletedIds).toEqual([]);
  });

  it('reports a removed id as deleted', () => {
    const diff = makeSnapshotDiffer<Row>();
    diff([
      { _id: 'a', updatedAt: at('2026-07-01T00:00:00Z') },
      { _id: 'b', updatedAt: at('2026-07-01T00:00:00Z') },
    ]);
    const r = diff([{ _id: 'a', updatedAt: at('2026-07-01T00:00:00Z') }]);
    expect(r.upserts).toEqual([]);
    expect(r.deletedIds).toEqual(['b']);
  });

  it('re-adds a previously removed id as an upsert', () => {
    const diff = makeSnapshotDiffer<Row>();
    diff([{ _id: 'a', updatedAt: at('2026-07-01T00:00:00Z') }]);
    diff([]); // 'a' removed
    const r = diff([{ _id: 'a', updatedAt: at('2026-07-01T00:00:00Z') }]);
    expect(r.upserts.map((x) => x._id)).toEqual(['a']);
    expect(r.deletedIds).toEqual([]);
  });

  it('treats a missing updatedAt as epoch 0 and only upserts on change', () => {
    const diff = makeSnapshotDiffer<Row>();
    const first = diff([{ _id: 'a' }]);
    expect(first.upserts.map((x) => x._id)).toEqual(['a']);
    const second = diff([{ _id: 'a' }]);
    expect(second.upserts).toEqual([]);
  });
});

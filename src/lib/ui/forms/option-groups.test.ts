import { describe, it, expect } from 'vitest';
import { groupOptions } from './option-groups';

describe('groupOptions', () => {
  it('без group — одна серия без заголовка', () => {
    const out = groupOptions([{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]);
    expect(out).toEqual([{ label: undefined, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }]);
  });

  it('серии по соседям: одинаковый group в разных местах — разные серии', () => {
    const out = groupOptions([
      { value: 'k1', label: 'K1' },
      { value: 's1', label: 'S1', group: 'Saved' },
      { value: 's2', label: 'S2', group: 'Saved' },
      { value: 'o', label: 'Other' },
      { value: 's3', label: 'S3', group: 'Saved' },
    ]);
    expect(out.map((g) => [g.label, g.options.map((o) => o.value)])).toEqual([
      [undefined, ['k1']],
      ['Saved', ['s1', 's2']],
      [undefined, ['o']],
      ['Saved', ['s3']],
    ]);
  });

  it('пустой список — пусто', () => {
    expect(groupOptions([])).toEqual([]);
  });
});

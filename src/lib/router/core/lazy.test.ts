import { describe, it, expect, vi } from 'vitest';
import { getCached, load } from './lazy';

describe('lazy route cache', () => {
  it('returns undefined before load, the component after', async () => {
    const Comp = { name: 'Page' };
    const loader = vi.fn(() => Promise.resolve({ default: Comp }));
    expect(getCached(loader)).toBeUndefined();
    const resolved = await load(loader);
    expect(resolved).toBe(Comp);
    expect(getCached(loader)).toBe(Comp);
  });

  it('dedupes concurrent loads (loader called once)', async () => {
    const Comp = { name: 'Page2' };
    const loader = vi.fn(() => Promise.resolve({ default: Comp }));
    const [a, b] = await Promise.all([load(loader), load(loader)]);
    expect(a).toBe(Comp);
    expect(b).toBe(Comp);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('serves from cache on subsequent loads without re-invoking the loader', async () => {
    const Comp = { name: 'Page3' };
    const loader = vi.fn(() => Promise.resolve({ default: Comp }));
    await load(loader);
    await load(loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(getCached(loader)).toBe(Comp);
  });
});

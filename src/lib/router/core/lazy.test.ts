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

  it('logs a failed load and lets the next visit retry the loader', async () => {
    const err = new TypeError("Cannot read properties of undefined (reading 'call')");
    const Comp = { name: 'Page4' };
    const loader = vi
      .fn<() => Promise<{ default: any }>>()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({ default: Comp });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(load(loader)).rejects.toBe(err);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('apartx-ui/router'), err);
      expect(getCached(loader)).toBeUndefined();
      await expect(load(loader)).resolves.toBe(Comp);
      expect(loader).toHaveBeenCalledTimes(2);
    } finally {
      log.mockRestore();
    }
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

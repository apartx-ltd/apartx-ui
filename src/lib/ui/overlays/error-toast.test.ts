import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveErrorHelp, clearErrorHelpCache,
  buildErrorDetails, sanitizeDetails,
} from './error-toast';

describe('resolveErrorHelp cache', () => {
  beforeEach(() => clearErrorHelpCache());

  it('промах зовёт хендлер один раз, повтор — из кэша', async () => {
    const h = vi.fn().mockResolvedValue([{ slug: 's', title: 't' }]);
    expect(await resolveErrorHelp('errors.a', 'ru', h)).toEqual([{ slug: 's', title: 't' }]);
    expect(await resolveErrorHelp('errors.a', 'ru', h)).toEqual([{ slug: 's', title: 't' }]);
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('пустой ответ кэшируется (negative-кэш)', async () => {
    const h = vi.fn().mockResolvedValue([]);
    await resolveErrorHelp('errors.b', 'ru', h);
    await resolveErrorHelp('errors.b', 'ru', h);
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('локаль входит в ключ кэша', async () => {
    const h = vi.fn().mockResolvedValue([]);
    await resolveErrorHelp('errors.c', 'ru', h);
    await resolveErrorHelp('errors.c', 'en', h);
    expect(h).toHaveBeenCalledTimes(2);
  });

  it('два одновременных вызова → один запрос (дедуп in-flight)', async () => {
    let release!: (v: never[]) => void;
    const h = vi.fn().mockReturnValue(new Promise((r) => { release = r; }));
    const p1 = resolveErrorHelp('errors.d', 'ru', h);
    const p2 = resolveErrorHelp('errors.d', 'ru', h);
    release([]);
    expect(await p1).toEqual([]);
    expect(await p2).toEqual([]);
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('отказ не отравляет кэш — следующий вызов спрашивает снова', async () => {
    const h = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([]);
    await expect(resolveErrorHelp('errors.e', 'ru', h)).rejects.toThrow('boom');
    expect(await resolveErrorHelp('errors.e', 'ru', h)).toEqual([]);
    expect(h).toHaveBeenCalledTimes(2);
  });
});

describe('sanitizeDetails', () => {
  it('скаляр проходит', () => expect(sanitizeDetails('x')).toBe('x'));

  it('null/undefined → null', () => {
    expect(sanitizeDetails(null)).toBeNull();
    expect(sanitizeDetails(undefined)).toBeNull();
  });

  it('короткий объект без стоп-ключей проходит', () =>
    expect(sanitizeDetails({ lockId: '1' })).toBe('{"lockId":"1"}'));

  it('стоп-ключ режет весь объект', () => {
    for (const k of ['phone', 'userEmail', 'iin', 'passportNo', 'accessToken', 'password'])
      expect(sanitizeDetails({ [k]: 'x' })).toBeNull();
  });

  it('длинный объект режется', () => {
    const o = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`k${i}`, i]));
    expect(sanitizeDetails(o)).toBeNull();
  });
});

describe('buildErrorDetails', () => {
  it('собирает блок из спеки', () => {
    const text = buildErrorDetails({
      errorKey: 'errors.lock_not_found',
      httpCode: 404,
      message: 'Замок не найден',
      path: '/accounts/properties/abc/locks',
      now: new Date('2026-09-01T09:32:00+05:00'),
      extra: { user: '7fK2m', build: '1.11.212' },
    });
    const lines = text.split('\n');
    expect(lines[0]).toBe('errors.lock_not_found · HTTP 404');
    expect(lines[1]).toBe('Замок не найден');
    expect(lines[2]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{2}:\d{2} · \/accounts\/properties\/abc\/locks$/);
    expect(lines[3]).toBe('user 7fK2m · build 1.11.212');
  });

  it('пропускает отсутствующее без пустых строк', () => {
    const text = buildErrorDetails({ errorKey: 'errors.x', message: 'm', path: '/', now: new Date() });
    expect(text.split('\n')).toHaveLength(3);
    expect(text).not.toContain('HTTP');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveErrorHelp, clearErrorHelpCache,
  buildErrorDetails, sanitizeDetails, errorHelpProps,
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

  it('не-ключ (человеческая фраза в reason) до транспорта не доходит', async () => {
    // Легаси-места отдают `reason: 'Not a valid code'`; сервер такой «ключ» отвергает
    // Match-исключением, так что спрашивать по нему нечего.
    const h = vi.fn();
    expect(await resolveErrorHelp('Not a valid code', 'ru', h)).toEqual([]);
    expect(await resolveErrorHelp('', 'ru', h)).toEqual([]);
    expect(h).not.toHaveBeenCalled();
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

  it('стоп-ключ выбрасывает своё поле, остальное остаётся', () => {
    for (const k of ['phone', 'userEmail', 'iin', 'passportNo', 'accessToken', 'password'])
      expect(sanitizeDetails({ lockId: '1', [k]: 'x' })).toBe('{"lockId":"1"} … +1');
  });

  it('стоп-ключ на втором уровне вложенности выбрасывается тоже', () =>
    expect(sanitizeDetails({ user: { id: '7', phone: '+7700' } }))
      .toBe('{"user":{"id":"7"}} … +1'));

  it('шестое поле отбрасывается, первые пять остаются', () => {
    const o = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`k${i}`, i]));
    expect(sanitizeDetails(o)).toBe('{"k0":0,"k1":1,"k2":2,"k3":3,"k4":4} … +1');
  });

  it('длинное значение режется до 200 символов, но потерей не считается', () => {
    const out = sanitizeDetails({ dump: 'x'.repeat(500) })!;
    expect(out).toContain(`${'x'.repeat(200)}…`);
    expect(out).not.toContain('x'.repeat(201));
    expect(out).not.toContain('+');
  });

  it('значение глубже четвёртого уровня отбрасывается и считается', () =>
    expect(sanitizeDetails({ a: { b: { c: { d: { e: 1 } } } } }))
      .toBe('{"a":{"b":{"c":{}}}} … +1'));

  it('массив чистится теми же правилами', () =>
    expect(sanitizeDetails({ list: [{ id: 1, phone: '+7700' }] }))
      .toBe('{"list":[{"id":1}]} … +1'));

  it('после чистки не осталось ничего — одна пометка', () =>
    expect(sanitizeDetails({ phone: '+7700', email: 'a@b.c' })).toBe('… +2'));

  it('пустой объект без потерь остаётся собой', () =>
    expect(sanitizeDetails({})).toBe('{}'));
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

  it('пустой message не превращается в пустую строку', () => {
    const text = buildErrorDetails({ errorKey: 'errors.x', message: '', path: '/', now: new Date() });
    expect(text.split('\n')).toHaveLength(2);
    expect(text).not.toContain('\n\n');
  });
});

describe('buildErrorDetails: контекст', () => {
  it('context уезжает отдельной строкой k v · k v, остаток details — своей', () => {
    const text = buildErrorDetails({
      errorKey: 'errors.locks.connection_timeout',
      message: 'Не удалось подключиться к замку',
      path: '/accounts/settings/locks/aBc123',
      now: new Date('2026-09-04T09:41:00+05:00'),
      extra: { user: '7fH2k9' },
      details: { context: { lock: 'aBc123', via: 'ble' }, source: 'connect' },
    });
    const lines = text.split('\n');
    expect(lines[3]).toBe('user 7fH2k9');
    expect(lines[4]).toBe('lock aBc123 · via ble');
    expect(lines[5]).toBe('{"source":"connect"}');
  });

  it('контекст не расходует бюджет пяти полей остатка', () => {
    const text = buildErrorDetails({
      errorKey: 'e.k',
      message: 'm',
      path: '/',
      now: new Date(),
      details: {
        context: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 },
        k0: 0, k1: 1, k2: 2, k3: 3, k4: 4,
      },
    });
    const lines = text.split('\n');
    expect(lines[3]).toBe('a 1 · b 2 · c 3 · d 4 · e 5 · f 6');
    expect(lines[4]).toBe('{"k0":0,"k1":1,"k2":2,"k3":3,"k4":4}');
  });

  it('details из одного только контекста не даёт второй строки', () => {
    const text = buildErrorDetails({
      errorKey: 'e.k', message: 'm', path: '/', now: new Date(),
      details: { context: { lock: 'x' } },
    });
    expect(text.split('\n')).toHaveLength(4);
    expect(text.endsWith('lock x')).toBe(true);
  });

  it('пустые значения контекста не печатаются', () => {
    const text = buildErrorDetails({
      errorKey: 'e.k', message: 'm', path: '/', now: new Date(),
      details: { context: { lock: 'x', name: '', ble: null } },
    });
    expect(text.split('\n')[3]).toBe('lock x');
  });

  it('стоп-ключ в контексте не печатается', () => {
    const text = buildErrorDetails({
      errorKey: 'e.k', message: 'm', path: '/', now: new Date(),
      details: { context: { lock: 'x', phone: '+7700' } },
    });
    expect(text.split('\n')[3]).toBe('lock x');
  });

  it('контекст длиннее двенадцати полей режется', () => {
    const context = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`k${i}`, i]));
    const text = buildErrorDetails({
      errorKey: 'e.k', message: 'm', path: '/', now: new Date(), details: { context },
    });
    expect(text.split('\n')[3].split(' · ')).toHaveLength(12);
  });
});

describe('errorHelpProps', () => {
  it('Meteor.Error-подобный объект: reason → ключ, числовой error → HTTP-код', () => {
    expect(errorHelpProps({ error: 429, reason: 'accounts.errors.max_retry_blocked', message: 'blocked [429]', details: { nextRetry: 1 } }))
      .toEqual({ errorKey: 'accounts.errors.max_retry_blocked', httpCode: 429, message: 'blocked [429]', details: { nextRetry: 1 } });
  });

  it('строковый error (легаси-код) — не HTTP-код; reason не по форме ключа всё равно остаётся ключом строки действий', () => {
    // Форму ключа здесь не проверяем: не-ключи отсекает resolveErrorHelp, а копирование
    // и саппорт полезны и для «Not a valid code».
    expect(errorHelpProps({ error: 'not-found', reason: 'Not a valid code' }))
      .toEqual({ errorKey: 'Not a valid code', httpCode: null, message: '', details: undefined });
  });

  it('голый Error, строка, null — без ключа', () => {
    expect(errorHelpProps(new Error('boom')).errorKey).toBeNull();
    expect(errorHelpProps(new Error('boom')).message).toBe('boom');
    expect(errorHelpProps('boom')).toEqual({ errorKey: null, httpCode: null, message: 'boom', details: undefined });
    expect(errorHelpProps(null)).toEqual({ errorKey: null, httpCode: null, message: '', details: undefined });
  });
});

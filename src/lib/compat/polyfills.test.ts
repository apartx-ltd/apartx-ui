import { describe, expect, it } from 'vitest';
import { at, findLastIndex, installPolyfills, replaceAll, structuredCloneShim } from './polyfills.js';

// Шимы проверяем напрямую: в Node 22 всё это нативное, и тест через глобальные объекты
// проверял бы реализацию Node, а не нашу.
describe('polyfills', () => {
  it('не перетирает то, что уже есть', () => {
    const native = Object.hasOwn;
    installPolyfills();
    expect(Object.hasOwn).toBe(native);
  });

  it('ставит недостающее на чистый объект', () => {
    const host: Record<string, unknown> = {};
    installPolyfills(host as ObjectConstructor);
    expect((host.hasOwn as (o: object, k: string) => boolean)({ a: 1 }, 'a')).toBe(true);
    expect((host.hasOwn as (o: object, k: string) => boolean)({ a: 1 }, 'b')).toBe(false);
  });

  it('at считает с конца и возвращает undefined за границей', () => {
    expect(at.call([1, 2, 3], -1)).toBe(3);
    expect(at.call([1, 2, 3], 0)).toBe(1);
    expect(at.call([1, 2, 3], 3)).toBeUndefined();
    expect(at.call('abc', -2)).toBe('b');
  });

  it('replaceAll меняет все вхождения, включая функцию-замену', () => {
    expect(replaceAll.call('a-b-c', '-', '+')).toBe('a+b+c');
    expect(replaceAll.call('a-b', '-', () => '!')).toBe('a!b');
    expect(replaceAll.call('abc', 'x', '!')).toBe('abc');
    expect(() => replaceAll.call('abc', /b/, '!')).toThrow(TypeError);
    expect(replaceAll.call('abc', /b/g, '!')).toBe('a!c');
  });

  it('findLastIndex идёт с конца', () => {
    expect(findLastIndex.call([1, 2, 3, 2], (x: number) => x === 2)).toBe(3);
    expect(findLastIndex.call([1], (x: number) => x === 9)).toBe(-1);
  });

  it('structuredCloneShim копирует Date, Map, Set и циклы', () => {
    const source: Record<string, unknown> = { when: new Date(0), map: new Map([['k', 1]]), set: new Set([1]) };
    source.self = source;
    const copy = structuredCloneShim(source) as Record<string, any>;
    expect(copy.when.getTime()).toBe(0);
    expect(copy.when).not.toBe(source.when);
    expect(copy.map.get('k')).toBe(1);
    expect(copy.set.has(1)).toBe(true);
    expect(copy.self).toBe(copy);
  });
});

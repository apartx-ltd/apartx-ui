import { describe, expect, it } from 'vitest';
import { classifyValue } from './json-value';

describe('classifyValue', () => {
  it('classifies JSON primitives', () => {
    expect(classifyValue('a')).toEqual({ kind: 'string', text: '"a"' });
    expect(classifyValue(42)).toEqual({ kind: 'number', text: '42' });
    expect(classifyValue(true)).toEqual({ kind: 'boolean', text: 'true' });
    expect(classifyValue(null)).toEqual({ kind: 'null', text: 'null' });
    expect(classifyValue(undefined)).toEqual({ kind: 'undefined', text: 'undefined' });
  });

  it('renders Date as local text with ISO title', () => {
    const d = new Date(2026, 7, 28, 14, 3, 11);
    expect(classifyValue(d)).toEqual({
      kind: 'date',
      text: '2026-08-28 14:03:11',
      title: d.toISOString(),
    });
  });

  it('survives invalid Date', () => {
    const r = classifyValue(new Date(NaN));
    expect(r.kind).toBe('date');
    expect(r).toHaveProperty('text', 'Invalid Date');
  });

  it('renders RegExp as source text', () => {
    expect(classifyValue(/ab+c/gi)).toEqual({ kind: 'regexp', text: '/ab+c/gi' });
  });

  it('duck-types ObjectId via toHexString', () => {
    const oid = { _bsontype: 'ObjectId', toHexString: () => '507f1f77bcf86cd799439011' };
    expect(classifyValue(oid)).toEqual({ kind: 'objectid', text: '507f1f77bcf86cd799439011' });
  });

  it('duck-types Decimal128 via _bsontype', () => {
    const d128 = { _bsontype: 'Decimal128', toString: () => '12.50' };
    expect(classifyValue(d128)).toEqual({ kind: 'decimal', text: '12.50' });
  });

  it('duck-types decimal.js Decimal by its API, not by the constructor name', () => {
    class Decimal {
      toDecimalPlaces() { return this; }
      toString() { return '99.9'; }
    }
    expect(classifyValue(new Decimal())).toEqual({ kind: 'decimal', text: '99.9' });

    // В прод-бандле имя класса минифицируется в `o`, а decimal.js ещё и кладёт
    // СВОЙ перечислимый `constructor` в инстанс — по имени такой объект не опознать,
    // и дерево вываливало тело минифицированной функции вместо числа.
    class o {
      constructor() {
        (this as any).constructor = o;
        (this as any).s = 1;
        (this as any).e = 1;
        (this as any).d = [10];
      }
      toDecimalPlaces() { return this; }
      toString() { return '10'; }
    }
    expect(classifyValue(new o())).toEqual({ kind: 'decimal', text: '10' });
  });

  it('renders a function as a signature, not as its source', () => {
    expect(classifyValue(function parse(a: number) { return a; })).toEqual({
      kind: 'function',
      text: 'ƒ parse()',
    });
    expect(classifyValue(() => 1)).toEqual({ kind: 'function', text: 'ƒ ()' });
  });

  it('reports containers without text', () => {
    expect(classifyValue({ a: 1 })).toEqual({ kind: 'object' });
    expect(classifyValue([1, 2])).toEqual({ kind: 'array' });
  });
});

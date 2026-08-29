/**
 * Тип-инспектор для JsonTree: классифицирует runtime-значение и рендерит
 * спецтипы (Date, Decimal, ObjectId, RegExp) в человекочитаемый текст.
 * Только утиная типизация — киту запрещены импорты bson, decimal и прочих рантаймов.
 */

export type JsonLeafKind =
  | 'string' | 'number' | 'boolean' | 'null' | 'undefined'
  | 'date' | 'decimal' | 'objectid' | 'regexp' | 'function';

export type JsonClass =
  | { kind: JsonLeafKind; text: string; title?: string }
  | { kind: 'object' }
  | { kind: 'array' };

const pad = (n: number) => String(n).padStart(2, '0');

function formatDate(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export function classifyValue(v: unknown): JsonClass {
  if (v === null) return { kind: 'null', text: 'null' };
  if (v === undefined) return { kind: 'undefined', text: 'undefined' };
  const t = typeof v;
  if (t === 'string') return { kind: 'string', text: JSON.stringify(v) };
  if (t === 'number' || t === 'bigint') return { kind: 'number', text: String(v) };
  if (t === 'boolean') return { kind: 'boolean', text: String(v) };
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return { kind: 'date', text: 'Invalid Date' };
    return { kind: 'date', text: formatDate(v), title: v.toISOString() };
  }
  if (v instanceof RegExp) return { kind: 'regexp', text: String(v) };
  if (Array.isArray(v)) return { kind: 'array' };
  if (t === 'object') {
    const o = v as Record<string, unknown>;
    const bsontype = o._bsontype;
    if (bsontype === 'ObjectId' || bsontype === 'ObjectID' || typeof o.toHexString === 'function') {
      const text = typeof o.toHexString === 'function'
        ? (o.toHexString as () => string)()
        : String(v);
      return { kind: 'objectid', text };
    }
    if (bsontype === 'Decimal128') return { kind: 'decimal', text: String(v) };
    // Опознаём decimal.js по API, а НЕ по `constructor.name`: в прод-бандле имя класса
    // минифицируется (`Decimal` → `o`), и по имени инстанс не отличить от обычного объекта.
    // Инстанс при этом несёт собственный перечислимый `constructor` (decimal.js пишет
    // `this.constructor = o` в конструкторе), так что промах разворачивался в дереве телом
    // минифицированной функции вместо числа.
    if (typeof o.toDecimalPlaces === 'function')
      return { kind: 'decimal', text: String(v) };
    return { kind: 'object' };
  }
  if (t === 'function') {
    const name = (v as { name?: string }).name || '';
    return { kind: 'function', text: `ƒ ${name}()` };
  }
  // symbols — деградация в строку, JSON их всё равно не содержит
  return { kind: 'string', text: String(v) };
}

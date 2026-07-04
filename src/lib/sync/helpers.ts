// Decimal (decimal.js / mongo-decimal) приходит по DDP как инстанс класса.
// IndexedDB structured-clone не умеет сериализовать инстансы с методами →
// bulkPut падает с DataCloneError и весь pull-транзакшн откатывается.
// Перед записью в Dexie конвертируем Decimal → строку (потребители читают
// money через `.toString?.() ?? value` → Number(), см. rate-plan-helpers.ts).
//
// ВАЖНО: не опираться ТОЛЬКО на `constructor.name === 'Decimal'` — prod-минификатор
// (rspack/swc) переименовывает класс, и в собранном бандле имя уже не 'Decimal'.
// Тогда Decimal не санитизируется и DataCloneError возникает ТОЛЬКО в проде
// (в dev без минификации имя сохраняется → баг не виден локально). Имена МЕТОДОВ
// на прототипе минификатор не трогает (property-mangling выключен), поэтому
// детектим decimal.js по характерным методам как минификатор-устойчивый фолбэк.
const isDecimalLike = (v: any): boolean =>
  v != null
  && typeof v === 'object'
  && typeof v.toString === 'function'
  && (
    v.constructor?.name === 'Decimal'
    || (typeof v.toFixed === 'function' && typeof v.toSignificantDigits === 'function')
  );

export function sanitizeForStorage<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value;
  if (isDecimalLike(value)) return (value as any).toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(sanitizeForStorage) as any;
  const out: any = {};
  for (const k in value) {
    if (Object.prototype.hasOwnProperty.call(value, k)) {
      out[k] = sanitizeForStorage((value as any)[k]);
    }
  }
  return out;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(); return; }
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    }
  });
}

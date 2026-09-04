/**
 * Политика кнопки «Почему?» в тосте ошибки (спека docs/plans/2026-09-01-error-toast-actions
 * в оркестраторе): кит владеет кэшем и решает, когда звать транспорт; сам транспорт
 * (DDP/HTTP) инжектируется консьюмером через <ToasterMount resolveErrorHelp={...}>.
 */
export type ErrorHelpArticle = { slug: string; title: string };
export type ErrorHelpResolver = (key: string, locale: string) => Promise<ErrorHelpArticle[]>;

// В кэше лежит сам промис: два одновременных тоста одной ошибки дают один вызов,
// пустой ответ — тоже кэш (negative), отклонённый промис из кэша удаляется.
const cache = new Map<string, Promise<ErrorHelpArticle[]>>();

/**
 * Форма ключа ошибки — та же, что проверяет сервер (`isErrorKey` в apartx-server).
 *
 * `reason` у Meteor.Error далеко не всегда ключ: легаси-места отдают человеческую фразу
 * («Not a valid code»), и такой «ключ» сервер отвергает Match-исключением. Спрашивать по
 * нему статью бессмысленно, поэтому даже не ходим — иначе каждый такой тост дарит серверу
 * исключение в логи.
 */
const ERROR_KEY_RE = /^[a-z][a-zA-Z0-9_.]{2,80}$/;

export function isErrorKey(key: unknown): key is string {
  return typeof key === 'string' && ERROR_KEY_RE.test(key);
}

export type ErrorHelpProps = {
  errorKey: string | null;
  httpCode: number | null;
  message: string;
  details: unknown;
};

/**
 * Разбор объекта ошибки для строки действий — один на тост (useNotification) и на
 * <InlineError>: reason как ключ, числовой `error` как HTTP-код, message и details как есть.
 * Форму ключа не проверяем: не-ключи отсекает resolveErrorHelp перед запросом статей, а
 * «Скопировать»/«В саппорт» нужны и по «Not a valid code». Принимает что угодно — голый
 * Error, строку, null — и не бросает: место показа ошибки не должно падать само.
 */
export function errorHelpProps(error: unknown): ErrorHelpProps {
  if (error == null) return { errorKey: null, httpCode: null, message: '', details: undefined };
  if (typeof error === 'string') return { errorKey: null, httpCode: null, message: error, details: undefined };
  const e = error as { error?: unknown; reason?: unknown; message?: unknown; details?: unknown };
  return {
    errorKey: typeof e.reason === 'string' && e.reason ? e.reason : null,
    httpCode: typeof e.error === 'number' ? e.error : null,
    message: typeof e.message === 'string' ? e.message : '',
    details: e.details,
  };
}

export function resolveErrorHelp(
  key: string,
  locale: string,
  handler: ErrorHelpResolver,
): Promise<ErrorHelpArticle[]> {
  if (!isErrorKey(key)) return Promise.resolve([]);
  const cacheKey = `${locale}:${key}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const p = Promise.resolve()
    .then(() => handler(key, locale))
    .then(
      (list) => list ?? [],
      (err) => {
        cache.delete(cacheKey);
        throw err;
      },
    );
  cache.set(cacheKey, p);
  return p;
}

/** Только для тестов. */
export function clearErrorHelpCache(): void {
  cache.clear();
}

// Аргументы метода в детали не попадают никогда; details — чужой payload, поэтому
// чистится пофайлово и вглубь (история саппорт-чата хранится вечно). Раньше любое
// подозрительное поле убивало весь объект, и саппорт не получал ничего — а заодно
// стоп-лист смотрел лишь верхний уровень ключей, так что {user: {phone: …}} проходил.
const DETAILS_STOPLIST = ['phone', 'email', 'iin', 'passport', 'token', 'password'];
const DETAILS_MAX_FIELDS = 5;
const DETAILS_MAX_VALUE = 200;
const DETAILS_MAX_DEPTH = 4;

function isStopKey(key: string): boolean {
  const k = key.toLowerCase();
  return DETAILS_STOPLIST.some((s) => k.includes(s));
}

function truncate(value: string): string {
  return value.length > DETAILS_MAX_VALUE ? `${value.slice(0, DETAILS_MAX_VALUE)}…` : value;
}

/**
 * Чистит значение вглубь, всё выброшенное считает в `counter.n`. Резка длинной строки
 * потерей не считается: она видна на месте по многоточию, а счётчик — про то, чего в
 * блоке нет вовсе.
 */
function cleanValue(value: unknown, depth: number, counter: { n: number }): unknown {
  if (typeof value === 'string') return truncate(value);
  if (value == null || typeof value !== 'object') return value;
  if (depth >= DETAILS_MAX_DEPTH) {
    counter.n += 1;
    return undefined;
  }
  if (Array.isArray(value)) {
    const kept: unknown[] = [];
    for (const item of value) {
      if (kept.length >= DETAILS_MAX_FIELDS) {
        counter.n += 1;
        continue;
      }
      const clean = cleanValue(item, depth + 1, counter);
      if (clean === undefined) continue;
      kept.push(clean);
    }
    return kept;
  }
  const out: Record<string, unknown> = {};
  let kept = 0;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isStopKey(k)) {
      counter.n += 1;
      continue;
    }
    if (kept >= DETAILS_MAX_FIELDS) {
      counter.n += 1;
      continue;
    }
    const clean = cleanValue(v, depth + 1, counter);
    if (clean === undefined) continue;
    out[k] = clean;
    kept += 1;
  }
  return out;
}

export function sanitizeDetails(details: unknown): string | null {
  if (details == null) return null;
  if (typeof details !== 'object') return String(details);
  const counter = { n: 0 };
  const cleaned = cleanValue(details, 0, counter);
  let json: string;
  try {
    json = JSON.stringify(cleaned) ?? '';
  } catch {
    return null;
  }
  // Пометка символьная, а не словесная: кит не владеет i18n, весь его текст приходит
  // пропсами, а проп ради счётчика скрытых полей — лишняя поверхность.
  if (!counter.n) return json;
  if (json === '{}' || json === '[]') return `… +${counter.n}`;
  return `${json} … +${counter.n}`;
}

// Зарезервированный ключ `details.context` — предмет действия (какой замок, каким путём).
// В отличие от остального details это наш выверенный блок, а не чужой payload: печатается
// человекочитаемо и в бюджет пяти полей не входит. Свои ограничения всё равно есть —
// стоп-слова по ключам, потолок полей и та же резка длинных значений.
const CONTEXT_MAX_FIELDS = 12;

function formatContext(context: unknown): string | null {
  if (context == null || typeof context !== 'object' || Array.isArray(context)) return null;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(context as Record<string, unknown>)) {
    if (parts.length >= CONTEXT_MAX_FIELDS) break;
    if (v == null || v === '') continue;
    if (isStopKey(k)) continue;
    parts.push(`${k} ${truncate(String(v))}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

function formatLocal(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const off = -now.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ` +
    `${p(now.getHours())}:${p(now.getMinutes())} ${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`;
}

export function buildErrorDetails(input: {
  errorKey: string;
  message: string;
  path: string;
  now: Date;
  httpCode?: number | null;
  details?: unknown;
  extra?: Record<string, string | undefined>;
}): string {
  const lines: string[] = [];
  lines.push(input.httpCode ? `${input.errorKey} · HTTP ${input.httpCode}` : input.errorKey);
  // Пустой message — не пустая строка в блоке: саппорт получает текст, а не дырку
  // (тост без текста бывает, когда вызывающий отдал только error).
  if (input.message) lines.push(input.message);
  lines.push(`${formatLocal(input.now)} · ${input.path}`);
  const extras = Object.entries(input.extra ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} ${v}`);
  if (extras.length) lines.push(extras.join(' · '));
  let rest = input.details;
  let context: unknown;
  if (rest && typeof rest === 'object' && !Array.isArray(rest) && 'context' in rest) {
    const { context: ctx, ...other } = rest as Record<string, unknown>;
    context = ctx;
    rest = Object.keys(other).length ? other : undefined;
  }
  const ctxLine = formatContext(context);
  if (ctxLine) lines.push(ctxLine);
  const det = sanitizeDetails(rest);
  if (det) lines.push(det);
  return lines.join('\n');
}

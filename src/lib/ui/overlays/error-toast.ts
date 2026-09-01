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

export function resolveErrorHelp(
  key: string,
  locale: string,
  handler: ErrorHelpResolver,
): Promise<ErrorHelpArticle[]> {
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

// Аргументы метода в детали не попадают никогда; details — только скаляр или короткий
// объект без чувствительных ключей (история саппорт-чата хранится вечно).
const DETAILS_STOPLIST = ['phone', 'email', 'iin', 'passport', 'token', 'password'];

export function sanitizeDetails(details: unknown): string | null {
  if (details == null) return null;
  if (typeof details !== 'object') return String(details);
  const entries = Object.entries(details as Record<string, unknown>);
  if (entries.length > 5) return null;
  const dirty = entries.some(([k]) =>
    DETAILS_STOPLIST.some((s) => k.toLowerCase().includes(s)));
  if (dirty) return null;
  try {
    return JSON.stringify(details);
  } catch {
    return null;
  }
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
  lines.push(input.message);
  lines.push(`${formatLocal(input.now)} · ${input.path}`);
  const extras = Object.entries(input.extra ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} ${v}`);
  if (extras.length) lines.push(extras.join(' · '));
  const det = sanitizeDetails(input.details);
  if (det) lines.push(det);
  return lines.join('\n');
}

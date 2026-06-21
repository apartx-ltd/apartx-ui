export interface MatchOptions {
  exact?: boolean;
}

/**
 * Test whether a pathname matches a route pattern with `:param` placeholders.
 * Pure (no browser globals) so it runs identically on the server (SSR first
 * render) and the client (hydration + SPA navigation).
 */
export function matchRoute(
  pathname: string,
  pattern: string,
  options: MatchOptions = {},
): boolean {
  // Catch-all pattern: `*` or `*name` matches anything.
  if (pattern === '*' || pattern.startsWith('*')) return true;
  const paramRe = pattern.replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, '[^/]+');
  const suffix = options.exact ? '/?$' : '(/|$)';
  const re = new RegExp(`^${paramRe}${suffix}`);
  return re.test(pathname);
}

/**
 * Extract `:param` values from a pathname given a route pattern.
 * Returns `{}` when the pattern has no params or does not match.
 *
 * @example
 * matchParams('/property/abc/123', '/property/:slotId/:propertyId')
 * // → { slotId: 'abc', propertyId: '123' }
 */
export function matchParams(
  pathname: string,
  pattern: string,
): Record<string, string> {
  // Catch-all (`*` / `*name`) has no `:params` — and would build an invalid regex
  // (`^*/?$` → "Nothing to repeat"). Bail early.
  if (pattern === '*' || pattern.startsWith('*')) return {};
  const names: string[] = [];
  const reSrc = pattern.replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, (m) => {
    names.push(m.slice(1));
    return '([^/]+)';
  });
  const re = new RegExp(`^${reSrc}/?$`);
  const m = re.exec(pathname);
  if (!m) return {};
  const out: Record<string, string> = {};
  names.forEach((n, i) => { out[n] = decodeURIComponent(m[i + 1]); });
  return out;
}

/**
 * Specificity score: больше статических сегментов — выше; параметры ниже статики;
 * wildcard (`*` / `*name`) — 0 (последний резерв). `/` без сегментов → 1 (бьёт wildcard).
 */
export function rankRoute(pattern: string): number {
  if (pattern === '*' || pattern.startsWith('*')) return 0;
  const segs = pattern.split('/').filter(Boolean);
  let score = 0;
  for (const s of segs) score += s.startsWith(':') ? 5 : 10;
  return score || 1;
}

/**
 * Выбрать самый специфичный матч из списка (ничьи → первый по порядку регистрации).
 * Чистая: одинаково на сервере и клиенте.
 */
export function pick<T extends { path: string; exact?: boolean }>(
  routes: readonly T[],
  pathname: string,
): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const r of routes) {
    if (!matchRoute(pathname, r.path, { exact: r.exact ?? false })) continue;
    const score = rankRoute(r.path);
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Срезать base-префикс с pathname для вложенного роутинга. `base === '/'` → без изменений
 * (наш единственный кейс: shell смонтирован в корне).
 */
export function stripBase(pathname: string, base: string): string {
  if (!base || base === '/') return pathname;
  if (pathname === base) return '/';
  if (pathname.startsWith(base + '/')) return pathname.slice(base.length) || '/';
  if (pathname.startsWith(base)) return pathname.slice(base.length) || '/';
  return pathname;
}

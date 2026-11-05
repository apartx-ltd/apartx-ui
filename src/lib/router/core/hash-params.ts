function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {};
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const pair of body.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) {
      params[pair] = '';
      continue;
    }
    params[pair.slice(0, eq)] = decode(pair.slice(eq + 1));
  }
  return params;
}

export function formatHashParams(params: Record<string, string>): string {
  const pairs = Object.entries(params).map(
    ([key, value]) => `${key}=${value.replace(/%/g, '%25').replace(/&/g, '%26').replace(/#/g, '%23')}`
  );
  return pairs.length ? `#${pairs.join('&')}` : '';
}

export function splitUrl(url: string): { pathname: string; search: string; hash: string } {
  const hashAt = url.indexOf('#');
  const hash = hashAt === -1 ? '' : url.slice(hashAt);
  const rest = hashAt === -1 ? url : url.slice(0, hashAt);
  const searchAt = rest.indexOf('?');
  if (searchAt === -1) return { pathname: rest, search: '', hash };
  return { pathname: rest.slice(0, searchAt), search: rest.slice(searchAt), hash };
}

export function withHashParams(url: string, patch: Record<string, string | null>): string {
  const { pathname, search, hash } = splitUrl(url);
  const params = parseHashParams(hash);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete params[key];
    else params[key] = value;
  }
  return `${pathname}${search}${formatHashParams(params)}`;
}

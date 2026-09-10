// Порог — Chrome 80 (docs/plans/2026-09-10-legacy-webview-compat/design.md). Meteor тут не помощник:
// его «современный» порог около Chrome 49, то есть Chrome 80..98 получает немодифицированный
// modern-бандл, а legacy-арки для Cordova нет вовсе.
//
// Шимы экспортируются поимённо, чтобы их можно было проверить тестом: в Node всё это нативное,
// и проверка через глобальные объекты тестировала бы реализацию Node, а не нашу.

const define = (target, name, value) => {
  if (name in target) return;
  Object.defineProperty(target, name, { value, writable: true, configurable: true });
};

/** Array.prototype.at / String.prototype.at — Chrome 92. */
export function at(index) {
  const length = this.length;
  const offset = Math.trunc(index) || 0;
  const position = offset < 0 ? length + offset : offset;
  return position < 0 || position >= length ? undefined : this[position];
}

/** String.prototype.replaceAll — Chrome 85. */
export function replaceAll(pattern, replacement) {
  if (pattern instanceof RegExp) {
    if (!pattern.global) throw new TypeError('replaceAll must be called with a global RegExp');
    return this.replace(pattern, replacement);
  }
  const search = String(pattern);
  if (typeof replacement !== 'function') return this.split(search).join(String(replacement));
  let out = '';
  let from = 0;
  for (let found = this.indexOf(search, from); found !== -1; found = this.indexOf(search, from)) {
    out += this.slice(from, found) + replacement(search, found, String(this));
    from = found + (search.length || 1);
  }
  return out + this.slice(from);
}

/** Array.prototype.findLastIndex — Chrome 97. */
export function findLastIndex(predicate, thisArg) {
  for (let index = this.length - 1; index >= 0; index -= 1) {
    if (predicate.call(thisArg, this[index], index, this)) return index;
  }
  return -1;
}

/** Array.prototype.findLast — Chrome 97. */
export function findLast(predicate, thisArg) {
  const index = findLastIndex.call(this, predicate, thisArg);
  return index === -1 ? undefined : this[index];
}

/**
 * structuredClone — Chrome 98. Рекурсивный клон с Date/RegExp/Map/Set и защитой от циклов;
 * вариант через JSON.parse(JSON.stringify(…)) молча теряет типы.
 */
export function structuredCloneShim(value) {
  const seen = new Map();
  const copy = (node) => {
    if (node === null || typeof node !== 'object') return node;
    if (seen.has(node)) return seen.get(node);
    if (node instanceof Date) return new Date(node.getTime());
    if (node instanceof RegExp) return new RegExp(node.source, node.flags);
    if (node instanceof Map) {
      const out = new Map();
      seen.set(node, out);
      node.forEach((val, key) => out.set(copy(key), copy(val)));
      return out;
    }
    if (node instanceof Set) {
      const out = new Set();
      seen.set(node, out);
      node.forEach((val) => out.add(copy(val)));
      return out;
    }
    if (Array.isArray(node)) {
      const out = [];
      seen.set(node, out);
      node.forEach((val, index) => {
        out[index] = copy(val);
      });
      return out;
    }
    const out = {};
    seen.set(node, out);
    for (const key of Object.keys(node)) out[key] = copy(node[key]);
    return out;
  };
  return copy(value);
}

/** Хост-объекты параметрами — чтобы установку можно было проверить тестом. */
export function installPolyfills(objectHost = Object, globalHost = globalThis) {
  define(objectHost, 'hasOwn', (target, key) => Object.prototype.hasOwnProperty.call(Object(target), key));

  define(String.prototype, 'replaceAll', replaceAll);
  define(String.prototype, 'at', at);
  define(Array.prototype, 'at', at);
  define(Array.prototype, 'findLastIndex', findLastIndex);
  define(Array.prototype, 'findLast', findLast);

  define(
    globalHost,
    'AggregateError',
    class AggregateError extends Error {
      constructor(errors, message) {
        super(message);
        this.name = 'AggregateError';
        this.errors = [...errors];
      }
    },
  );

  define(Promise, 'any', function any(iterable) {
    const items = [...iterable];
    return new Promise((resolve, reject) => {
      if (!items.length) {
        reject(new globalHost.AggregateError([], 'All promises were rejected'));
        return;
      }
      const errors = new Array(items.length);
      let pending = items.length;
      items.forEach((item, index) =>
        Promise.resolve(item).then(resolve, (error) => {
          errors[index] = error;
          pending -= 1;
          if (pending === 0) reject(new globalHost.AggregateError(errors, 'All promises were rejected'));
        }),
      );
    });
  });

  define(globalHost, 'structuredClone', structuredCloneShim);

  // Маркер для compat:check — обязательно строковый литерал в рантайме, а не комментарий:
  // продовая сборка минифицируется, и комментарии из бандла вырезаются (проверено на
  // `meteor build` кабинета — комментарного маркера в бандле не оказалось, хотя код шимов
  // на месте). Заодно это ручная проба на устройстве: в DevTools видно
  // window['apartx-compat-polyfills'].
  globalHost['apartx-compat-polyfills'] = true;
}

installPolyfills();

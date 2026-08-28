import { getContext, setContext } from 'svelte';

/**
 * Контракт entity-ссылок для JsonTree/PopoverJson. Кит app-agnostic: маппинг
 * «имя ключа → роут» инжектит приложение. Хост вызывает setJsonLinkResolver
 * один раз в корне (как setNavigator); значения-строки, для которых резолвер
 * вернул href, рендерятся китовым <Link>.
 */

export interface JsonLinkContext {
  /** Имя поля, например 'userId'. */
  key: string;
  /** Строковое значение поля. */
  value: string;
  /** Родительский объект — для составных роутов (lockId + сосед userId). */
  parent: Record<string, unknown>;
}

/** Вернуть href или undefined («не ссылка»). */
export type JsonLinkResolver = (ctx: JsonLinkContext) => string | undefined;

const KEY = Symbol('apartx-ui:json-link-resolver');

/** Вызвать при инициализации корневого компонента (рядом с setNavigator). */
export function setJsonLinkResolver(resolver: JsonLinkResolver): void {
  setContext(KEY, resolver);
}

/** Прочитать инжектированный резолвер; undefined — ссылок не будет. */
export function getJsonLinkResolver(): JsonLinkResolver | undefined {
  return getContext<JsonLinkResolver | undefined>(KEY);
}

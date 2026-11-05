import { parseHashParams, splitUrl, withHashParams } from './hash-params';

/** Откуда идёт навигация: текущий адрес и `origin` — область роутера, из которой она
 *  начата (`data-router-scope` ближайшего предка ссылки, `VirtualRouter`). `scopedTo` —
 *  только у переходов изнутри `VirtualRouter` (его push/replace, scoped `<Link>`, Navigator):
 *  полный виртуальный путь, который запросило поддерево (`/accounts/billing?x=1`); `to` при этом
 *  — реальный адрес с переписанной парой фрагмента. У прочих навигаций — undefined. */
export interface NavFrom { pathname: string; search: string; hash: string; origin?: string; scopedTo?: string }

export interface NavConfig {
  /** Пары фрагмента, которые переносятся на адрес без них. */
  keepHash?: string[];
  /** Последнее слово: вернуть адрес (возможно другой) или null — отменить переход. Вызывается ПОСЛЕ keepHash. */
  intercept?: (to: string, from: NavFrom) => string | null;
}

let config: NavConfig = {};
let configured = false;

/** Замещает предыдущую конфигурацию целиком. Без вызова navigate/replace ведут себя как раньше. */
export function configureNav(next: NavConfig): void {
  config = next;
  configured = true;
}

export function resetNavConfig(): void {
  config = {};
  configured = false;
}

/** configureNav вызван и не сброшен — включены новые правила navigate (гард на смене фрагмента). */
export function isNavConfigured(): boolean {
  return configured;
}

/** Чистое разрешение адреса: перенос пар keepHash из текущего фрагмента, затем intercept.
 *  `keepHash: false` — без переноса для этого вызова (закрыть панель); intercept всё равно идёт. */
export function resolveNavTarget(to: string, from: NavFrom, opts?: { keepHash?: boolean }): string | null {
  const carried = opts?.keepHash === false ? to : carryHash(to, from.hash);
  if (!config.intercept) return carried;
  return config.intercept(carried, from);
}

function carryHash(to: string, fromHash: string): string {
  if (!config.keepHash?.length) return to;
  const current = parseHashParams(fromHash);
  const target = parseHashParams(splitUrl(to).hash);
  const patch: Record<string, string> = {};
  for (const key of config.keepHash) {
    if (key in target || !(key in current)) continue;
    patch[key] = current[key];
  }
  if (!Object.keys(patch).length) return to;
  return withHashParams(to, patch);
}

export function routerScopeOf(el: Element | null | undefined): string | undefined {
  return el?.closest('[data-router-scope]')?.getAttribute('data-router-scope') ?? undefined;
}

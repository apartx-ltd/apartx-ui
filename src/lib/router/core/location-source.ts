import type { Action } from '../history/adapter';
import type { RouterLocation } from './context';

/** Контекст-ключ источника пути: `<VirtualRouter>` подставляет свой, и `useRouter()` поддерева
 *  читает путь из него, а не из реального адреса. */
export const ROUTER_LOCATION_CTX = Symbol('apartx-router-location');

export interface RouterLocationSource {
  readonly current: RouterLocation & { action: Action };
  push(url: string, opts?: { action?: Action; keepOverlays?: boolean; root?: boolean; force?: boolean }): void;
  replace(url: string, opts?: { action?: Action; root?: boolean; force?: boolean }): void;
  back(href?: string): void;
  goBack(): void;
  readonly currentHasParent: boolean;
  setRouteBack(v: string | null): void;
  /** Полный реальный адрес для DOM-href виртуального пути. */
  resolveHref(url: string): string;
}

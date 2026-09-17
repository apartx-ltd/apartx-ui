// projects/apartx-ui/src/lib/router/history/adapter.ts
import type { RouteSnapshot } from '../../navigation/context';

export type Action = 'forward' | 'back' | 'none';

/** Опции записи истории. `root` — запись начинает новый стек «назад»: диплинк из пуша,
 *  service worker'а и т.п., открытый поверх уже живого приложения. Ниже корня `canGoBack`
 *  не смотрит — «назад» с такой записи идёт в `<Route back>`, как на холодном заходе. */
export interface HistoryEntryOpts {
  action?: Action;
  root?: boolean;
}

/**
 * The single seam over browser history. The engine (useRouter) and the
 * overlay-stack depend ONLY on this interface and never touch window.history,
 * so the same logic runs on raw history (Meteor) or SvelteKit's navigation.
 */
export interface HistoryAdapter {
  /** Current location, or null on the server (the engine seeds from context there). */
  readonly location: RouteSnapshot | null;
  readonly action: Action;
  /** True when there is an in-app entry to go back to (above the current stack root:
   *  the app's first entry or the last `root` push/replace). */
  readonly canGoBack: boolean;
  /** True when the CURRENT entry is a synthetic overlay entry. */
  readonly onOverlayEntry: boolean;
  listen(cb: () => void): () => void;
  push(url: string, opts?: HistoryEntryOpts): void;
  replace(url: string, opts?: HistoryEntryOpts): void;
  /** Synthetic same-URL entry for an opened overlay; does NOT notify listeners. */
  pushOverlay(): void;
  /** Return to the overlay's still-existing synthetic entry after a vetoed back
   *  (history.forward(), not a new pushState): a gesture-less pushState marks the
   *  entry below as skip-on-back (Chrome history-manipulation intervention) and
   *  KILLS the real Back button, while a traversal leaves flags untouched. The
   *  resulting forward-popstate must not notify the router. */
  restoreOverlayEntry(): void;
  /** Register the overlay layer's back handler (returns true if it consumed the back). */
  setBackInterceptor(fn: (() => boolean) | null): void;
  goBack(): void;
}

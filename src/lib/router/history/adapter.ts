// projects/apartx-ui/src/lib/router/history/adapter.ts
import type { RouteSnapshot } from '../../navigation/context';

export type Action = 'forward' | 'back' | 'none';

/**
 * The single seam over browser history. The engine (useRouter) and the
 * overlay-stack depend ONLY on this interface and never touch window.history,
 * so the same logic runs on raw history (Meteor) or SvelteKit's navigation.
 */
export interface HistoryAdapter {
  /** Current location, or null on the server (the engine seeds from context there). */
  readonly location: RouteSnapshot | null;
  readonly action: Action;
  /** True when there is an in-app entry to go back to (above the app root entry). */
  readonly canGoBack: boolean;
  /** True when the CURRENT entry is a synthetic overlay entry. */
  readonly onOverlayEntry: boolean;
  listen(cb: () => void): () => void;
  push(url: string, opts?: { action?: Action }): void;
  replace(url: string, opts?: { action?: Action }): void;
  /** Synthetic same-URL entry for an opened overlay; does NOT notify listeners. */
  pushOverlay(): void;
  /** Register the overlay layer's back handler (returns true if it consumed the back). */
  setBackInterceptor(fn: (() => boolean) | null): void;
  goBack(): void;
}

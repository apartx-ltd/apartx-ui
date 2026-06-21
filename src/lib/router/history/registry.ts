// projects/apartx-ui/src/lib/router/history/registry.ts
import type { HistoryAdapter } from './adapter';
import { browserHistoryAdapter } from './browser';

let active: HistoryAdapter | null = null;

/**
 * Inject a backend once near app init. Pass null to fall back to the browser adapter.
 *
 * MUST be called before any `useRouter()` mounts / before the engine subscribes via
 * `listen`: the engine captures the active adapter at subscribe time and will not
 * re-subscribe if the adapter is swapped afterwards, so a later call leaves already-
 * mounted routers bound to the previous adapter.
 */
export function setHistoryAdapter(adapter: HistoryAdapter | null): void {
  active = adapter;
}

/** The active adapter (defaults to the raw-browser backend). */
export function getHistory(): HistoryAdapter {
  return active ?? browserHistoryAdapter;
}

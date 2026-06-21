// Module-scoped cache for lazily-loaded route page components.
//
// A <Route loader={() => import('./Page.svelte')}> shows the <Router>'s `loading`
// snippet only on the FIRST visit; once the chunk resolves the component is cached
// and rendered synchronously on every later visit (and on back/forward), so there
// is no flicker or re-await. Ported from apartx-admin's route-loader so all kit
// consumers (admin/spaces/cabinet) share one lazy-route mechanism.

// The resolved value is a Svelte component constructor. Typed as `any` (like the
// rest of the kit's dynamic-component handling) so `<Cached />` / `{:then C}` in
// Router.svelte type-check — Svelte's dynamic-component slot rejects `unknown`.
export type RouteLoader = () => Promise<{ default: any }>;

const cache = new Map<RouteLoader, any>(); // loader → resolved component
const inflight = new Map<RouteLoader, Promise<any>>(); // loader → in-flight import

/** Synchronously returns the cached component for a loader, or undefined if not yet resolved. */
export function getCached(loader: RouteLoader): any {
  return cache.get(loader);
}

/** Resolve a loader's default export, caching it (and de-duping concurrent loads). */
export function load(loader: RouteLoader): Promise<any> {
  if (cache.has(loader)) return Promise.resolve(cache.get(loader));
  let p = inflight.get(loader);
  if (!p) {
    p = loader().then((m) => {
      cache.set(loader, m.default);
      inflight.delete(loader);
      return m.default;
    });
    inflight.set(loader, p);
  }
  return p;
}

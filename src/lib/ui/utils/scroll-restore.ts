import type { Action } from 'svelte/action';

/**
 * Remember and restore an element's vertical scroll position across navigation,
 * keyed by a caller-supplied string. Router-agnostic: works whether the element
 * is re-created per screen (a `{#key}` block keyed on the route) or kept and
 * re-keyed in place (the action's `update` runs).
 *
 * Positions live in a module-scoped Map so they survive remounts. Because the
 * key is typically per-route, the behaviour falls out naturally:
 *   - to a screen with a saved position (e.g. back) → restored;
 *   - to a fresh screen                              → starts at the top.
 *
 * @example
 *   <div use:scrollRestore={routeId} class="overflow-y-auto">…</div>
 *
 * Pass an empty/undefined key to disable (e.g. behind a feature flag).
 */

const positions = new Map<string, number>();

const keyOf = (param?: string): string => param ?? '';

export const scrollRestore: Action<HTMLElement, string | undefined> = (node, param) => {
  let key = keyOf(param);
  // >0 while a restore is in flight. Assigning `scrollTop` fires a `scroll`
  // event, which would otherwise call `save()` with the (momentarily clamped)
  // value and clobber the stored target — so saves are suppressed meanwhile.
  // Also mirrored onto the node as `__scrollRestoring` so a host's own scroll
  // handler (e.g. the kit Content's scrollbar-reveal) can tell this programmatic
  // scroll apart from a genuine user scroll.
  let restoring = 0;
  const syncRestoringFlag = () => {
    (node as HTMLElement & { __scrollRestoring?: boolean }).__scrollRestoring = restoring > 0;
  };

  // Scroll events are the single source of truth: they fire on every user
  // scroll, so the last one before navigation holds the position to remember.
  // We deliberately do NOT read `scrollTop` at teardown — by then the router has
  // swapped in the next (often shorter) page and the value has collapsed to 0.
  const save = () => {
    if (!key || restoring) return;
    positions.set(key, node.scrollTop);
  };

  // Apply the saved offset (or top, if none). Content laid out asynchronously
  // (e.g. a freshly mounted page during a route transition) may not be tall
  // enough yet, which would clamp the assignment short — so retry across a few
  // frames until it sticks. Bail if the key changed again meanwhile.
  const restore = () => {
    if (!key) return;
    const k = key;
    const y = positions.get(k) ?? 0;
    let tries = 0;
    restoring++;
    syncRestoringFlag();
    const apply = () => {
      if (key !== k) {
        restoring--;
        syncRestoringFlag();
        return;
      }
      node.scrollTop = y;
      if (node.scrollTop < y - 1 && tries++ < 12) {
        requestAnimationFrame(apply);
        return;
      }
      // Re-enable saves once the scroll events from our assignments have flushed.
      setTimeout(() => { restoring--; syncRestoringFlag(); }, 0);
    };
    requestAnimationFrame(apply);
  };

  node.addEventListener('scroll', save, { passive: true });
  restore();

  return {
    update(next) {
      const nextKey = keyOf(next);
      if (nextKey === key) return;
      // In-place re-key: the outgoing position is already saved from scrolling;
      // just switch and restore the incoming screen.
      key = nextKey;
      restore();
    },
    destroy() {
      node.removeEventListener('scroll', save);
    },
  };
};

/** Forget a saved position, e.g. after an in-place refresh that should reset scroll. */
export function clearScrollPosition(key: string): void {
  positions.delete(key);
}

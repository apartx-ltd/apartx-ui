import type { ModalRegistry, OpenInstance } from './types';

/**
 * Generic, framework-agnostic modal engine.
 *
 * MODULE-GLOBAL singleton (NOT Svelte context) on purpose: `open()` imports
 * nothing and reads no component context, so it is callable from anywhere —
 * `.coffee` stores, plain `.ts`, or another lazily-loaded modal component. The
 * host injects the registry config once via `setModalRegistry`; `<ModalOutlet>`
 * watches the reactive `stack` and lazy-loads + renders each open instance.
 */

let registry: ModalRegistry | undefined;

/**
 * Memoized chunk loader: at most one `import()` per modal id, returning a STABLE
 * promise identity. `<ModalOutlet>` awaits this in an `{#await}`; if it called the
 * raw `load()` inline, every `stack` mutation (e.g. opening a nested modal) would
 * hand `{#await}` a fresh promise and remount EVERY open modal — silently resetting
 * the parent modal's state (a modal that opens a child would lose its in-progress
 * edits). Caching the promise keeps each open modal mounted across stack changes.
 */
const _loaded = new Map<string, Promise<any>>();
export function loadModal(id: string): Promise<any> | undefined {
  const entry = registry?.[id];
  if (!entry) return undefined;
  let p = _loaded.get(id);
  if (!p) {
    p = entry.load();
    _loaded.set(id, p);
  }
  return p;
}

/** Inject the host's registry config once near app startup. Warms `eager` chunks. */
export function setModalRegistry(r: ModalRegistry): void {
  registry = r;
  // Kick off eager loads so the first open of those modals has no fetch gap.
  for (const id in r) {
    if (r[id].eager) loadModal(id)?.catch(() => {});
  }
}

export function getModalRegistry(): ModalRegistry | undefined {
  return registry;
}

let _seq = 0;

/** Reactive list of open instances, in stack order (last = topmost). */
export const stack = $state<OpenInstance[]>([]);

/**
 * Open modal `id` with `props`. Returns a Promise that resolves with the result
 * passed to the instance's `close(result)`. Eager (imports nothing) ⇒ safe to
 * call from `.coffee`/`.ts`/another modal component.
 */
export function open<R = any>(id: string, props: any = {}): Promise<R> {
  let resolve!: (r: R) => void;
  const promise = new Promise<R>((r) => {
    resolve = r;
  });
  stack.push({ key: ++_seq, id, props, resolve });
  return promise;
}

/**
 * Resolve the instance's Promise and remove it from the stack — SYNCHRONOUSLY.
 * The exit-animation delay is owned by the modal's `<Dialog>` (the component
 * flips its local `open=false`, the Dialog plays its exit transition, and its
 * `onDidDismiss` calls this). No engine-side timer.
 */
export function closeInstance(key: number, result?: any): void {
  const i = stack.findIndex((m) => m.key === key);
  if (i === -1) return;
  const [inst] = stack.splice(i, 1);
  inst.resolve(result);
}

/** Force-close every open instance immediately (e.g. on a route change). */
export function closeAll(): void {
  while (stack.length) {
    const inst = stack.pop()!;
    inst.resolve(undefined);
  }
}

/**
 * z-index band for the instance at `depth` in the stack. Scrim sits at the
 * returned value, content at `+1`. BASE clears the kit's default `z-50`; each
 * deeper instance gets a strictly higher band, so the most-recently-opened modal
 * (last in the stack — incl. a confirm opened from inside another modal) is
 * always on top, regardless of chunk load timing or DOM/portal order.
 */
const BASE = 60;
const STEP = 10;
export function zForDepth(depth: number): number {
  return BASE + depth * STEP;
}

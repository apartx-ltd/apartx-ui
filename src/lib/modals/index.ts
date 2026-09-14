// === ApartX UI Kit — generic lazy modal registry ===
//
// A framework-agnostic modal engine: the host declares a registry (id → lazy
// loader), injects it via setModalRegistry(), mounts <ModalOutlet/> once, and
// opens modals from anywhere with `open(id, props): Promise<result>`. Each modal
// component receives its props plus a `close(result?)` callback; teardown is
// driven by the kit Dialog's onDidDismiss (exit animation finished).
//
// Usage at call sites: `import * as Modal from 'apartx-ui/modals'` →
// `Modal.open('confirm', { text })` (named `open`, not `openModal`, but accessed
// as `Modal.open` so it never shadows `window.open`).

export { setModalRegistry, getModalRegistry, loadModal, open, closeInstance, closeAll, stack, zForDepth } from './registry.svelte';
export { default as ModalOutlet } from './ModalOutlet.svelte';
export { default as ModalLayer } from './ModalLayer.svelte';
export type { ModalEntry, ModalRegistry, OpenInstance } from './types';

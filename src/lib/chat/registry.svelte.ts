import type { SlotSet } from './types';

/**
 * Message-type → SlotSet registry. Module-global singleton mirroring the kit modal-registry: the host injects its
 * type→component map once at startup via `setMessageRendererRegistry`, and components call `resolveComponents(type)`.
 * EAGER (no lazy chunks) — messages render continuously.
 *
 * NOTE: despite the `.svelte.ts` extension (convention parity with modal-registry), this module uses NO runes —
 * it's plain module-global vars.
 */
let registry: Record<string, SlotSet> = {};
let defaults: SlotSet = {};

export function setMessageRendererRegistry(r: Record<string, SlotSet>): void {
  registry = r;
}
export function setDefaultSlots(d: SlotSet): void {
  defaults = d;
}
export function getMessageRendererRegistry(): Record<string, SlotSet> {
  return registry;
}

/** Resolve the slot set for a message type: registered slots merged over the kit defaults. */
export function resolveComponents(type?: string): SlotSet {
  const slots = (type && registry[type]) || {};
  return { ...defaults, ...slots };
}

/** Host-injected opaque slot context (e.g. {t, peer, store}). Spread into every slot by MessageRenderer. */
let slotContext: () => Record<string, any> = () => ({});
export function setSlotContext(fn: () => Record<string, any>): void { slotContext = fn; }
export function getSlotContext(): Record<string, any> { return slotContext(); }

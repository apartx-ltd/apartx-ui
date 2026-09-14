// === ApartX UI Kit — app link registry ===
//
// One app-independent address for "a thing in the product": `#/<type>` or
// `#/<type>/<rest>` — booking, property, article, search, verification, … The
// server, the AI prompts, push payloads and help articles all emit this form;
// WHICH screen or modal it opens is the host's business, declared once via
// `setLinkRegistry({ booking: { open, shareUrl }, … })` next to `setModalRegistry`.
// The kit only parses the form and dispatches: `openLink(href)` / `linkShareUrl(href)`.
// Anything that is not a hash link is `external` (a plain URL); a host may register
// 'external' as well (e.g. Cordova → InAppBrowser).
//
// Module-global singleton on purpose (same as the modal registry): callable from
// chat, push handlers, deeplink pages or plain `.ts` — no component context needed.

export interface AppLink {
  /** Hash segment right after `#/` (`booking`, `article`, …); `external` for plain URLs. */
  type: string;
  /** The rest after `#/<type>/` — an id, or `?q=…` for search; '' when absent or external. */
  entityId: string;
  /** The original href, untouched. */
  href: string;
}

export interface LinkHandler {
  /** Open the target: navigate, open a modal, … */
  open: (link: AppLink) => void | Promise<void>;
  /** Public URL for "Copy link" / share. Default — the raw href. */
  shareUrl?: (link: AppLink) => string | Promise<string>;
}

/** Host-owned map of link type → handler. Injected once via `setLinkRegistry`. */
export type LinkRegistry = Record<string, LinkHandler>;

let registry: LinkRegistry = {};

export function setLinkRegistry(r: LinkRegistry): void {
  registry = r;
}

export function getLinkRegistry(): LinkRegistry {
  return registry;
}

const HASH_LINK = /^\/([a-z][a-z0-9_-]*)(?:\/(.*))?$/;

/** Classify an href: `#/<type>[/<rest>]` (relative or inside an absolute URL) or `external`. */
export function parseLink(href: string): AppLink {
  const external: AppLink = { type: 'external', entityId: '', href };
  let hash: string;
  try {
    hash = decodeURI(new URL(href, 'http://app-link.internal').hash);
  } catch {
    return external;
  }
  if (!hash) return external;
  const match = HASH_LINK.exec(hash.substring(1));
  if (!match) return external;
  const [, type, entityId] = match;
  if (type === 'external') return external;
  return { type, entityId: entityId ?? '', href };
}

function toLink(target: string | AppLink): AppLink {
  return typeof target === 'string' ? parseLink(target) : target;
}

/**
 * Dispatch to the host handler for the link's type. SYNCHRONOUS claim: `true` when a
 * handler took the link (its async work — a store lookup, a modal chunk — continues in
 * the background and is the handler's business), `false` when nothing is registered
 * for the type — the caller decides the fallback (chat: confirm + `window.open` for
 * external, no-op for unknown app links).
 */
export function openLink(target: string | AppLink): boolean {
  const link = toLink(target);
  const handler = registry[link.type];
  if (!handler) return false;
  void handler.open(link);
  return true;
}

/** Shareable URL for the link: the handler's `shareUrl`, else the raw href. */
export async function linkShareUrl(target: string | AppLink): Promise<string> {
  const link = toLink(target);
  return (await registry[link.type]?.shareUrl?.(link)) ?? link.href;
}

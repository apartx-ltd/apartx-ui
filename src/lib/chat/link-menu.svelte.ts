// Chat link flow, module-level rune state (one menu / one confirm at a time app-wide).
// Links are resolved through the app link registry (`apartx-ui/links`): the host
// registers `{ open, shareUrl }` per `#/<type>` once, the chat only dispatches.
// Slot context keeps a single chat-specific hook: `onLinkCopied?(url)` — feedback
// after a successful "Copy link".
// The external-open confirm is self-contained (rendered by MessageLinkMenu.svelte),
// deliberately NOT the global overlays/confirm service — cabinet does not mount it.
import { parseLink, openLink, type AppLink, type LinkOpenContext } from '../links/registry';

let menu = $state<{ link: AppLink; x: number; y: number; ctx?: LinkOpenContext } | null>(null);
let externalConfirm = $state<{ link: AppLink } | null>(null);
let confirmResolver: ((ok: boolean) => void) | null = null;

export function getLinkMenu() {
  return menu;
}
export function closeLinkMenu(): void {
  menu = null;
}

/** `ctx` — where the link sits (router scope); the menu's "Open" passes it on to `openChatLink`. */
export function openLinkMenu(href: string, x: number, y: number, ctx?: LinkOpenContext): void {
  menu = { link: parseLink(href), x, y, ctx };
}

export function getExternalConfirm() {
  return externalConfirm;
}

/**
 * Ask the user to confirm opening an external link. Exported for hosts that register
 * an 'external' link handler (e.g. Cordova) but want the same kit dialog.
 */
export function confirmExternalOpen(link: AppLink): Promise<boolean> {
  externalConfirm = { link };
  return new Promise((resolve) => { confirmResolver = resolve; });
}

export function resolveExternalConfirm(ok: boolean): void {
  externalConfirm = null;
  confirmResolver?.(ok);
  confirmResolver = null;
}

export async function openChatLink(href: string, ctx?: LinkOpenContext): Promise<void> {
  const link = parseLink(href);
  if (openLink(link, ctx)) return;
  if (link.type !== 'external') return; // app link without a host handler — nothing to open
  if (!(await confirmExternalOpen(link))) return;
  window.open(link.href, '_blank');
}

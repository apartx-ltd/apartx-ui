// Chat link flow, module-level rune state (one menu / one confirm at a time app-wide).
// Host interception contract (slot context, see design doc):
//   onLinkOpen?(link)  — return true to claim the click entirely;
//   resolveShareUrl?(link) — string | Promise<string> for "Copy link";
//   onLinkCopied?(url) — optional feedback hook after a successful copy;
//   linkBaseUrl?       — base for resolving relative hrefs (host origin).
// The external-open confirm is self-contained (rendered by MessageLinkMenu.svelte),
// deliberately NOT the global overlays/confirm service — cabinet does not mount it.
import { classifyChatLink, type ChatLink } from './message-links';
import { getSlotContext } from './registry.svelte';

let menu = $state<{ link: ChatLink; x: number; y: number } | null>(null);
let externalConfirm = $state<{ link: ChatLink } | null>(null);
let confirmResolver: ((ok: boolean) => void) | null = null;

export function getLinkMenu() {
  return menu;
}
export function closeLinkMenu(): void {
  menu = null;
}

export function openLinkMenu(href: string, x: number, y: number): void {
  const ctx = getSlotContext();
  menu = { link: classifyChatLink(href, ctx.linkBaseUrl), x, y };
}

export function getExternalConfirm() {
  return externalConfirm;
}

/**
 * Ask the user to confirm opening an external link. Exported for hosts that claim
 * 'external' in onLinkOpen (e.g. Cordova) but want the same kit dialog.
 */
export function confirmExternalOpen(link: ChatLink): Promise<boolean> {
  externalConfirm = { link };
  return new Promise((resolve) => { confirmResolver = resolve; });
}

export function resolveExternalConfirm(ok: boolean): void {
  externalConfirm = null;
  confirmResolver?.(ok);
  confirmResolver = null;
}

export async function openChatLink(href: string): Promise<void> {
  const ctx = getSlotContext();
  const link = classifyChatLink(href, ctx.linkBaseUrl);
  if (ctx.onLinkOpen?.(link) === true) return;
  if (link.type !== 'external') return; // internal types need a host handler
  if (!(await confirmExternalOpen(link))) return;
  window.open(link.href, '_blank');
}

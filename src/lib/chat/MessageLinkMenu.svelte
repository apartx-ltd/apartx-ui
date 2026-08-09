<script lang="ts">
  // Singleton link context-menu (Open / Copy link) + the external-open confirm
  // dialog. Mounted once by ChatMessageList. Labels via chatT (host injects i18n).
  // The confirm is deliberately self-contained rather than the global
  // overlays/confirm service: cabinet never mounts <ConfirmDialog/>.
  import Icon from '../ui/display/Icon.svelte';
  import Button from '../ui/display/Button.svelte';
  import Popover from '../ui/display/Popover.svelte';
  import Dialog from '../ui/overlays/Dialog.svelte';
  import { faExternalLinkAlt, faCopy, faCheck } from '@fortawesome/free-solid-svg-icons';
  import { chatT } from './i18n';
  import { getSlotContext } from './registry.svelte';
  import {
    getLinkMenu, closeLinkMenu, openChatLink,
    getExternalConfirm, resolveExternalConfirm,
  } from './link-menu.svelte';

  const menu = $derived(getLinkMenu());
  const confirmReq = $derived(getExternalConfirm());

  let open = $state(false);
  $effect(() => { open = !!menu; });
  $effect(() => { if (!open && menu) closeLinkMenu(); });

  // Snapshot anchor and link through the close animation (same trick as the
  // cabinet MessageMenu): `menu` clears to null the moment the popover closes,
  // but the surface stays mounted until its exit finishes.
  let anchor = $state<any>(null);
  $effect.pre(() => { if (menu) anchor = { getBoundingClientRect: () => new DOMRect(menu.x, menu.y, 0, 0) }; });
  let link = $state<any>(null);
  $effect.pre(() => { if (menu?.link) link = menu.link; });

  let copied = $state(false);
  $effect.pre(() => { if (menu) copied = false; });

  function onOpen() {
    const href = link?.href;
    closeLinkMenu();
    if (href) void openChatLink(href);
  }

  async function onCopy() {
    const ctx = getSlotContext();
    const url = (await ctx.resolveShareUrl?.(link)) ?? link?.href ?? '';
    await navigator.clipboard.writeText(url);
    copied = true;
    ctx.onLinkCopied?.(url);
    setTimeout(() => closeLinkMenu(), 600);
  }

  const confirmDomain = $derived.by(() => {
    try {
      return new URL(confirmReq?.link?.href ?? '').hostname;
    } catch {
      return confirmReq?.link?.href ?? '';
    }
  });
</script>

<Popover
  bind:open
  customAnchor={anchor}
  side="bottom"
  align="start"
  portal
  modal
  fitViewport
  contentClass="p-1 min-w-[200px] bg-surface-container rounded-xl"
  data-testid="chat-link-menu"
>
  {#snippet item(icon: any, label: string, onclick: () => void, testid: string)}
    <button
      class="flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-2 text-left text-body-md hover:bg-on-surface/8"
      {onclick}
      data-testid={testid}
    >
      <Icon {icon} class="w-5 shrink-0" /> <span class="truncate">{label}</span>
    </button>
  {/snippet}
  {@render item(faExternalLinkAlt, chatT('common.open', { defaultValue: 'Open' }), onOpen, 'chat-link-menu-open')}
  {@render item(
    copied ? faCheck : faCopy,
    copied
      ? chatT('common.link_copied', { defaultValue: 'Link copied' })
      : chatT('common.copy_link', { defaultValue: 'Copy link' }),
    onCopy,
    'chat-link-menu-copy',
  )}
</Popover>

<Dialog
  open={!!confirmReq}
  onOpenChange={(o: boolean) => { if (!o) resolveExternalConfirm(false); }}
  title={chatT('chats.open_external_link.title', { defaultValue: 'Open external link?' })}
  showCloseButton={false}
  role="alertdialog"
  bodyClass="px-6 pt-2 pb-2 text-body-lg text-on-surface-variant"
>
  <span class="break-all" data-testid="chat-link-confirm-domain">{confirmDomain}</span>
  {#snippet footer()}
    <div class="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
      <Button variant="text" onclick={() => resolveExternalConfirm(false)} data-testid="chat-link-confirm-cancel">
        {chatT('common.cancel', { defaultValue: 'Cancel' })}
      </Button>
      <Button onclick={() => resolveExternalConfirm(true)} data-testid="chat-link-confirm-open">
        {chatT('common.open', { defaultValue: 'Open' })}
      </Button>
    </div>
  {/snippet}
</Dialog>

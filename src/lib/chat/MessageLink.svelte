<script lang="ts">
  // A link inside message text. Click opens via the host-interceptable flow;
  // long-press (touch) / right-click (desktop) opens the kit link menu.
  // `longpress` owns the contextmenu listener itself — do NOT add a local
  // oncontextmenu here or the menu opens twice on desktop.
  import { longpress } from '../hooks/useLongPress.svelte';
  import { openChatLink, openLinkMenu } from './link-menu.svelte';

  let { href = '', children }: { href?: string; children?: any } = $props();
</script>

<a
  {href}
  class="cursor-pointer break-words text-inherit underline underline-offset-2"
  data-testid="message-link"
  use:longpress={{
    // Deferred by a tick on purpose: opening an overlay (modal/dialog) synchronously inside the
    // click dispatch lets the SAME click reach the freshly-mounted overlay's outside-click
    // listener, which closes it again and pops the overlay stack — which navigates BACK, off the
    // chat. Handing the open to the next task breaks that same-tick race.
    onClick: () => { setTimeout(() => { void openChatLink(href); }, 0); },
    onTrigger: ({ clientX, clientY }) => openLinkMenu(href, clientX, clientY),
  }}
  onclick={(e) => { e.preventDefault(); e.stopPropagation(); }}
>{@render children?.()}</a>

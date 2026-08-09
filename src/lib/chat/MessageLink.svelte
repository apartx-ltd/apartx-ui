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
    onClick: () => { void openChatLink(href); },
    onTrigger: ({ clientX, clientY }) => openLinkMenu(href, clientX, clientY),
  }}
  onclick={(e) => e.preventDefault()}
>{@render children?.()}</a>

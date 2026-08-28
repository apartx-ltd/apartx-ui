<script>
  import { Popover } from 'bits-ui';
  import { cn } from '../utils/cn';
  import Icon from './Icon.svelte';
  import JsonTree from './JsonTree.svelte';
  import Dialog from '../overlays/Dialog.svelte';
  import { faCircleInfo, faExpand } from '@fortawesome/free-solid-svg-icons';

  let { src, class: className, expandDepth = 2, linkResolver = undefined, ...restProps } = $props();

  let popoverOpen = $state(false);
  let dialogOpen = $state(false);

  let formatted = $derived(() => {
    try {
      return JSON.stringify(src, null, 2);
    } catch {
      return 'Error serializing JSON';
    }
  });

  function copyToClipboard() {
    navigator.clipboard?.writeText(formatted());
  }

  function expand() {
    popoverOpen = false;
    dialogOpen = true;
  }
</script>

<Popover.Root bind:open={popoverOpen}>
  <Popover.Trigger
    class={cn('w-8 h-8 rounded-full inline-flex items-center justify-center text-on-surface-variant hover:bg-on-surface/8 cursor-pointer', className)}
    {...restProps}
  >
    <Icon icon={faCircleInfo} />
  </Popover.Trigger>

  <Popover.Content
    side="top"
    align="end"
    sideOffset={4}
    trapFocus={false}
    class="z-50 rounded-sm bg-[#272822] shadow-level-3 border border-outline-variant overflow-hidden max-w-lg min-w-64"
  >
    <div class="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-white/10">
      <span class="text-label-sm text-white/60">JSON</span>
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="text-white/60 hover:text-white cursor-pointer text-label-sm"
          onclick={copyToClipboard}
        >
          Copy
        </button>
        <button
          type="button"
          class="text-white/60 hover:text-white cursor-pointer"
          onclick={expand}
          aria-label="Expand"
        >
          <Icon icon={faExpand} />
        </button>
      </div>
    </div>
    <JsonTree value={src} {expandDepth} {linkResolver} class="max-h-80" />
  </Popover.Content>
</Popover.Root>

<!-- Сиблинг Popover.Root, не внутри Popover.Content — иначе размонтируется вместе с поповером. -->
<Dialog
  bind:open={dialogOpen}
  title="JSON"
  bodyClass="p-0"
  contentClass="w-[min(92vw,64rem)] h-[85vh]"
>
  {#snippet actions()}
    <button
      type="button"
      class="text-label-md text-primary hover:underline cursor-pointer px-2"
      onclick={copyToClipboard}
    >
      Copy
    </button>
  {/snippet}
  <JsonTree value={src} {expandDepth} {linkResolver} class="min-h-full" />
</Dialog>

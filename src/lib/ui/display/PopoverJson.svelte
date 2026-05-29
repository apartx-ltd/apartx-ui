<script>
  import { Popover } from 'bits-ui';
  import { cn } from '../utils/cn';
  import Icon from './Icon.svelte';

  let { src, class: className, ...restProps } = $props();

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
</script>

<Popover.Root>
  <Popover.Trigger
    class={cn('w-8 h-8 rounded-full inline-flex items-center justify-center text-on-surface-variant hover:bg-on-surface/8 cursor-pointer', className)}
    {...restProps}
  >
    <Icon name="circle-info" />
  </Popover.Trigger>

  <Popover.Content
    side="top"
    align="end"
    sideOffset={4}
    trapFocus={false}
    class="z-50 rounded-sm bg-[#272822] shadow-level-3 border border-outline-variant overflow-hidden max-w-lg min-w-64"
  >
    <div class="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
      <span class="text-label-sm text-white/60">JSON</span>
      <button
        type="button"
        class="text-white/60 hover:text-white cursor-pointer text-label-sm"
        onclick={copyToClipboard}
      >
        Copy
      </button>
    </div>
    <pre class="p-3 text-label-sm text-[#f8f8f2] overflow-auto max-h-80 whitespace-pre-wrap break-words">{formatted()}</pre>
  </Popover.Content>
</Popover.Root>

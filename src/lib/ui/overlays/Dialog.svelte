<script lang="ts">
  import { Dialog as BitsDialog } from 'bits-ui';
  import { cn } from '../utils/cn';
  import Button from '../display/Button.svelte';
  import Icon from '../display/Icon.svelte';

  let {
    children,
    header,
    footer,
    open = $bindable(false),
    title = '',
    description = '',
    fullScreen = false,
    showCloseButton = true,
    onOpenChange,
    onclose,
    class: className,
    contentClass,
    overlayClass,
    bodyClass,
    role = 'dialog',
    ...restProps
  }: {
    children: any;
    header?: any;
    footer?: any;
    open?: boolean;
    title?: string;
    description?: string;
    fullScreen?: boolean;
    showCloseButton?: boolean;
    onOpenChange?: (v: boolean) => void;
    onclose?: () => void;
    class?: string;
    contentClass?: string;
    overlayClass?: string;
    bodyClass?: string;
    role?: 'dialog' | 'alertdialog';
    [key: string]: any;
  } = $props();

  function handleOpenChange(v: boolean) {
    open = v;
    onOpenChange?.(v);
    if (!v) onclose?.();
  }
</script>

<BitsDialog.Root bind:open onOpenChange={handleOpenChange}>
  <BitsDialog.Portal>
    <BitsDialog.Overlay
      class={cn('fixed inset-0 z-40 bg-scrim/40', overlayClass)}
    />
    <BitsDialog.Content
      {role}
      class={cn(
        'fixed z-50 flex flex-col bg-surface shadow-level-3 outline-none',
        fullScreen
          ? 'inset-0 rounded-none'
          : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-lg w-[calc(100%-2rem)] max-h-[85vh] rounded-xl overflow-hidden',
        className,
        contentClass,
      )}
      {...restProps}
    >
      {#if header}
        {@render header()}
      {:else if title || showCloseButton}
        <div class="flex items-center justify-between gap-2 px-6 pt-6 pb-2">
          {#if title}
            <BitsDialog.Title class="text-headline-sm text-on-surface m-0">
              {title}
            </BitsDialog.Title>
          {:else}
            <span></span>
          {/if}
          {#if showCloseButton}
            <Button variant="icon" onclick={() => (open = false)} aria-label="Close">
              <Icon name="xmark" />
            </Button>
          {/if}
        </div>
      {/if}

      {#if description}
        <BitsDialog.Description class="px-6 pb-2 text-body-md text-on-surface-variant">
          {description}
        </BitsDialog.Description>
      {/if}

      <div class={cn('flex-1 overflow-y-auto px-6 py-4', bodyClass)}>
        {@render children()}
      </div>

      {#if footer}
        {@render footer()}
      {/if}
    </BitsDialog.Content>
  </BitsDialog.Portal>
</BitsDialog.Root>

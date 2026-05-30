<script lang="ts">
  import { Dialog as BitsDialog } from 'bits-ui';
  import type { TransitionConfig } from 'svelte/transition';
  import { cn } from '../utils/cn';
  import { overlayFade, dialogPop, sheet } from '../utils/motion';
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

  // Fullscreen dialogs slide up like a sheet; centered ones pop.
  function contentTransition(node: Element): TransitionConfig {
    return fullScreen ? sheet(node, { side: 'bottom' }) : dialogPop(node);
  }
</script>

{#snippet panel()}
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
{/snippet}

<BitsDialog.Root bind:open onOpenChange={handleOpenChange}>
  <BitsDialog.Portal>
    <BitsDialog.Overlay forceMount>
      {#snippet child({ props, open: isOpen })}
        {#if isOpen}
          <div
            {...props}
            class={cn('fixed inset-0 z-40 bg-scrim/40', overlayClass)}
            transition:overlayFade
          ></div>
        {/if}
      {/snippet}
    </BitsDialog.Overlay>

    <BitsDialog.Content {role} forceMount {...restProps}>
      {#snippet child({ props, open: isOpen })}
        {#if isOpen}
          <!-- Centering wrapper: a transform-based transition on the panel must
               not fight a translate(-50%) used for positioning, so the panel
               owns only the animation and this wrapper handles layout. -->
          <div
            class={cn(
              'fixed inset-0 z-50',
              fullScreen ? '' : 'grid place-items-center p-4',
              'pointer-events-none',
            )}
          >
            <div
              {...props}
              class={cn(
                'pointer-events-auto flex flex-col bg-surface shadow-level-3 outline-none',
                fullScreen
                  ? 'absolute inset-0 rounded-none'
                  : 'max-w-lg w-full max-h-[85vh] rounded-xl overflow-hidden',
                className,
                contentClass,
              )}
              transition:contentTransition
            >
              {@render panel()}
            </div>
          </div>
        {/if}
      {/snippet}
    </BitsDialog.Content>
  </BitsDialog.Portal>
</BitsDialog.Root>

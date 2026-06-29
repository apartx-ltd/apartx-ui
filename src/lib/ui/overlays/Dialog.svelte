<script lang="ts">
  import { Dialog as BitsDialog } from 'bits-ui';
  import type { TransitionConfig } from 'svelte/transition';
  import { cn } from '../utils/cn';
  import { overlayFade, dialogPop, sheet } from '../utils/motion';
  import { getOverlayLayer } from './layer-context';
  import { openOverlay, closeOverlay } from '../../router/overlay/overlay-stack';
  import { faXmark } from '@fortawesome/free-solid-svg-icons';
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
    // iOS-style lifecycle (see kit CLAUDE.md callback-naming). `will` = transition
    // starting (content still visible); `did` = finished. onDidDismiss fires after
    // the exit animation completes — the hook the modal registry uses for teardown.
    onWillPresent,
    onDidPresent,
    onWillDismiss,
    onDidDismiss,
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
    onWillPresent?: () => void;
    onDidPresent?: () => void;
    onWillDismiss?: () => void;
    onDidDismiss?: () => void;
    class?: string;
    contentClass?: string;
    overlayClass?: string;
    bodyClass?: string;
    role?: 'dialog' | 'alertdialog';
    [key: string]: any;
  } = $props();

  // Optional stacking band injected by a host that stacks overlays (modal
  // registry's <ModalLayer>). Absent ⇒ keep the default z-40/z-50 classes.
  const layer = getOverlayLayer();
  const scrimZ = $derived(layer ? `z-index:${layer.z};` : '');
  const contentZ = $derived(layer ? `z-index:${layer.z + 1};` : '');

  // History-back — ONLY when this Dialog is hosted by the kit modal registry (its
  // <ModalLayer> provides the overlay layer above; standalone Dialogs have none and
  // are untouched). Mirrors the open-state into the overlay-stack: opening pushes a
  // synthetic history entry, and a browser/native BACK invokes our callback to flip
  // `open=false` — so the SAME exit transition as an X/Esc close plays (no abrupt
  // teardown). A non-back close (X/Esc/back-button/programmatic) removes the entry;
  // idempotent, so a back press never double-pops history. The single back-interceptor
  // this relies on is installed once by <ModalOutlet> via initOverlayStack().
  let _overlayToken: number | null = null;
  $effect(() => {
    if (!layer) return;
    const o = open;
    if (o && _overlayToken === null) {
      _overlayToken = openOverlay(() => { open = false; });
    } else if (!o && _overlayToken !== null) {
      closeOverlay(_overlayToken);
      _overlayToken = null;
    }
  });
  // Unmounted while still open (defensive): drop the entry WITHOUT an extra
  // history.back — it is already buried under whatever navigation removed us.
  $effect(() => () => {
    if (_overlayToken !== null) {
      closeOverlay(_overlayToken, { viaBack: true });
      _overlayToken = null;
    }
  });

  function handleOpenChange(v: boolean) {
    open = v;
    onOpenChange?.(v);
    if (!v) onclose?.();
  }

  // Fire will-present / will-dismiss on the open edge (covers both host-driven
  // prop changes and bits-ui-driven closes). `did` events hook the actual
  // animation end below (onanimationend for enter, onoutroend for exit).
  let prevOpen = false;
  $effect(() => {
    const o = open;
    if (o === prevOpen) return;
    prevOpen = o;
    if (o) onWillPresent?.();
    else onWillDismiss?.();
  });

  // Exit only. Fullscreen dialogs slide down like a sheet; centered ones pop.
  // Enter is a CSS @keyframes class instead (see <style>): a Svelte `transition:`
  // applies its start state a frame late on iOS WebKit, flashing the settled
  // dialog for one frame ("opens twice"). A CSS animation class is in the computed
  // style before the first paint, so there is no flash.
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
          <Icon icon={faXmark} />
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
            class={cn('dlg-scrim dlg-overlay-in fixed inset-0 z-40', overlayClass)}
            style={scrimZ}
            out:overlayFade|global
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
            style={contentZ}
          >
            <div
              {...props}
              class={cn(
                'pointer-events-auto flex flex-col bg-surface shadow-level-3 outline-none',
                fullScreen
                  ? 'absolute inset-0 rounded-none dlg-in-sheet'
                  : 'max-w-lg w-full max-h-[85vh] rounded-xl overflow-hidden dlg-in-pop',
                className,
                contentClass,
              )}
              out:contentTransition|global
              onanimationend={(e) => {
                // The panel's own enter keyframe (dlg-in-pop / dlg-in-sheet) has
                // finished — present complete. Ignore animationend bubbling up from
                // descendants.
                if (e.target === e.currentTarget) onDidPresent?.();
              }}
              onoutroend={() => onDidDismiss?.()}
            >
              {@render panel()}
            </div>
          </div>
        {/if}
      {/snippet}
    </BitsDialog.Content>
  </BitsDialog.Portal>
</BitsDialog.Root>

<style>
  /* :global because these classes are applied via cn() (not as literals), so
     Svelte's scoped-CSS pruning would drop them; keyframes are -global- to match.
     Each enter animation uses `animation-fill-mode: backwards` so the `from`
     state is applied at the first style resolution (before paint) — no iOS
     first-frame flash — and reverts to the natural settled state afterwards, so
     the Svelte `out:` exit animates cleanly from there. */

  /* iOS-15-safe scrim: explicit alpha. Tailwind's `bg-scrim/40` compiles to
     color-mix(), which iOS 15 Safari ignores, falling back to opaque black. */
  :global(.dlg-scrim) {
    background-color: rgb(0 0 0 / 0.4);
  }
  :global(.dlg-overlay-in) {
    animation: dlgOverlayIn 200ms cubic-bezier(0.2, 0, 0, 1) backwards;
  }
  @keyframes -global-dlgOverlayIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Centered dialog: fade + subtle rise & scale (mirrors motion.ts dialogPop). */
  :global(.dlg-in-pop) {
    animation: dlgInPop 220ms cubic-bezier(0.2, 0, 0, 1) backwards;
  }
  @keyframes -global-dlgInPop {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  /* Fullscreen dialog: slide up from the bottom (mirrors motion.ts sheet bottom). */
  :global(.dlg-in-sheet) {
    animation: dlgInSheet 260ms cubic-bezier(0.2, 0, 0, 1) backwards;
  }
  @keyframes -global-dlgInSheet {
    from {
      transform: translateY(100%);
    }
    to {
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.dlg-overlay-in),
    :global(.dlg-in-pop),
    :global(.dlg-in-sheet) {
      animation-duration: 1ms;
    }
  }
</style>

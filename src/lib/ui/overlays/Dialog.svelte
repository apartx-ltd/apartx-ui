<script lang="ts">
  import { Dialog as BitsDialog } from 'bits-ui';
  import type { TransitionConfig } from 'svelte/transition';
  import { cn } from '../utils/cn';
  import { overlayFade, dialogPop, sheet } from '../utils/motion';
  import { getOverlayLayer, provideOverlayZ } from './layer-context';
  import { useOverlay } from '../../hooks/useOverlay.svelte';
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
    respectBack = true,
    onBackRequest,
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
    respectBack?: boolean;
    /** Спросить хоста перед back-закрытием: true = back обработан (не закрывать).
     *  Только для нативного back; Escape/крестик/backdrop закрывают как раньше. */
    onBackRequest?: () => boolean;
    [key: string]: any;
  } = $props();

  // History-back participation via the unified overlay bridge. `useOverlay` mirrors
  // the open-state into the overlay-stack: opening pushes a synthetic history entry,
  // and a browser/native BACK invokes our callback to flip `open=false` — so the SAME
  // exit transition as an X/Esc close plays (no abrupt teardown). A non-back close
  // (X/Esc/backdrop/programmatic) removes the entry; idempotent, so a back press never
  // double-pops history. The single back-interceptor is installed lazily by the first
  // registerOverlay (and by <ModalOutlet> when present). Enabled by default for ANY
  // scrim Dialog (`respectBack`); opt out with `respectBack={false}`.
  //
  // z-band: an injected layer (modal-registry's <ModalLayer>) takes priority for the
  // z value; otherwise the z comes from useOverlay's own stack slot. The registry does
  // NOT register overlays itself — the hosted Dialog is the ONLY registrant — so we
  // still register even under a layer (no double-registration risk), and only defer the
  // z number to the layer.
  const layer = getOverlayLayer();
  // exitMs = длительность contentTransition (motion.ts: sheet 260 / dialogPop 220) — overlay-aware
  // navigate ждёт столько, чтобы уходящая анимация диалога проиграла до смены роута.
  const overlay = useOverlay(() => open, () => { open = false; }, { respectBack, exitMs: fullScreen ? 260 : 220, onBackRequest });
  const zBand = $derived(layer ? layer.z : overlay.z);
  const scrimZ = $derived(zBand != null ? `z-index:${zBand};` : '');
  const contentZ = $derived(zBand != null ? `z-index:${zBand + 1};` : '');
  // Publish z to descendants (a Select/Combobox inside this Dialog reads it for its popup).
  provideOverlayZ(() => zBand);

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
  // Enter is a CSS @keyframes class instead (see styles/animations.css): a Svelte `transition:`
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
            style={fullScreen
              ? contentZ
              : `${contentZ}--safe-area-inset-top:0px;--safe-area-inset-bottom:0px;`}
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

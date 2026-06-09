<script>
  // iOS-style draggable bottom-sheet with snap breakpoints — the kit Drawer is
  // left/right only, so this fills the bottom-sheet gap. Thin wrapper over the
  // `cupertino-pane` library (an OPTIONAL peer dependency: consumers that use
  // this component install it; nothing else pulls it in).
  //
  // Events are exposed as callback props (onWillDismiss, onBackdropTap, …);
  // `show` is $bindable so the host stays in sync when the pane self-dismisses.
  import { onMount } from 'svelte'
  import { CupertinoPane } from 'cupertino-pane'

  let {
    show = $bindable(false),

    // Common configuration
    modal = false,
    horizontal = false,
    horizontalOffset = null,
    inverse = false,
    parentElement = null,
    followerElement = null,
    cssClass = null,
    fitHeight = false,
    maxFitHeight = null,
    fitScreenHeight = true,
    ionContentScroll = false,
    initialBreak = 'middle',
    backdrop = false,
    backdropOpacity = 0.4,
    backdropBlur = false,
    animationType = 'ease',
    animationDuration = 300,
    bottomClose = true,
    fastSwipeClose = false,
    fastSwipeSensivity = 3,
    freeMode = false,
    lowerThanBottom = true,
    upperThanTop = false,
    touchAngle = 45,
    buttonDestroy = true,
    bottomOffset = 0,
    topperOverflow = true,
    topperOverflowOffset = 0,
    showDraggable = true,
    draggableOver = true,
    clickBottomOpen = true,
    dragBy = null,
    preventClicks = true,
    handleKeyboard = true,
    touchMoveStopPropagation = false,
    simulateTouch = true,
    passiveListeners = true,

    // Square the sheet's top corners once it snaps to the `top` break (iOS-style
    // full-screen sheet). Set false to keep the rounded corners at every break.
    squareCornersAtTop = true,

    breaks = {
      top: { enabled: true, height: 700, bounce: true },
      middle: { enabled: true, height: 300, bounce: true },
      bottom: { enabled: true, height: 100, bounce: true },
    },

    zStack = null,

    modalTransition = 'fade',
    modalFlying = false,
    modalDismissOnIntense = false,

    // Event callbacks
    onDidDismiss = null,
    onWillDismiss = null,
    onTransitionEnd = null,
    onDrag = null,
    onDragEnd = null,
    onDidPresent = null,
    onWillPresent = null,
    onBackdropTap = null,

    customSettings = {},

    children,
  } = $props()

  let element = $state(null)
  let pane = null
  let mounted = $state(false)
  let flatTimer = null

  const paneSettings = $derived({
    modal: modal === true ? true : (modal === false ? false : {
      transition: modalTransition,
      flying: modalFlying,
      dismissOnIntense: modalDismissOnIntense,
    }),
    horizontal,
    horizontalOffset,
    inverse,
    parentElement,
    followerElement,
    cssClass,
    fitHeight,
    maxFitHeight,
    fitScreenHeight,
    ionContentScroll,
    initialBreak,
    backdrop,
    backdropOpacity,
    backdropBlur,
    animationType,
    animationDuration,
    bottomClose,
    fastSwipeClose,
    fastSwipeSensivity,
    freeMode,
    lowerThanBottom,
    upperThanTop,
    touchAngle,
    buttonDestroy,
    bottomOffset,
    topperOverflow,
    topperOverflowOffset,
    showDraggable,
    draggableOver,
    clickBottomOpen,
    dragBy,
    preventClicks,
    handleKeyboard,
    touchMoveStopPropagation,
    simulateTouch,
    passiveListeners,
    breaks,
    zStack,
    events: {
      onDidDismiss: (e) => {
        onDidDismiss?.(e)
        createPane()
      },
      onWillDismiss: (e) => { onWillDismiss?.(e) },
      onTransitionEnd: (e) => { onTransitionEnd?.(e); syncFlatTop() },
      // Live-square while the user drags (fires every frame), then again on
      // release and after any programmatic/present transition. All paths read
      // the real transform position, so corners track the sheet exactly.
      onDrag: (e) => { onDrag?.(e); syncFlatTop() },
      onDragEnd: (e) => { onDragEnd?.(e); syncFlatTop() },
      onDidPresent: (e) => { onDidPresent?.(e); syncFlatTop() },
      onWillPresent: (e) => { onWillPresent?.(e) },
      onBackdropTap: (e) => { onBackdropTap?.(e) },
    },
    ...customSettings,
  })

  onMount(() => {
    mounted = true
    return () => {
      if (flatTimer) clearTimeout(flatTimer)
      if (pane) {
        pane.destroy()
        pane = null
      }
    }
  })

  function createPane() {
    if (!element) return
    if (pane) {
      pane.destroy()
      pane = null
    }
    pane = new CupertinoPane(element, paneSettings)
    if (show) present()
  }

  // Square the pane's corners while it sits at (or above) the `top` break,
  // restore the rounded corners otherwise. The pane element is created by the
  // library and lives outside this component, so toggle its radius imperatively
  // (the library declares border-radius in injected CSS, so this inline override
  // wins; clearing it falls back to the rounded default; the change rides the
  // library's own `transition: all` so corners animate with the sheet).
  //
  // Compare the ACTUAL transform position to the top breakpoint rather than
  // `currentBreak()` — the library's `currentBreakpoint` desyncs from the real
  // position (moveToBreak doesn't commit it, and bundled drag-snap reports a
  // stale break), so a string check there is unreliable. `getPanelTransformY()`
  // is the live truth and works for drag, swipe, and programmatic moves alike.
  function applyFlatTop() {
    const el = pane?.paneEl
    if (!el) return
    const top = pane.breakpoints?.breaks?.top
    const y = pane.getPanelTransformY?.()
    // +1px epsilon for sub-pixel rounding; smaller Y == higher on screen.
    const atTop = squareCornersAtTop && typeof top === 'number' && typeof y === 'number' && y <= top + 1
    const want = atTop ? '0px' : ''
    if (el.style.borderRadius !== want) el.style.borderRadius = want
  }

  // Apply now (live, e.g. mid-drag) AND once more after the snap settles. On
  // release the pane is still at the finger position while it animates to its
  // target break, so the immediate read can miss a snap UP to `top`; the trailing
  // re-check reads the settled position. We can't lean on `onTransitionEnd` for
  // this — the library notes a browser bug where it may not fire on a drag-snap.
  function syncFlatTop() {
    applyFlatTop()
    if (flatTimer) clearTimeout(flatTimer)
    flatTimer = setTimeout(applyFlatTop, (animationDuration || 300) + 60)
  }

  // Recreate the pane when mounted or settings change.
  $effect(() => {
    if (mounted && paneSettings && element) {
      createPane()
    }
  })

  // Present/hide when `show` toggles.
  $effect(() => {
    if (mounted && pane && show !== undefined) {
      if (show) present()
      else hide()
    }
  })

  // Public instance methods (bind:this access).
  export async function present() {
    if (!pane) return
    return await pane.present()
  }

  export async function destroy(options = {}) {
    if (!pane) return
    return await pane.destroy(options)
  }

  export function hide() {
    if (!pane) return
    pane.hide()
  }

  export function moveToBreak(breakpoint) {
    if (!pane) return
    pane.moveToBreak(breakpoint)
  }

  export function moveToHeight(height) {
    if (!pane) return
    pane.moveToHeight(height)
  }

  export function currentBreak() {
    if (!pane) return null
    return pane.currentBreak()
  }

  export function calcFitHeight() {
    if (!pane) return
    pane.calcFitHeight()
  }

  export function getPaneInstance() {
    return pane
  }
</script>

<div bind:this={element} class:hidden={!mounted}>
  {@render children?.()}
</div>

<style>
  /* The pane mounts outside this component (cupertino-pane appends it to
     <body>), so target it globally. Two things the library defaults get wrong
     for the kit:
       1. Colours — it ships a hardcoded white sheet. Map it onto kit M3 tokens
          (inherited from the themed <html>/<body>), so it follows light/dark.
       2. Stacking — its .pane/.backdrop sit at z-index 11/10, below typical page
          chrome (FABs at z-20, map controls at z-10). Lift them into the kit
          overlay range (Dialog/Drawer use z-40/z-50). The library prepends its
          own <style> to <head>, so these bundled rules win at equal specificity. */
  :global(.cupertino-pane-wrapper) {
    --cupertino-pane-background: var(--color-surface-container);
    --cupertino-pane-color: var(--color-on-surface);
    --cupertino-pane-move-background: var(--color-outline-variant);
    --cupertino-pane-destroy-button-background: var(--color-surface-container-high);
    --cupertino-pane-icon-close-color: var(--color-on-surface-variant);
  }
  :global(.cupertino-pane-wrapper .pane) {
    z-index: 50;
  }
  :global(.cupertino-pane-wrapper .backdrop) {
    z-index: 40;
  }
</style>

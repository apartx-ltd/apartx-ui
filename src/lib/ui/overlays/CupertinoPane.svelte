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
    onDidPresent = null,
    onWillPresent = null,
    onBackdropTap = null,

    customSettings = {},

    children,
  } = $props()

  let element = $state(null)
  let pane = null
  let mounted = $state(false)

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
      onTransitionEnd: (e) => { onTransitionEnd?.(e) },
      onDidPresent: (e) => { onDidPresent?.(e) },
      onWillPresent: (e) => { onWillPresent?.(e) },
      onBackdropTap: (e) => { onBackdropTap?.(e) },
    },
    ...customSettings,
  })

  onMount(() => {
    mounted = true
    return () => {
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

<script>
  // BottomSheet — iOS-style draggable bottom sheet with snap points, built on the
  // bits-ui Dialog primitive (the kit's standard overlay shell: portal-to-<body>,
  // backdrop, focus-trap, escape, scroll-lock — same as Dialog/AlertDialog). The
  // drag / snap-point / scroll-handoff gesture layer is ADAPTED FROM vaul-svelte
  // (MIT, huntabyte) and reimplemented on Svelte 5 runes + bits-ui v2.
  //
  // Why this exists: cupertino-pane appends to el.parentElement (trapped below the
  // page header) and computes break heights against a cached innerHeight with a
  // clamp that only runs under fitHeight:true — fragile. Dialog.Portal renders to
  // <body>, so the sheet escapes any container / transform ancestor by construction.
  import { onMount } from 'svelte'
  import { Dialog } from 'bits-ui'
  import { cn } from '../utils/cn'

  let {
    open = $bindable(false),
    snapPoints = [1],
    activeSnapPoint = $bindable(undefined),
    dismissible = true,
    backdrop = true,
    backdropOpacity = 0.4,
    squareCornersAtTop = true,
    showHandle = true,
    modal = true,
    class: className = '',
    onOpenChange = null,
    onSnapChange = null,
    onClose = null,
    children,
  } = $props()

  const TRANSITION = 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)'
  const VELOCITY_THRESHOLD = 0.4   // px/ms — vaul's threshold for a "flick"
  const SETTLE_MS = 500            // suppress drag right after open/reach-top

  let contentEl = $state(null)
  let viewportH = $state(typeof window !== 'undefined' ? window.innerHeight : 800)
  let openTime = $state(0)

  // Default the active snap to the first (least-open) point.
  $effect(() => {
    if (activeSnapPoint === undefined && snapPoints.length) activeSnapPoint = snapPoints[0]
  })

  // translateY (px) for a snap point. 0 = fully open (top); larger = further down.
  // fraction s ⇒ visible height s*viewportH ⇒ offset viewportH - s*viewportH.
  function offsetOf(s) {
    const px = typeof s === 'string' ? parseInt(s, 10) : s * viewportH
    return Math.max(0, viewportH - px)
  }
  const offsets = $derived(snapPoints.map(offsetOf))
  const minOffset = $derived(offsets.length ? Math.min(...offsets) : 0)  // largest snap / topmost
  const maxOffset = $derived(offsets.length ? Math.max(...offsets) : viewportH) // smallest snap / lowest
  const activeOffset = $derived(offsetOf(activeSnapPoint ?? snapPoints[0]))

  let dragging = $state(false)
  let dragOffset = $state(null)   // live px during a drag; null ⇒ follow activeOffset

  const translateY = $derived(dragOffset ?? activeOffset)
  const squareTop = $derived(squareCornersAtTop && translateY <= minOffset + 1)

  // ---- gesture state (adapted from vaul-svelte, MIT) ----
  let pointerStart = 0
  let pressTarget = null
  let startOffset = 0
  let isAllowedToDrag = false
  let dragStartTime = 0
  let scrollEl = null            // the inner scroll container under the press, if any
  let scrollPrevOverflow = null  // saved inline overflow-y while locked (null = not locked)

  // Nearest scrollable ancestor of `target` (the consumer's scroller, e.g. a list).
  function findScrollEl(target) {
    let el = target
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight) return el
      el = el.parentNode
    }
    return null
  }
  // While we drag the SHEET, the inner scroller must not also scroll natively — the
  // browser would otherwise start a native scroll, steal the touch, fire pointercancel,
  // and the sheet would snap back after a couple px. vaul does the same via a
  // `.vaul-scrollable { overflow: hidden }` rule during drag; we do it imperatively.
  // Save/restore the scroller's ORIGINAL inline overflow-y (virtua sets its own) so
  // unlock doesn't wipe it; guard so a double-lock doesn't save 'hidden' as the prev.
  function lockScroll() {
    if (!scrollEl || scrollPrevOverflow !== null) return
    scrollPrevOverflow = scrollEl.style.overflowY || ''
    scrollEl.style.overflowY = 'hidden'
  }
  function unlockScroll() {
    if (scrollEl && scrollPrevOverflow !== null) scrollEl.style.overflowY = scrollPrevOverflow
    scrollEl = null
    scrollPrevOverflow = null
  }

  // Rubber-band resistance when dragging above the top snap (vaul's dampenValue idea).
  function dampen(v) {
    const damped = 8 * (Math.log(v + 1) - 2)
    return damped > v ? v : Math.max(0, damped)
  }

  // Decide whether THIS pointermove drags the sheet or lets a scroller scroll.
  // Walk up from the touched element: a scrollable ancestor not at the top keeps the
  // scroll (return false). At scrollTop 0 (or no scrollable ancestor) → drag the sheet.
  function shouldDrag(target, draggingDown) {
    if (translateY > minOffset + 1) return true            // already pulled down a bit
    if (openTime && Date.now() - openTime < SETTLE_MS) return false
    let el = target
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight) {
        if (el.scrollTop > 0) return false                 // scrolled → let it scroll
      }
      el = el.parentNode
    }
    if (!draggingDown) return false                        // at top & dragging up → inner scroll
    return true
  }

  function onpointerdown(e) {
    pointerStart = e.screenY
    pressTarget = e.target
    startOffset = activeOffset
    dragStartTime = Date.now()
    isAllowedToDrag = false
    scrollEl = findScrollEl(e.target)
    // Below the top snap the WHOLE sheet drags (never the list), so lock the inner
    // scroller up front — that way the browser never starts a native scroll that
    // would cancel the drag. At the top snap we leave it scrollable and only lock
    // once the drag actually commits (in onpointermove).
    if (activeOffset > minOffset + 1) lockScroll()
    contentEl?.setPointerCapture?.(e.pointerId)
  }

  function onpointermove(e) {
    if (!pointerStart) return
    const delta = e.screenY - pointerStart                 // down = positive
    const draggingDown = delta > 0
    if (!isAllowedToDrag && !shouldDrag(pressTarget, draggingDown)) return
    isAllowedToDrag = true
    dragging = true
    lockScroll()                                           // sheet is dragging → freeze inner scroll
    let next = startOffset + delta
    if (next < minOffset) next = minOffset - dampen(minOffset - next)  // rubber-band above top
    dragOffset = next
  }

  function onpointerup(e) {
    if (!isAllowedToDrag) { endDrag(); return }
    const current = dragOffset ?? activeOffset
    const distance = current - startOffset                 // +down / -up
    const elapsed = Math.max(1, Date.now() - dragStartTime)
    const velocity = Math.abs(e.screenY - pointerStart) / elapsed
    const draggingDown = distance > 0

    const sorted = [...offsets].sort((a, b) => a - b)       // ascending = top→bottom
    const activeIdx = sorted.indexOf(activeOffset)

    // Fast flick → step one snap in the drag direction (or dismiss off the lowest).
    if (velocity > VELOCITY_THRESHOLD && Math.abs(distance) < viewportH * 0.4) {
      if (draggingDown) {
        if (activeIdx >= sorted.length - 1) {               // already lowest
          if (dismissible) { dismiss(); return }
        } else { snapTo(sorted[activeIdx + 1]); return }
      } else {
        if (activeIdx > 0) { snapTo(sorted[activeIdx - 1]); return }
        snapTo(sorted[0]); return
      }
    }

    // Otherwise settle to the closest snap by position.
    const closest = offsets.reduce((p, c) => Math.abs(c - current) < Math.abs(p - current) ? c : p)
    if (closest >= maxOffset - 1 && draggingDown && dismissible && distance > viewportH * 0.15) {
      dismiss(); return
    }
    snapTo(closest)
  }

  function snapTo(offset) {
    const i = offsets.indexOf(offset)
    if (i !== -1) activeSnapPoint = snapPoints[i]
    endDrag()
  }

  function endDrag() {
    dragging = false
    dragOffset = null
    pointerStart = 0
    pressTarget = null
    isAllowedToDrag = false
    unlockScroll()
  }

  // Animate down off-screen, then actually close after the transition.
  function dismiss() {
    dragging = false
    dragOffset = viewportH
    pointerStart = 0
    isAllowedToDrag = false
    unlockScroll()
    setTimeout(() => { handleOpenChange(false); dragOffset = null }, 520)
  }

  function handleOpenChange(v) {
    open = v
    onOpenChange?.(v)
    if (!v) onClose?.()
  }

  // Recompute offsets when the viewport changes — but NEVER mid-drag (changing the
  // geometry under an active gesture is exactly what made cupertino dismiss). When
  // idle, snap geometry tracks the live viewport.
  onMount(() => {
    if (typeof window === 'undefined') return
    const onResize = () => { if (!dragging) viewportH = window.innerHeight }
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    openTime = Date.now()
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  })

  // Notify when the settled snap changes (skip the live drag frames).
  let lastNotified = $state(undefined)
  $effect(() => {
    if (dragging) return
    const s = activeSnapPoint
    if (s !== undefined && s !== lastNotified) { lastNotified = s; onSnapChange?.(s) }
  })

  // Reset the settle timer whenever we (re)open, so the first 500ms suppress drag.
  $effect(() => { if (open) openTime = Date.now() })
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange} {modal}>
  <Dialog.Portal>
    {#if open}
      {#if backdrop}
        <Dialog.Overlay
          forceMount
          class="fixed inset-0 z-40 bg-black"
          style={`opacity:${backdropOpacity};transition:opacity 0.3s ease;`}
        />
      {/if}
      <!-- preventScroll={false}: bits-ui Dialog's default scroll-lock (RemoveScroll)
           hijacks touchmove to lock the page — it ALSO blocks the inner list's native
           scroll AND eats our drag gesture (sheet wouldn't move, list wouldn't scroll).
           We don't need it (the sheet is fixed/portalled), so disable it — same as vaul.
           touch-none on the content (below) keeps the browser from claiming vertical
           gestures for native panning, so our pointer-drag wins; the inner scroll
           container still scrolls (its own touch-action governs it). -->
      <Dialog.Content
        forceMount
        preventScroll={false}
        bind:ref={contentEl}
        onpointerdown={onpointerdown}
        onpointermove={onpointermove}
        onpointerup={onpointerup}
        onpointercancel={endDrag}
        class={cn(
          'fixed inset-x-0 bottom-0 z-50 flex flex-col bg-surface-container text-on-surface',
          'rounded-t-2xl shadow-level-3 touch-none select-none',
          squareTop && 'rounded-t-none',
          className,
        )}
        style={`height:100dvh;transform:translate3d(0,${translateY}px,0);transition:${dragging ? 'none' : TRANSITION};`}
      >
        {#if showHandle}
          <div class="mx-auto mt-2 mb-1 h-1.5 w-9 shrink-0 touch-none rounded-full bg-outline-variant"></div>
        {/if}
        <div class="min-h-0 flex-1">
          {@render children?.()}
        </div>
      </Dialog.Content>
    {/if}
  </Dialog.Portal>
</Dialog.Root>

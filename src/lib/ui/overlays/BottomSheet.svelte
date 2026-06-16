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
  import { onMount, untrack } from 'svelte'
  import { Dialog } from 'bits-ui'
  import { cn } from '../utils/cn'
  import { getPagePortalHost } from '../../navigation/context'

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
    // When false, present/dismiss happen INSTANTLY (no slide, no backdrop fade).
    // Lets a host suppress the enter animation for a restore — e.g. returning to a
    // map with the sheet already open — and re-enable it afterwards so later
    // opens/closes still animate. Default true = the normal animated behaviour.
    animate = true,
    // Where to portal the sheet. 'body' (default) escapes any transform/overflow
    // ancestor — the kit default. 'page' portals into the nearest <PageLayer>
    // element (provided via context by <PageTransition>) so the sheet rides the
    // page-transition slide instead of hanging in place; falls back to <body>
    // when there is no <PageTransition> ancestor. The transition layer is a
    // non-scrolling stage (scrolling lives on .pt-content), so the fixed sheet can't
    // be offset/yanked by a layer scroll while it rides the slide.
    portalTarget = 'body',
    class: className = '',
    onOpenChange = null,
    onSnapChange = null,
    onWillDismiss = null,  // close has begun (slide-out start) — content still visible
    onDidDismiss = null,   // fully closed (unmounted) — cancelled if reopened first
    children,
  } = $props()

  // Resolve the portal destination. For 'page', read the layer element from the
  // PageLayer context (a getter, so it tracks mount/unmount); `?? undefined` lets
  // bits-ui Portal fall back to <body> when no host yet — never pass null (its DEV
  // guard throws). 'body' (or any non-'page') always portals to <body>.
  const pageHost = getPagePortalHost()
  const portalTo = $derived(portalTarget === 'page' ? (pageHost?.() ?? undefined) : undefined)

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
  let dragOffset = $state(null)   // live px during a drag / enter-exit; null ⇒ follow activeOffset

  // Render gate decoupled from `open`: stays true through the slide-OUT so the sheet
  // animates away before it unmounts. Driven by the enter/exit effect below.
  let rendered = $state(false)
  let backdropOn = $state(false)  // drives the backdrop fade in sync with the slide
  let closeTimer = null
  let prevOpen = false            // plain mirror of last-seen `open` (guards the effect)

  const translateY = $derived(dragOffset ?? activeOffset)
  const atTop = $derived(translateY <= minOffset + 1)
  const squareTop = $derived(squareCornersAtTop && atTop)

  // ---- gesture state (adapted from vaul-svelte, MIT) ----
  let pointerStart = 0
  let pointerStartX = 0
  let pressTarget = null
  let startOffset = 0
  let isAllowedToDrag = false
  let dragStartTime = 0
  // Axis lock, decided on the first significant movement of a gesture:
  //   'x' → horizontal-dominant: it belongs to a horizontally-scrollable child
  //         (e.g. a cssMode/native scroll-snap Carousel). NEVER drag the sheet and
  //         NEVER preventDefault, so the child's native scroll survives — crucially
  //         even BELOW the top snap, where shouldDrag() would otherwise capture
  //         every touch as a sheet drag and kill the swipe.
  //   'y' → vertical-dominant: run the normal sheet/list handoff (shouldDrag).
  //   null → not yet determined.
  let gestureAxis = null
  const AXIS_LOCK_PX = 6   // movement before a gesture commits to an axis

  // Rubber-band resistance when dragging above the top snap (vaul's dampenValue idea).
  function dampen(v) {
    const damped = 8 * (Math.log(v + 1) - 2)
    return damped > v ? v : Math.max(0, damped)
  }

  // Decide whether THIS move drags the sheet or lets a scroller scroll natively.
  // This is the whole handoff model:
  //   • Below the top snap (sheet pulled down) → ALWAYS drag the sheet, never the list.
  //   • At the top snap → walk up from the touched element; a scrollable ancestor with
  //     scrollTop > 0 keeps its native scroll (return false). At scrollTop 0 the list is
  //     at its top: dragging DOWN takes over and pulls the sheet down; dragging UP stays
  //     with the (already-at-top) list so it can't pull the sheet further up.
  // The native list scroll is only *suppressed* by preventDefault in the touch handler
  // when this returns true — we never fight virtua's inline overflow styles.
  function shouldDrag(target, draggingDown) {
    if (translateY > minOffset + 1) return true            // below top → sheet drags
    if (openTime && Date.now() - openTime < SETTLE_MS) return false
    let el = target
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight) {
        if (el.scrollTop > 0) return false                 // list scrolled → let it scroll
      }
      el = el.parentNode
    }
    if (!draggingDown) return false                        // at list top & dragging up → list
    return true                                            // at list top & dragging down → sheet
  }

  // ---- shared drag core (driven by both pointer [mouse] and touch handlers) ----
  function startDrag(screenY, screenX, target) {
    pointerStart = screenY
    pointerStartX = screenX
    pressTarget = target
    startOffset = activeOffset
    dragStartTime = Date.now()
    isAllowedToDrag = false
    gestureAxis = null
  }

  // Apply a move to `screenY`/`screenX`. Returns true once the gesture has committed to
  // dragging the SHEET (so the touch handler knows to preventDefault and kill the native
  // scroll). A horizontal-dominant gesture locks to axis 'x' and always returns false, so
  // a child carousel keeps its native horizontal scroll instead of dragging the sheet.
  function moveDrag(screenY, screenX) {
    if (!pointerStart) return false
    const delta = screenY - pointerStart                   // down = positive
    const dx = screenX - pointerStartX
    // Commit the gesture to an axis once it has moved past the threshold. Until then
    // stay neutral (return false → no preventDefault) so we never steal a swipe we
    // haven't classified yet.
    if (gestureAxis === null) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(delta) < AXIS_LOCK_PX) return false
      gestureAxis = Math.abs(dx) > Math.abs(delta) ? 'x' : 'y'
    }
    if (gestureAxis === 'x') return false                  // horizontal → leave it to the child
    const draggingDown = delta > 0
    if (!isAllowedToDrag && !shouldDrag(pressTarget, draggingDown)) return false
    isAllowedToDrag = true
    dragging = true
    let next = startOffset + delta
    if (next < minOffset) next = minOffset - dampen(minOffset - next)  // rubber-band above top
    dragOffset = next
    return true
  }

  function release(screenY) {
    if (!isAllowedToDrag) { endDrag(); return }
    const current = dragOffset ?? activeOffset
    const distance = current - startOffset                 // +down / -up
    const elapsed = Math.max(1, Date.now() - dragStartTime)
    const velocity = Math.abs(screenY - pointerStart) / elapsed
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

  // ---- pointer handlers: MOUSE / PEN ONLY (touch goes through the touch handlers
  // below, which can preventDefault to stop the list's native scroll) ----
  function onpointerdown(e) {
    if (e.pointerType === 'touch') return
    startDrag(e.screenY, e.screenX, e.target)
    contentEl?.setPointerCapture?.(e.pointerId)
  }
  function onpointermove(e) {
    if (e.pointerType === 'touch') return
    moveDrag(e.screenY, e.screenX)
  }
  function onpointerup(e) {
    if (e.pointerType === 'touch') return
    release(e.screenY)
  }
  function onpointercancel(e) {
    if (e.pointerType === 'touch') return
    endDrag()
  }

  // ---- touch handlers (attached non-passively via the effect below) ----
  // touchstart fires before the synthetic pointer events; touch events keep targeting
  // the start element for the whole gesture, so no pointer-capture is needed. The key
  // is onTouchMove: when the gesture is a SHEET drag we preventDefault, which is the
  // ONLY reliable way to stop the inner list's native scroll (pointermove can't, and
  // forcing overflow:hidden fights virtua). When it's a list scroll we don't, so the
  // list scrolls natively.
  function onTouchStart(e) {
    startDrag(e.touches[0].screenY, e.touches[0].screenX, e.target)
  }
  function onTouchMove(e) {
    if (moveDrag(e.touches[0].screenY, e.touches[0].screenX)) e.preventDefault()
  }
  function onTouchEnd(e) {
    release(e.changedTouches[0].screenY)
  }

  // Desktop: the list scrolls via wheel, which is NOT a pointer event, so the drag
  // gesture never sees it — below the top snap the list would scroll inside the
  // un-expanded sheet. Mirror the touch model: suppress wheel scrolling unless the
  // sheet is at the top snap (where the list is meant to scroll natively).
  function onWheel(e) {
    if (!atTop) e.preventDefault()
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
    gestureAxis = null
  }

  // Flip `open` false and let the enter/exit effect animate the slide-down + unmount.
  // We deliberately DON'T null dragOffset here — the effect picks up from the current
  // (dragged) position and slides it the rest of the way down without a jump.
  function dismiss() {
    pointerStart = 0
    pressTarget = null
    isAllowedToDrag = false
    dragging = false
    open = false
    onOpenChange?.(false)
  }

  // bits-ui asks to change the open state on user intent (backdrop tap / escape). We
  // open via our own `open` prop and animate, so ignore v===true; on a close request
  // route it through `open` (honouring dismissible) so the slide-OUT runs instead of
  // Dialog unmounting the content instantly.
  function onDialogOpenChange(v) {
    if (v || !open) return
    if (!dismissible) return
    open = false
    onOpenChange?.(false)
  }

  // Enter/exit animation. `open` (host intent) maps to the internal `rendered` gate so
  // the sheet stays mounted through the slide-OUT; dragOffset — the same transform
  // override the drag uses — animates it: window.innerHeight = fully below the screen,
  // null = settle to activeOffset. Reads ONLY `open` (guarded by the plain prevOpen
  // mirror) so resize or our own writes never re-trigger the animation, and a closed
  // initial mount doesn't fire a spurious onWillDismiss/onDidDismiss.
  $effect(() => {
    const isOpen = open
    if (isOpen === prevOpen) return
    prevOpen = isOpen
    if (isOpen) {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
      rendered = true
      dragging = false
      // Instant present (no slide): render straight at activeOffset. CSS transitions
      // don't run on a node's first paint, so the sheet just appears at its snap —
      // used to restore an already-open sheet without re-animating it.
      if (!animate) { dragOffset = null; backdropOn = true; return }
      dragOffset = window.innerHeight                        // mount off-screen, below
      backdropOn = false                                     // backdrop starts transparent
      // Two rAFs: paint the off-screen frame first, THEN release to activeOffset so the
      // CSS transition animates the slide-UP (one rAF can coalesce with the mount paint).
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (open) { dragging = false; dragOffset = null; backdropOn = true }
      }))
    } else {
      // Close has begun: fire onWillDismiss NOW (slide-out start) while content is still
      // on screen. untrack so the callback identity isn't a dep of this effect.
      untrack(() => onWillDismiss?.())
      dragging = false
      // Instant dismiss (no slide): unmount and report closed in the same tick.
      if (!animate) {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
        rendered = false
        dragOffset = null
        backdropOn = false
        activeSnapPoint = snapPoints[0]
        untrack(() => onDidDismiss?.())
        return
      }
      dragOffset = window.innerHeight                        // slide DOWN off-screen
      backdropOn = false                                     // fade backdrop out
      if (closeTimer) clearTimeout(closeTimer)
      closeTimer = setTimeout(() => {
        rendered = false
        dragOffset = null
        activeSnapPoint = snapPoints[0]                      // next open starts at the default snap
        closeTimer = null
        onDidDismiss?.()                                     // fully closed (unmounted) — safe to clear content
      }, 540)                                                // transition (500ms) + slack
    }
  })

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
      // Drop a pending close timer so onDidDismiss can't fire after the sheet unmounts
      // (e.g. the host navigates away while the sheet is mid-slide-out).
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
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

  // Lock the page behind the sheet while it's open. We disabled bits-ui's own
  // scroll-lock (preventScroll={false}) because it ALSO blocked the inner list's
  // scroll — so we must lock the document ourselves (as vaul does). Without this the
  // drag leaks THROUGH the sheet: the browser scroll-chains the touch to the page,
  // drags it under the sheet, and that native scroll fires pointercancel — so the
  // sheet jumps a few px and snaps back. overflow:hidden stops body scroll;
  // overscroll-behavior:none stops the chain/rubber-band that leaks to the document.
  $effect(() => {
    if (typeof document === 'undefined' || !rendered) return
    const body = document.body
    const html = document.documentElement
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverflow = html.style.overflow
    const prevHtmlOB = html.style.overscrollBehavior
    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    return () => {
      body.style.overflow = prevBodyOverflow
      html.style.overflow = prevHtmlOverflow
      html.style.overscrollBehavior = prevHtmlOB
    }
  })

  // Attach touch/wheel listeners on the sheet imperatively so they are NON-PASSIVE —
  // Svelte/the browser default touchmove & wheel to passive, where preventDefault is
  // ignored. Non-passive is what lets onTouchMove/onWheel cancel the inner list's
  // native scroll the instant the gesture must drive the sheet. Re-runs on (re)mount.
  $effect(() => {
    const el = contentEl
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', endDrag, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', endDrag)
      el.removeEventListener('wheel', onWheel)
    }
  })
</script>

<Dialog.Root open={rendered} onOpenChange={onDialogOpenChange} {modal}>
  <Dialog.Portal to={portalTo}>
    {#if rendered}
      {#if backdrop}
        <Dialog.Overlay
          forceMount
          class="fixed inset-0 z-40 bg-black"
          style={`opacity:${backdropOn ? backdropOpacity : 0};transition:${animate ? 'opacity 0.3s ease' : 'none'};`}
        />
      {/if}
      <!-- preventScroll={false}: bits-ui Dialog's default scroll-lock (RemoveScroll)
           hijacks touchmove to lock the page — it ALSO blocks the inner list's native
           scroll AND eats our drag gesture. We disable it (same as vaul) and lock the
           document ourselves (see the body-lock effect above).
           touch-action: pan-y — we allow the browser to offer a vertical pan, but the
           non-passive touchmove handler (see onTouchMove) preventDefaults the instant the
           gesture is a SHEET drag, which cancels the would-be native scroll. When the
           gesture is a list scroll (at the top snap, list not at its top) we don't
           preventDefault, so pan-y lets the list scroll natively. overscroll-behavior:
           contain stops a list scroll from chaining out to the page.
           Pointer handlers are MOUSE/PEN only (they bail on pointerType==='touch'). -->
      <Dialog.Content
        forceMount
        preventScroll={false}
        bind:ref={contentEl}
        onpointerdown={onpointerdown}
        onpointermove={onpointermove}
        onpointerup={onpointerup}
        onpointercancel={onpointercancel}
        class={cn(
          'fixed inset-x-0 bottom-0 z-50 flex flex-col bg-surface-container text-on-surface',
          'rounded-t-2xl shadow-level-3 select-none',
          squareTop && 'rounded-t-none',
          className,
        )}
        style={`height:100dvh;transform:translate3d(0,${translateY}px,0);transition:${dragging || !animate ? 'none' : TRANSITION};touch-action:pan-y;overscroll-behavior:contain;`}
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

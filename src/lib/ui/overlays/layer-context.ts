import { getContext, setContext } from 'svelte';

/**
 * Overlay stacking-layer context.
 *
 * By default kit overlays (`Dialog`, `BottomSheet`) hardcode scrim `z-40` /
 * content `z-50`. That is fine for a single overlay, but breaks when several are
 * stacked and portalled to `<body>` (equal z ⇒ DOM/portal order decides, which is
 * chunk-resolution order, not open order). A host that stacks overlays (e.g. the
 * modal registry's `<ModalOutlet>`) wraps each one in a provider that injects a
 * per-instance z-index band here; the overlays read it and apply it inline,
 * overriding the default classes.
 *
 * When NO layer is provided (every existing call site), `getOverlayLayer()`
 * returns `undefined` and the overlay keeps its `z-40`/`z-50` classes — so this
 * is fully backwards-compatible.
 */

export interface OverlayLayer {
  /** Scrim z-index for this overlay. Content is rendered at `z + 1`. Reactive. */
  readonly z: number;
}

const OVERLAY_LAYER_KEY = Symbol('apartx-ui:overlay-layer');

/** Provide a stacking band to descendant overlays. Call during component init. */
export function setOverlayLayer(layer: OverlayLayer): void {
  setContext(OVERLAY_LAYER_KEY, layer);
}

/** Опубликовать z текущего оверлея потомкам (вложенным порталам). Reactive-геттер.
 *  Fallback 60 (не 0): если у оверлея ещё/уже нет своего z (напр. standalone Dialog
 *  с respectBack={false}, или первый кадр до регистрации), вложенный дропдаун берёт
 *  z+2 = 62 — выше дефолтного контента диалога (z-50), а не за ним. Совпадает с
 *  fallback'ом самих дропдаунов (Select/Combobox `: 60`). */
export function provideOverlayZ(getZ: () => number | undefined): void {
  setContext(OVERLAY_LAYER_KEY, { get z() { return getZ() ?? 60; } });
}

/** Read the injected overlay layer, if any. `undefined` ⇒ use default z classes. */
export function getOverlayLayer(): OverlayLayer | undefined {
  return getContext<OverlayLayer | undefined>(OVERLAY_LAYER_KEY);
}

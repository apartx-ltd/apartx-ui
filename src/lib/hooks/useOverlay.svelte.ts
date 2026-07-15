// Единый мост оверлея в overlay-stack. Компонент со scrim зовёт его одной строкой.
// Зеркалит open-state (по ПЕРЕХОДУ isOpen — backdrop/Escape/X/программно/back идут
// одним путём). Отдаёт reactive z-band из стека. SSR-safe: $effect не идёт на сервере.
import { registerOverlay, closeOverlay, type OverlayHandle } from '../router/overlay/overlay-stack';

export interface UseOverlay {
  /** Reactive z-band для scrim; content = z+1, вложенный попап = z+2. undefined пока закрыт. */
  readonly z: number | undefined;
  /** Пометить, что закрытие — это навигация, УЖЕ переиспользовавшая запись оверлея
   *  (replace). Тогда закрытие НЕ делает history.back. */
  commit(): void;
}

export function useOverlay(
  getOpen: () => boolean,
  close: () => void,
  opts?: { respectBack?: boolean; exitMs?: number },
): UseOverlay {
  let handle = $state<OverlayHandle | null>(null);
  let committed = false;
  const respectBack = opts?.respectBack ?? true;

  $effect(() => {
    if (!respectBack) return;
    const open = getOpen();
    if (open && handle === null) {
      // exitMs: сколько overlay-aware navigate ждёт перед сменой роута, чтобы уходящая
      // анимация оверлея успела проиграть (иначе страница уносит его на полукадре).
      handle = registerOverlay({ close, scrim: true, exitMs: opts?.exitMs });
      committed = false;
    } else if (!open && handle !== null) {
      closeOverlay(handle.token, committed ? { viaBack: true } : undefined);
      handle = null;
      committed = false;
    }
  });

  // Unmount пока открыт (напр. компонент уносит навигация): снять токен БЕЗ history.back —
  // синтетическая запись погребена под page-push, обычный back её поглотит. Отдельный
  // $effect без реактивных чтений → cleanup только на destroy.
  $effect(() => () => {
    if (handle !== null) {
      closeOverlay(handle.token, { viaBack: true });
      handle = null;
    }
  });

  return {
    get z() { return handle?.z; },
    commit() { committed = true; },
  };
}

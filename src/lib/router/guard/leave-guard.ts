// projects/apartx-ui/src/lib/router/guard/leave-guard.ts
//
// Гарды ухода со страницы с несохранёнными правками (дизайн: docs/plans/2026-10-08-info-unsaved-guard
// в репо apartx). Реестр общий на приложение: пока хоть один гард dirty, уход откладывается до
// confirm хоста — один диалог, сколько бы гардов ни были dirty. Где уход ловится:
//  • push/replace и popstate — history-адаптер через setLeaveGuard (browser.ts, sveltekit.ts);
//  • navigate() — до закрытия оверлеев (core/nav.ts);
//  • закрытие вкладки/перезагрузка — beforeunload (нативный диалог браузера).
// Кит не знает ни текстов, ни диалога: confirm/onStay даёт хост.
import { getHistory } from '../history/registry';
import type { LeaveGuardHook } from '../history/adapter';
import { overlayCount, subscribeOverlay, whenOverlayHistorySettled } from '../overlay/overlay-stack';

export interface LeaveGuard {
  /** Есть несохранённое. Читается в момент попытки ухода — реактивность не нужна. */
  when: () => boolean;
  /** Диалог хоста. true — уйти без сохранения. */
  confirm: () => Promise<boolean>;
  /** Пользователь остался. Зовётся у того же гарда, чей confirm был показан. */
  onStay?: () => void;
}

const guards: LeaveGuard[] = [];
let asking = false;

const firstDirty = () => guards.find((g) => g.when());

export function isLeaveBlocked(): boolean {
  return !!firstDirty();
}

/** Дождаться, пока оверлеи вернутся к baseline (confirm хоста закрылся) и guarded back его
 *  закрытия приземлится. Хост резолвит confirm раньше, чем его Dialog снимет оверлей ($effect). */
function overlaysSettled(baseline: number): Promise<void> {
  return new Promise((resolve) => {
    // Не синхронно: подписчик зовётся из closeOverlay() ДО того, как тот взведёт
    // suppressNextPop и выпустит back, — whenHistorySettled() раньше времени сказал бы «осело».
    const done = () => { void Promise.resolve().then(whenOverlayHistorySettled).then(resolve); };
    if (overlayCount() <= baseline) { done(); return; }
    const off = subscribeOverlay(() => {
      if (overlayCount() > baseline) return;
      off();
      done();
    });
  });
}

/** Уйти, если можно. Нет dirty-гардов — `proceed` синхронно. Иначе confirm первого
 *  dirty-гарда: «Уйти» → `proceed` после того, как история осела; «Остаться» → `onStay`.
 *  Пока confirm открыт, повторные попытки игнорируются. */
export async function requestLeave(proceed: () => void): Promise<void> {
  const guard = firstDirty();
  if (!guard) { proceed(); return; }
  if (asking) return;
  asking = true;
  const baseline = overlayCount();
  let leave = false;
  try {
    leave = await guard.confirm();
  } finally {
    asking = false;
  }
  if (!leave) { guard.onStay?.(); return; }
  await overlaysSettled(baseline);
  proceed();
}

const hook: LeaveGuardHook = {
  blocked: isLeaveBlocked,
  onBlocked: (retry) => { void requestLeave(retry); },
};

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!firstDirty()) return;
  e.preventDefault();
  // Старые Chrome/Safari показывают диалог только при выставленном returnValue.
  e.returnValue = '';
}

/** Зарегистрировать гард. Возвращает снятие. Hook ставится в активный адаптер на каждом
 *  add — адаптер мог смениться (setHistoryAdapter до монтирования роутера). */
export function addLeaveGuard(guard: LeaveGuard): () => void {
  guards.push(guard);
  getHistory().setLeaveGuard?.(hook);
  if (guards.length === 1 && typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload);
  }
  return () => {
    const i = guards.indexOf(guard);
    if (i < 0) return;
    guards.splice(i, 1);
    if (guards.length === 0 && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', onBeforeUnload);
    }
  };
}

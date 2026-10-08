// projects/apartx-ui/src/lib/router/guard/useNavigationGuard.svelte.ts
// Гард ухода на время жизни компонента: пока `when()` — уход со страницы спрашивает `confirm()`.
// Без реактивных чтений эффект идёт один раз; cleanup снимает гард на destroy. SSR — no-op.
import { addLeaveGuard, type LeaveGuard } from './leave-guard';

export function useNavigationGuard(guard: LeaveGuard): void {
  $effect(() => addLeaveGuard(guard));
}

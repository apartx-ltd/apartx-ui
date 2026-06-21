// Модульный сигнал «логический родитель текущего активного роута» (из <Route back>).
// Пишется реактивно из Router.svelte ($effect по active-роуту), читается back.ts и
// superapp-back контроллером. Plain-TS (без рун): реактивность даёт пишущий $effect,
// а потребители читают значение синхронно на момент действия пользователя.

let backTarget: string | null = null;
const subs = new Set<() => void>();

export function setRouteBack(v: string | null): void {
  if (v === backTarget) return;
  backTarget = v;
  subs.forEach((f) => f());
}

export function getRouteBack(): string | null {
  return backTarget;
}

export function subscribeRouteBack(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

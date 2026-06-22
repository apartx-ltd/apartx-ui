<script lang="ts">
  import { getContext, type Snippet } from 'svelte';
  import { ROUTER_CTX, type RouterContextValue, type RouteRecord } from './context';
  import type { RouteLoader } from './lazy';

  let {
    path,
    exact = false,
    component,
    loader,
    stableKey,
    volatileKey,
    back,
    props,
    children,
  }: {
    path: string;
    exact?: boolean;
    component?: any;
    /** Ленивый загрузчик чанка: `loader={() => import('./Page.svelte')}` (альтернатива component). */
    loader?: RouteLoader;
    stableKey?: string;
    /** См. RouteRecord.volatileKey — обратный opt-out для `<Router keyByMatch>`. */
    volatileKey?: boolean;
    back?: string | ((params: Record<string, string>) => string);
    props?: Record<string, any>;
    children?: Snippet<[Record<string, string>]>;
  } = $props();

  const ctx = getContext<RouterContextValue>(ROUTER_CTX);
  if (!ctx) throw new Error('<Route> must be used inside a <Router>');

  // Регистрируемся в INIT-фазе — синхронно, выполняется и на сервере (SSR), и на
  // клиенте. <Route> НИЧЕГО не рендерит: победителя рисует <Router>. Поэтому двойной
  // рендер на SSR невозможен.
  // svelte-ignore state_referenced_locally
  const record: RouteRecord = { path, exact, component, loader, stableKey, volatileKey, back, props, snippet: children };
  ctx.register(record);

  // Снятие регистрации при размонтировании (клиент; напр. teardown вложенного роутера).
  $effect(() => () => ctx.unregister(record));
</script>

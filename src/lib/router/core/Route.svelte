<script lang="ts">
  import { getContext, type Snippet } from 'svelte';
  import { ROUTER_CTX, type RouterContextValue, type RouteRecord } from './context';

  let {
    path,
    exact = false,
    component,
    stableKey,
    back,
    props,
    children,
  }: {
    path: string;
    exact?: boolean;
    component?: any;
    stableKey?: string;
    back?: string | ((params: Record<string, string>) => string);
    props?: Record<string, any>;
    children?: Snippet<[Record<string, string>]>;
  } = $props();

  const ctx = getContext<RouterContextValue>(ROUTER_CTX);
  if (!ctx) throw new Error('<Route> must be used inside a <Router>');

  // Регистрируемся в INIT-фазе — синхронно, выполняется и на сервере (SSR), и на
  // клиенте. <Route> НИЧЕГО не рендерит: победителя рисует <Router>. Поэтому двойной
  // рендер на SSR невозможен.
  const record: RouteRecord = { path, exact, component, stableKey, back, props, snippet: children };
  ctx.register(record);

  // Снятие регистрации при размонтировании (клиент; напр. teardown вложенного роутера).
  $effect(() => () => ctx.unregister(record));
</script>

<script lang="ts">
  import { getContext, setContext, type Snippet } from 'svelte';
  import { useRouter } from './useRouter.svelte';
  import { pick, stripBase, matchParams } from './match-route';
  import { ROUTER_CTX, type RouterContextValue, type RouteRecord } from './context';
  import { setRouteBack } from './active-route';

  let {
    basepath,
    children,
    outlet,
    fallback,
  }: {
    basepath?: string;
    /** <Route> декларации (регистрируются, рендерят пусто). */
    children?: Snippet;
    /** Обёртка активного рендера: получает готовый `render`-сниппет и transition-`key`. */
    outlet?: Snippet<[{ render: Snippet; key: string }]>;
    /** Рендер, когда ни один роут не сматчился. */
    fallback?: Snippet;
  } = $props();

  const router = useRouter();
  const parent = getContext<RouterContextValue | undefined>(ROUTER_CTX);
  // svelte-ignore state_referenced_locally
  const base = basepath ?? parent?.base ?? '/';

  // Плоский (нереактивный) реестр: <Route> пушат в init ДО того, как ниже отрендерится
  // outlet — поэтому на SSR список полон к моменту pick(). Роуты статичны на инстанс
  // (вложенный <Router> — свежий инстанс), список не мутирует после init.
  const records: RouteRecord[] = [];
  setContext<RouterContextValue>(ROUTER_CTX, {
    base,
    register: (r) => records.push(r),
    unregister: (r) => {
      const i = records.indexOf(r);
      if (i >= 0) records.splice(i, 1);
    },
  });

  const localPath = $derived(stripBase(router.pathname, base));
  const active = $derived(pick(records, localPath));
  const params = $derived(active ? matchParams(localPath, active.path) : {});
  // Стабильный ключ от активного роута (shell) — иначе pathname.
  const key = $derived(active?.stableKey ?? router.pathname);

  // Логический родитель активного роута → модульный сигнал (для router.back()
  // fallback и видимости нативной суперап-кнопки). Резолвим функцию-форму с params.
  $effect(() => {
    const b = active?.back;
    setRouteBack(typeof b === 'function' ? b(params) : (b ?? null));
  });
</script>

{#snippet activeRender()}
  {#if active?.component}
    {@const Component = active.component}
    <Component {params} {...(active.props ?? {})} />
  {:else if active?.snippet}
    {@render active.snippet(params)}
  {:else if fallback}
    {@render fallback()}
  {/if}
{/snippet}

<!-- Декларации <Route> регистрируются здесь (рендерят пусто). ДОЛЖНЫ идти ПЕРЕД outlet,
     чтобы реестр был заполнен к моменту pick() на сервере. -->
{@render children?.()}

{#if outlet}
  {@render outlet({ render: activeRender, key })}
{:else}
  {@render activeRender()}
{/if}

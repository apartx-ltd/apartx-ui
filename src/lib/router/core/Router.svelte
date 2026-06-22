<script lang="ts">
  import { getContext, setContext, type Snippet } from 'svelte';
  import { useRouter } from './useRouter.svelte';
  import { pick, stripBase, matchParams } from './match-route';
  import { ROUTER_CTX, type RouterContextValue, type RouteRecord } from './context';
  import { setRouteBack } from './active-route';
  import { getCached, load } from './lazy';

  let {
    basepath,
    children,
    outlet,
    fallback,
    loading,
    error,
    keyByMatch = false,
  }: {
    basepath?: string;
    /** <Route> декларации (регистрируются, рендерят пусто). */
    children?: Snippet;
    /** Обёртка активного рендера: получает готовый `render`-сниппет и transition-`key`. */
    outlet?: Snippet<[{ render: Snippet; key: string }]>;
    /** Рендер, когда ни один роут не сматчился. */
    fallback?: Snippet;
    /** Рендер во время загрузки чанка lazy-роута (`<Route loader>`), на первом визите. */
    loading?: Snippet;
    /** Рендер при ошибке загрузки чанка lazy-роута. */
    error?: Snippet;
    /**
     * Ключевать `PageTransition` по ВЫИГРАВШЕМУ роуту, а не по pathname. Тогда переход
     * внутри одной (в т.ч. префиксной) записи НЕ ре-анимирует outlet, а смена записи —
     * анимирует, БЕЗ per-route `stableKey`. Для master/detail-роутеров (мастер-список,
     * который держится при бурении в деталь) это убирает россыпь `stableKey`. Параметрические
     * detail-роуты, которым нужен ремаунт на каждый id, помечаются `<Route volatileKey>`.
     * Дефолт `false` → поведение прежнее (key = pathname). `stableKey` всегда приоритетнее.
     */
    keyByMatch?: boolean;
  } = $props();

  const router = useRouter();
  const parent = getContext<RouterContextValue | undefined>(ROUTER_CTX);
  // svelte-ignore state_referenced_locally
  const base = basepath ?? parent?.base ?? '/';

  // Плоский (нереактивный) реестр: <Route> пушат в init ДО того, как ниже отрендерится
  // outlet — поэтому на SSR список полон к моменту pick(). Роуты статичны на инстанс
  // (вложенный <Router> — свежий инстанс), список не мутирует после init.
  const records: RouteRecord[] = [];
  // Монотонный id на инстанс роутера: стабилен per-record, не сбивается при
  // unregister соседей. Под keyByMatch служит transition-key (идентичность роута).
  let recordSeq = 0;
  setContext<RouterContextValue>(ROUTER_CTX, {
    base,
    register: (r) => {
      r._recordId = '#' + recordSeq++;
      records.push(r);
    },
    unregister: (r) => {
      const i = records.indexOf(r);
      if (i >= 0) records.splice(i, 1);
    },
  });

  const localPath = $derived(stripBase(router.pathname, base));
  const active = $derived(pick(records, localPath));
  const params = $derived(active ? matchParams(localPath, active.path) : {});
  // Transition-key: явный stableKey > (keyByMatch ? идентичность выигравшего роута)
  // > pathname. volatileKey возвращает роут на pathname-keying даже под keyByMatch.
  const key = $derived(
    active?.stableKey
      ?? (keyByMatch && active && !active.volatileKey ? active._recordId! : router.pathname),
  );

  // Логический родитель активного роута → модульный сигнал (для router.back()
  // fallback и видимости нативной суперап-кнопки). Резолвим функцию-форму с params.
  $effect(() => {
    const b = active?.back;
    setRouteBack(typeof b === 'function' ? b(params) : (b ?? null));
  });
</script>

{#snippet activeRender()}
  {#if active?.loader}
    <!-- Lazy chunk: render synchronously once cached (no flicker on repeat
         visits / back-forward); otherwise show `loading` while it resolves. -->
    {@const Cached = getCached(active.loader)}
    {#if Cached}
      <Cached {params} {...(active.props ?? {})} />
    {:else}
      {#await load(active.loader)}
        {@render loading?.()}
      {:then Component}
        <Component {params} {...(active.props ?? {})} />
      {:catch}
        {@render error?.()}
      {/await}
    {/if}
  {:else if active?.component}
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

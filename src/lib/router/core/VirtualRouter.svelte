<script lang="ts">
  // Поддерево, которое маршрутизируется по пути из пары `#<hashParam>=<путь>` реального адреса
  // (боковая панель), пока внешнее приложение маршрутизируется по реальному pathname.
  // Вложенные <Router>/useRouter() получают источник пути через ROUTER_LOCATION_CTX;
  // переходы переписывают только эту пару фрагмента и идут через реальный роутер с
  // `origin: hashParam`, чтобы intercept хоста видел, откуда начата навигация.
  import { setContext, type Snippet } from 'svelte';
  import { useRouter } from './useRouter.svelte';
  import { getHistory } from '../history/registry';
  import { parseHashParams, splitUrl, withHashParams } from './hash-params';
  import { ROUTER_LOCATION_CTX, type RouterLocationSource } from './location-source';
  import { ROUTER_CTX, type RouterContextValue } from './context';
  import { setNavigator } from '../../navigation/context';
  import { createNavigatorFromRouter } from '../navigator';

  let {
    hashParam,
    prefix = '',
    children,
  }: {
    /** Ключ пары фрагмента, в которой лежит путь поддерева. */
    hashParam: string;
    /** Префикс, под которым маршруты поддерева объявлены (`/accounts`); во фрагмент не пишется. */
    prefix?: string;
    children: Snippet;
  } = $props();

  // Реальный роутер берём ДО setContext — иначе useRouter() увидел бы собственный источник.
  const real = useRouter();
  let routeBack = $state<string | null>(null);

  /** Значение пары (путь без префикса) → полный виртуальный путь: пусто → `prefix || '/'`
   *  без хвостового слэша, путь без ведущего `/` его получает. */
  function virtualLocation(value: string | undefined): { pathname: string; search: string } {
    const { pathname, search } = splitUrl(value ?? '');
    const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return { pathname: path === '/' ? prefix || '/' : prefix + path, search };
  }

  const current = $derived.by(() => ({
    ...virtualLocation(parseHashParams(real.current.hash)[hashParam]),
    hash: '',
    action: real.current.action,
  }));

  function stripPrefix(url: string): string {
    if (!prefix || !url.startsWith(prefix)) return url;
    const rest = url.slice(prefix.length);
    if (rest === '') return '/';
    if (rest.startsWith('/') || rest.startsWith('?')) return rest;
    return url;
  }

  function resolveHref(url: string): string {
    const { pathname, search, hash } = real.current;
    return withHashParams(pathname + search + hash, { [hashParam]: stripPrefix(url) });
  }

  // scopedTo — то, что запросило поддерево, полным виртуальным путём: хост в intercept
  // отличает такой переход от сырого и может отправить его на главный экран.
  function scopedTo(url: string): string {
    const { pathname, search } = virtualLocation(stripPrefix(url));
    return pathname + search;
  }

  const source: RouterLocationSource = {
    get current() {
      return current;
    },
    push(url, opts) {
      real.push(resolveHref(url), { ...opts, origin: hashParam, scopedTo: scopedTo(url) });
    },
    replace(url, opts) {
      real.replace(resolveHref(url), { ...opts, origin: hashParam, scopedTo: scopedTo(url) });
    },
    back(href) {
      if (getHistory().canGoBack) {
        getHistory().goBack();
        return;
      }
      const target = href ?? routeBack;
      if (target) source.replace(target, { action: 'back' });
    },
    goBack() {
      source.back();
    },
    get currentHasParent() {
      return getHistory().canGoBack || routeBack != null;
    },
    setRouteBack(v) {
      routeBack = v;
    },
    resolveHref,
  };

  setContext(ROUTER_LOCATION_CTX, source);
  // Kit-компоненты поддерева (Navigator) ходят через виртуальный роутер: useRouter() здесь
  // уже видит собственный источник.
  setNavigator(createNavigatorFromRouter(useRouter()));
  // Отрезаем base внешнего <Router>: путь поддерева — свой, вложенный <Router> без basepath
  // начинает от '/'. Сам VirtualRouter роутов не держит — регистрация в пустоту.
  setContext<RouterContextValue>(ROUTER_CTX, { base: '/', register: () => {}, unregister: () => {} });
</script>

<div data-router-scope={hashParam} class="contents">{@render children()}</div>

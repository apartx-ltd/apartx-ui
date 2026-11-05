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

  const current = $derived.by(() => {
    const value = parseHashParams(real.current.hash)[hashParam];
    const parts = value ? splitUrl(value) : null;
    return {
      pathname: prefix + (parts?.pathname || '/'),
      search: parts?.search ?? '',
      hash: '',
      action: real.current.action,
    };
  });

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

  const source: RouterLocationSource = {
    get current() {
      return current;
    },
    push(url, opts) {
      real.push(resolveHref(url), { ...opts, origin: hashParam });
    },
    replace(url, opts) {
      real.replace(resolveHref(url), { ...opts, origin: hashParam });
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
</script>

<div data-router-scope={hashParam} class="contents">{@render children()}</div>

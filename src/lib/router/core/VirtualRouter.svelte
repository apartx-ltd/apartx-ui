<script lang="ts">
  // Поддерево, которое маршрутизируется по пути из пары `#<hashParam>=<путь>` реального адреса
  // (боковая панель), пока внешнее приложение маршрутизируется по реальному pathname.
  // Вложенные <Router>/useRouter() получают источник пути через ROUTER_LOCATION_CTX;
  // переходы переписывают только эту пару фрагмента и идут через реальный роутер с
  // `origin: hashParam`, чтобы intercept хоста видел, откуда начата навигация.
  import { onDestroy, setContext, type Snippet } from 'svelte';
  import { useRouter } from './useRouter.svelte';
  import { getHistory } from '../history/registry';
  import { parseHashParams, splitUrl, withHashParams } from './hash-params';
  import { ROUTER_LOCATION_CTX, type RouterLocationSource } from './location-source';
  import { ROUTER_CTX, type RouterContextValue } from './context';
  import { ensurePanelJournal } from './panel-journal';
  import { setBackVisibility, setNavigator, setRouteKey } from '../../navigation/context';
  import { createNavigatorFromRouter } from '../navigator';

  let {
    hashParam,
    prefix = '',
    backAtRoot = 'show',
    children,
  }: {
    /** Ключ пары фрагмента, в которой лежит путь поддерева. */
    hashParam: string;
    /** Префикс, под которым маршруты поддерева объявлены (`/accounts`); во фрагмент не пишется. */
    prefix?: string;
    /** `'hide'` — поддерево получает геттер видимости «назад» (= currentHasParent):
     *  кнопка «назад» тулбара хоста прячется, пока возвращаться некуда. */
    backAtRoot?: 'show' | 'hide';
    children: Snippet;
  } = $props();

  // Реальный роутер берём ДО setContext — иначе useRouter() увидел бы собственный источник.
  const real = useRouter();
  let routeBack = $state<string | null>(null);

  // Журнал истории по hashParam (модульный, живёт дольше компонента). Позицию зеркалим в
  // $state, чтобы currentHasParent был реактивен.
  const journal = ensurePanelJournal(hashParam);
  let position = $state(journal.position);
  onDestroy(journal.subscribe(() => { position = journal.position; }));

  /** Предыдущая запись истории — шаг этой же панели на том же главном экране: тогда «назад»
   *  панели = «назад» браузера. Адаптер без position — прежнее правило: любая запись истории.
   *  Неизвестная запись (оверлей, перезагрузка) — не шаг панели. */
  const prevInJournal = $derived.by(() => {
    if (position === -1) return true;
    const prev = journal.get(position - 1);
    const { pathname, search } = real.current;
    return !!prev && prev.main === pathname + search && prev.value !== undefined;
  });
  // canGoBack адаптера не реактивен — читаем его на каждый вызов, а не кэшируем в $derived;
  // реактивность (position, real.current, routeBack) потребитель получает через чтение $state.
  const prevIsPanelStep = () => getHistory().canGoBack && prevInJournal;
  const currentHasParent = () => prevIsPanelStep() || routeBack != null;

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
    // Адрес вне префикса поддерево не «достраивает»: цель — он сам.
    if (prefix && stripPrefix(url) === url && !url.startsWith(prefix)) {
      const { pathname, search } = splitUrl(url);
      return pathname + search;
    }
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
      if (prevIsPanelStep()) {
        getHistory().goBack();
        return;
      }
      // <Route back> таблицы панели знает родителя внутри панели; href страницы — её запасной
      // адрес на главном экране, поэтому routeBack главнее.
      const target = routeBack ?? href;
      if (target) source.replace(target, { action: 'back' });
    },
    goBack() {
      source.back();
    },
    get currentHasParent() {
      return currentHasParent();
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
  // <Content> поддерева запоминает скролл по виртуальному пути, а не по pathname главного экрана.
  setRouteKey(() => current.pathname);
  if (backAtRoot === 'hide') setBackVisibility(currentHasParent);
  // Отрезаем base внешнего <Router>: путь поддерева — свой, вложенный <Router> без basepath
  // начинает от '/'. Сам VirtualRouter роутов не держит — регистрация в пустоту.
  setContext<RouterContextValue>(ROUTER_CTX, { base: '/', register: () => {}, unregister: () => {} });
</script>

<div data-router-scope={hashParam} class="contents">{@render children()}</div>

<script lang="ts">
  // Модалка статьи базы знаний: <iframe> на embed-роут apartx-help. Общая для консьюмеров
  // (кабинет — реестр модалок под id 'article', spaces — тот же реестр). Хром модалки отдан
  // хелпу (embed мини-хелп, план docs/plans/2026-08-19-embed-mini-help в оркестраторе):
  // крестик и back-чип рисует iframe. Мост — postMessage:
  //   iframe → host: help:ready, help:stack {depth}, help:close;
  //   host → iframe: help:back (нативный back при depth > 0, через onBackRequest Dialog).
  // Механика кадра (фильтр origin по src, лоадер до help:ready, таймаут, ретрай с
  // пересозданием кадра) — <EmbedFrame>; здесь только URL и протокол. help:ready —
  // единственный честный сигнал: событие load у iframe срабатывает и на 5xx хелпа, и на
  // страницу «нет сети». help:ready значит «фрейм гидратировался», не «статья найдена» —
  // «не найдено» рисует сам embed.
  //
  // Консьюмер отдаёт helpUrl, язык и подписи; `close` — из реестра модалок (ModalOutlet),
  // зовётся после анимации закрытия (onDidDismiss).
  import Dialog from '../ui/overlays/Dialog.svelte';
  import Button from '../ui/display/Button.svelte';
  import EmbedFrame from '../ui/display/EmbedFrame.svelte';
  import Icon from '../ui/display/Icon.svelte';
  import Loading from '../ui/display/Loading.svelte';
  import type { EmbedFrameStatus } from '../ui/display/embed-frame';
  import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';

  let {
    articleId = null,
    helpUrl,
    lang = 'en',
    insetTop = undefined,
    labels = {},
    close,
  }: {
    /** slug или _id статьи — embed-роут хелпа принимает оба. */
    articleId?: string | null;
    /** Origin сайта справки, например https://help.apartx.co. */
    helpUrl: string;
    lang?: string;
    /**
     * Высота статус-бара (Cordova): iframe не видит ни env(), ни CSS-переменных хоста, поэтому
     * уезжает параметром — лейаут embed-хелпа отбивает свой хром сам. По умолчанию читается
     * из --safe-area-inset-top при открытии (на вебе переменная пуста → 0).
     */
    insetTop?: number;
    labels?: { title?: string; loadFailed?: string; retry?: string; close?: string };
    close: () => void;
  } = $props();

  let open = $state(true);
  let status = $state<EmbedFrameStatus>('loading');
  let depth = $state(0);
  let frame = $state<ReturnType<typeof EmbedFrame> | null>(null);

  // Меньше 10с нельзя: мобильная сеть плюс холодный SSR хелпа с деревом категорий.
  const HANDSHAKE_TIMEOUT_MS = 10000;

  // Мобилка — fullscreen-шит, десктоп — большой центрированный диалог.
  let isMobile = $state(false);
  $effect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    isMobile = mq.matches;
    const onChange = (e: MediaQueryListEvent) => { isMobile = e.matches; };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });

  const isReady = (data: any) => data?.type === 'help:ready';

  function onMessage(data: any) {
    if (data?.type === 'help:stack') depth = Number(data?.depth) || 0;
    if (data?.type === 'help:close') onClose();
  }

  // Нативный back: depth > 0 → съесть (Dialog вернёт синтетическую запись) и раскрутить
  // стек хелпа; пустой стек или нет рукопожатия → штатное закрытие. Решение синхронное
  // по закэшированной глубине — без запроса в iframe в момент back.
  function onBackRequest() {
    if (status !== 'ready' || depth === 0) return false;
    frame?.post({ type: 'help:back' });
    return true;
  }

  // Читается при открытии: компонент живёт от open до close.
  const resolvedInsetTop =
    insetTop ??
    Math.round(
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top')) || 0,
    );

  const articleUrl = $derived.by(() => {
    if (!articleId) return null;
    const url = new URL(`/embed/article/${articleId}?lang=${lang}`, helpUrl);
    if (resolvedInsetTop > 0) url.searchParams.set('insetTop', String(resolvedInsetTop));
    return url.toString();
  });

  function onClose() {
    open = false; // teardown via onDidDismiss
  }
</script>

<!-- layout="flush": весь хром внутри фрейма, тело диалога отступов не даёт. contentClass
     перебивает max-w-lg/max-h-[85vh] Dialog тем же tailwind-merge в cn. -->
<Dialog
  bind:open
  showCloseButton={false}
  layout="flush"
  fullScreen={isMobile}
  contentClass={isMobile ? '' : 'max-w-3xl w-full h-[90vh] max-h-[90vh]'}
  {onBackRequest}
  onDidDismiss={() => close()}
>
  {#if articleId}
    <!-- class article-iframe — хук локаторов e2e консьюмеров, не стиль. -->
    <EmbedFrame
      bind:this={frame}
      src={articleUrl}
      {isReady}
      {onMessage}
      onStatusChange={(s) => (status = s)}
      timeoutMs={HANDSHAKE_TIMEOUT_MS}
      class="article-iframe"
      title={labels.title ?? 'Knowledge Base'}
      allowfullscreen
    >
      {#snippet loading()}
        <Loading data-testid="article-modal-loading" class="h-full" />
      {/snippet}
      {#snippet timeout({ retry })}
        <div
          class="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
          data-testid="article-modal-error"
        >
          <Icon icon={faCircleExclamation} size="2x" class="text-error" />
          <p class="text-body-lg text-on-surface">
            {labels.loadFailed ?? 'Help center is not responding. Check your connection and try again'}
          </p>
          <div class="flex gap-2">
            <Button data-testid="article-modal-retry" onclick={retry}>{labels.retry ?? 'Retry'}</Button>
            <Button data-testid="article-modal-close" variant="text" onclick={onClose}>{labels.close ?? 'Close'}</Button>
          </div>
        </div>
      {/snippet}
    </EmbedFrame>
  {/if}
</Dialog>

<script lang="ts">
  // Хост чужого документа: iframe + рукопожатие postMessage. Общая механика трёх хостов
  // (хелп в кабинете, виджет верификации в кабинете и spaces), у которых различаются только
  // URL, протокол и текст ошибки:
  //   - origin для фильтра входящих берётся из src; чужие сообщения отбрасываются до
  //     предиката и до onMessage;
  //   - слушатель вешается при монтировании, документ кадра грузится позже — первое
  //     «готов» не теряется; «готов» после таймаута снимает состояние таймаута сам;
  //   - непрозрачный слой поверх кадра до рукопожатия (event load у iframe врёт: срабатывает
  //     и на 5xx, и на «нет сети»); кадр под слоем не пересоздаётся;
  //   - retry() пересоздаёт кадр через {#key}: старое окно уничтожается вместе с ним,
  //     запоздалого «готов» от него быть не может;
  //   - `class` и остальные атрибуты уезжают на <iframe> (в том числе testid — сканер
  //     кабинета принимает элемент со спредом); testid лоадера/ошибки — в снипетах.
  // Слой отбивается сверху --safe-area-inset-top: во fullscreen-шите это кромка статус-бара,
  // центрированный Dialog зануляет переменную для поддерева.
  import { untrack, type Snippet } from 'svelte';
  import type { HTMLIframeAttributes } from 'svelte/elements';
  import { cn } from '../utils/cn';
  import Loading from './Loading.svelte';
  import { originOf, type EmbedFrameStatus, type EmbedFramePost } from './embed-frame';

  let {
    src = null,
    isReady,
    onMessage = undefined,
    onStatusChange = undefined,
    timeoutMs = 10000,
    class: className = undefined,
    loading = undefined,
    timeout = undefined,
    ...rest
  }: Omit<HTMLIframeAttributes, 'src'> & {
    /** null — хост ещё добывает URL: кадра нет, стоит лоадер (таймаут не тикает). */
    src?: string | null;
    /** Предикат рукопожатия по e.data. */
    isReady: (data: unknown) => boolean;
    /** Доменные сообщения (уже отфильтрованы по origin, «готов» сюда не попадает). */
    onMessage?: (data: unknown, post: EmbedFramePost) => void;
    onStatusChange?: (status: EmbedFrameStatus) => void;
    /** 0 — без таймаута. */
    timeoutMs?: number;
    loading?: Snippet;
    timeout?: Snippet<[{ retry: () => void }]>;
  } = $props();

  let status = $state<EmbedFrameStatus>('loading');
  let attempt = $state(0);
  let iframeEl = $state<HTMLIFrameElement | null>(null);
  const origin = $derived(originOf(src));

  function setStatus(next: EmbedFrameStatus) {
    if (status === next) return;
    status = next;
    onStatusChange?.(next);
  }

  export function retry() {
    attempt += 1;
    setStatus('loading');
  }

  export function post(message: unknown) {
    if (!origin) return;
    iframeEl?.contentWindow?.postMessage(message, origin);
  }

  // Новый src — новый документ, рукопожатие заново. untrack обязателен: setStatus ЧИТАЕТ
  // status (сравнение с next), поэтому без него эффект подписывается на статус и откатывает
  // в 'loading' каждый переход в 'ready'/'timeout' — кадр навсегда оставался бы под лоадером.
  $effect(() => {
    void src;
    untrack(() => setStatus('loading'));
  });

  // Таймаут тикает только пока есть что ждать: кадр существует и рукопожатия нет.
  $effect(() => {
    if (status !== 'loading' || !src || !timeoutMs) return;
    void attempt;
    const timer = setTimeout(() => setStatus('timeout'), timeoutMs);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    const onWindowMessage = (event: MessageEvent) => {
      if (!origin || event.origin !== origin) return;
      if (isReady(event.data)) {
        setStatus('ready');
        return;
      }
      onMessage?.(event.data, post);
    };
    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  });
</script>

<div class="relative flex h-full w-full flex-1 min-h-0">
  {#if src}
    {#key attempt}
      <!-- block: у инлайнового iframe под рамкой остаётся baseline-щель. -->
      <iframe bind:this={iframeEl} {src} class={cn('block h-full w-full flex-1 border-none', className)} {...rest}></iframe>
    {/key}
  {/if}
  {#if status !== 'ready'}
    <div class="absolute inset-0 bg-surface" style="padding-top: var(--safe-area-inset-top, 0px)">
      {#if status === 'timeout' && timeout}
        {@render timeout({ retry })}
      {:else if loading}
        {@render loading()}
      {:else}
        <Loading class="h-full" />
      {/if}
    </div>
  {/if}
</div>

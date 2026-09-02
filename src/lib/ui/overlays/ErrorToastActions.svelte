<script lang="ts">
  // Строка действий тоста ошибки: Почему? · Скопировать · В саппорт.
  // Рисуется как `description`-компонент svelte-sonner (он спредит в неё componentProps).
  // «Почему?» появляется только при попадании — резолв при монтировании, кэш в error-toast.ts.
  // Подтверждение копирования — сменой подписи, а не вложенным тостом.
  import { getToasterHandlers, duckToasterUnderModals, restoreToaster } from './toaster-context.svelte';
  import { getLocale } from '../../i18n/context';
  import { copyText } from '../utils/clipboard';
  import { resolveErrorHelp, buildErrorDetails, type ErrorHelpArticle } from './error-toast';

  let {
    errorKey = null,
    httpCode = null,
    message = '',
    details = undefined,
  }: {
    errorKey?: string | null;
    httpCode?: number | null;
    message?: string;
    details?: unknown;
  } = $props();

  // Геттер, а не снимок: подписи приходят из t() консьюмера и должны переезжать
  // при смене языка на лету (тост может висеть в этот момент).
  const handlersOf = getToasterHandlers();
  const handlers = $derived(handlersOf?.() ?? {});
  const localeOf = getLocale();

  let articles = $state<ErrorHelpArticle[]>([]);
  // Раскрытый список статей. Нужен только при нескольких попаданиях: одна статья
  // открывается сразу, лишний клик ни за чем.
  let listOpen = $state(false);
  // null — обычная подпись, true — «Скопировано», false — «Не скопировалось».
  // Отказ обязан быть виден: молчащая кнопка неотличима от сломанной.
  let copyResult = $state<boolean | null>(null);

  $effect(() => {
    const resolver = handlers.resolveErrorHelp;
    if (!errorKey || !resolver) return;
    let alive = true;
    resolveErrorHelp(errorKey, localeOf?.() || 'en', resolver)
      .then((list) => { if (alive) articles = list; })
      .catch(() => { /* нет связи — тост живёт без кнопки */ });
    return () => { alive = false; };
  });

  const detailsText = () =>
    buildErrorDetails({
      errorKey: errorKey || '',
      message,
      httpCode,
      details,
      path: typeof location !== 'undefined' ? location.pathname : '',
      now: new Date(),
      extra: handlers.detailsContext?.() ?? {},
    });

  /**
   * Статью надо читать, а не разглядывать из-под тоста, поэтому на время её показа хост
   * тостов уходит под слой модалок. Возврат — когда хендлер консьюмера отрезолвится:
   * `Modal.open(...)` отдаёт промис, который резолвится закрытием модалки. Хендлер,
   * который промис не возвращает, просто вернёт тост наверх сразу.
   */
  async function openArticle(article: ErrorHelpArticle) {
    listOpen = false;
    duckToasterUnderModals();
    try {
      await handlers.onOpenArticle?.(article);
    } finally {
      restoreToaster();
    }
  }

  /**
   * По ключу может висеть несколько статей — сервер отдаёт их списком, и молча открывать
   * первую значит выбирать за пользователя вслепую (и невоспроизводимо: порядок задаёт
   * база). Поэтому при нескольких попаданиях «Почему?» раскрывает список прямо в тосте.
   *
   * Именно список в тосте, а не выпадающее меню: тост живёт на самом верхнем слое
   * (`z-index` sonner), а портал меню — на своём, то есть уехал бы ПОД тост, из которого
   * его открыли. Плюс на телефоне стопка ссылок попадаемее меню.
   */
  function why() {
    if (articles.length === 1) return openArticle(articles[0]);
    listOpen = !listOpen;
  }

  async function copy() {
    copyResult = await copyText(detailsText());
    setTimeout(() => { copyResult = null; }, 2000);
  }

  const copyLabel = $derived(
    copyResult === true
      ? (handlers.labels?.copied ?? 'Copied')
      : copyResult === false
        ? (handlers.labels?.copyFailed ?? 'Copy failed')
        : (handlers.labels?.copy ?? 'Copy details'),
  );
</script>

{#if errorKey}
  <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
    {#if articles.length && handlers.onOpenArticle}
      <button
        type="button"
        class="underline underline-offset-2 opacity-80 hover:opacity-100"
        data-testid="error-toast-why"
        aria-expanded={articles.length > 1 ? listOpen : undefined}
        onclick={why}
      >{handlers.labels?.why ?? 'Why?'}</button>
    {/if}
    <button
      type="button"
      class="underline underline-offset-2 opacity-80 hover:opacity-100"
      data-testid="error-toast-copy"
      onclick={copy}
    >{copyLabel}</button>
    {#if handlers.onContactSupport}
      <button
        type="button"
        class="underline underline-offset-2 opacity-80 hover:opacity-100"
        data-testid="error-toast-support"
        onclick={() => handlers.onContactSupport?.(detailsText())}
      >{handlers.labels?.support ?? 'Contact support'}</button>
    {/if}
  </div>
  {#if listOpen && articles.length > 1}
    <ul class="mt-1 flex list-none flex-col gap-1 p-0">
      {#each articles as article (article.slug)}
        <li>
          <button
            type="button"
            class="text-left underline underline-offset-2 opacity-80 hover:opacity-100"
            data-testid="error-toast-article"
            onclick={() => openArticle(article)}
          >{article.title || article.slug}</button>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

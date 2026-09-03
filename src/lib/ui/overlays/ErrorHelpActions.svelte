<script lang="ts">
  // Строка действий ошибки: Почему? · Скопировать · В саппорт. Общая для тоста
  // (<ErrorToastActions>) и ошибки под формой (<InlineError>): хендлеры — из контекста
  // тостера (<ToasterMount>), «Почему?» появляется только при попадании (резолв при
  // монтировании, кэш в error-toast.ts), подтверждение копирования — сменой подписи.
  // Слой для меню статей НЕ задаёт — это дело обёртки: тосту нужна полоса над sonner,
  // форме — та, что уже дал Dialog или страница.
  import { getToasterHandlers } from './toaster-context.svelte';
  import { getLocale } from '../../i18n/context';
  import Popover from '../display/Popover.svelte';
  import { copyText } from '../utils/clipboard';
  import { resolveErrorHelp, buildErrorDetails, errorHelpProps, type ErrorHelpArticle } from './error-toast';

  let {
    error = null,
    openArticle = undefined,
  }: {
    error?: unknown;
    /** Обёртка тоста подменяет: ей надо увести хост тостов под модалки на время статьи. */
    openArticle?: (article: ErrorHelpArticle) => Promise<void> | void;
  } = $props();

  const props = $derived(errorHelpProps(error));

  // Геттер, а не снимок: подписи приходят из t() консьюмера и должны переезжать
  // при смене языка на лету (ошибка может висеть в этот момент).
  const handlersOf = getToasterHandlers();
  const handlers = $derived(handlersOf?.() ?? {});
  const localeOf = getLocale();

  let articles = $state<ErrorHelpArticle[]>([]);
  // Открытое меню статей. Нужно только при нескольких попаданиях: одна статья
  // открывается сразу, лишний клик ни за чем.
  let listOpen = $state(false);
  // null — обычная подпись, true — «Скопировано», false — «Не скопировалось».
  // Отказ обязан быть виден: молчащая кнопка неотличима от сломанной.
  let copyResult = $state<boolean | null>(null);

  $effect(() => {
    const resolver = handlers.resolveErrorHelp;
    const key = props.errorKey;
    if (!key || !resolver) return;
    let alive = true;
    resolveErrorHelp(key, localeOf?.() || 'en', resolver)
      .then((list) => { if (alive) articles = list; })
      .catch(() => { /* нет связи — строка живёт без «Почему?» */ });
    return () => { alive = false; };
  });

  const detailsText = () =>
    buildErrorDetails({
      errorKey: props.errorKey || '',
      message: props.message,
      httpCode: props.httpCode,
      details: props.details,
      path: typeof location !== 'undefined' ? location.pathname : '',
      now: new Date(),
      extra: handlers.detailsContext?.() ?? {},
    });

  async function open(article: ErrorHelpArticle) {
    listOpen = false;
    if (openArticle) return openArticle(article);
    await handlers.onOpenArticle?.(article);
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

{#if props.errorKey}
  <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
    {#if articles.length > 1 && handlers.onOpenArticle}
      <!-- Несколько статей по одному ключу — выбирает человек. Молча открывать первую
           значит выбирать вслепую и невоспроизводимо: порядок задаёт база, и привязка
           второй статьи из админки тихо меняла бы, что откроется. Меню, а не список
           внутри тоста: тост — узкая полоска, стопка заголовков её распирает. -->
      <Popover
        bind:open={listOpen}
        modal
        align="start"
        triggerClass="underline underline-offset-2 opacity-80 hover:opacity-100"
        contentClass="pointer-events-auto min-w-56 max-w-[min(20rem,calc(100vw-2rem))] p-1"
      >
        {#snippet trigger()}<span data-testid="error-toast-why">{handlers.labels?.why ?? 'Why?'}</span>{/snippet}
        <ul class="m-0 flex list-none flex-col p-0">
          {#each articles as article (article.slug)}
            <li>
              <button
                type="button"
                class="w-full rounded-xs px-3 py-2 text-left text-body-medium text-on-surface hover:bg-surface-container-high"
                data-testid="error-toast-article"
                onclick={() => open(article)}
              >{article.title || article.slug}</button>
            </li>
          {/each}
        </ul>
      </Popover>
    {:else if articles.length === 1 && handlers.onOpenArticle}
      <button
        type="button"
        class="underline underline-offset-2 opacity-80 hover:opacity-100"
        data-testid="error-toast-why"
        onclick={() => open(articles[0])}
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
{/if}

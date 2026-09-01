<script lang="ts">
  // Строка действий тоста ошибки: Почему? · Скопировать · В саппорт.
  // Рисуется как `description`-компонент svelte-sonner (он спредит в неё componentProps).
  // «Почему?» появляется только при попадании — резолв при монтировании, кэш в error-toast.ts.
  // Подтверждение копирования — сменой подписи, а не вложенным тостом.
  import { getToasterHandlers } from './toaster-context';
  import { getLocale } from '../../i18n/context';
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
  let copied = $state(false);

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

  async function copy() {
    try {
      await navigator.clipboard.writeText(detailsText());
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch { /* clipboard недоступен (не-secure context) — молча */ }
  }
</script>

{#if errorKey}
  <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
    {#if articles.length && handlers.onOpenArticle}
      <button
        type="button"
        class="underline underline-offset-2 opacity-80 hover:opacity-100"
        data-testid="error-toast-why"
        onclick={() => handlers.onOpenArticle?.(articles[0])}
      >{handlers.labels?.why ?? 'Why?'}</button>
    {/if}
    <button
      type="button"
      class="underline underline-offset-2 opacity-80 hover:opacity-100"
      data-testid="error-toast-copy"
      onclick={copy}
    >{copied ? (handlers.labels?.copied ?? 'Copied') : (handlers.labels?.copy ?? 'Copy details')}</button>
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

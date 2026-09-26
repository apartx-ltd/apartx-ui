<script lang="ts">
  // Полноэкранная читалка HTML-документа: шапка (назад, заголовок, действия хоста, кнопка
  // скачивания) и тело под {@html}. Презентационный: данные, их загрузку, кэш и перезапрос
  // ведёт хост (TanStack) и передаёт html/loading/error/onretry. Кит НЕ санитизирует и НЕ
  // парсит markdown — `html` обязан быть доверенным, очищенным на сервере. Подписи приходят
  // строками: у кита нет i18n. Что за документ (договор, оферта, счёт) — знает хост.
  // Единственное своё состояние — спиннер и блокировка кнопки скачивания на время промиса.
  import Dialog from './Dialog.svelte';
  import Button from '../display/Button.svelte';
  import Icon from '../display/Icon.svelte';
  import Loading from '../display/Loading.svelte';
  import Header from '../structure/Header.svelte';
  import Toolbar from '../structure/Toolbar.svelte';
  import Title from '../structure/Title.svelte';
  import BackButton from '../structure/BackButton.svelte';
  import { faDownload } from '@fortawesome/free-solid-svg-icons';

  let {
    open = $bindable(false),
    title = '',
    html = '',
    loading = false,
    error = false,
    onretry,
    ondownload,
    downloadLabel = 'Download',
    retryLabel = 'Retry',
    errorText = 'Failed to load the document',
    onclose,
    actions,
    ...restProps
  }: {
    open?: boolean;
    title?: string;
    /** Доверенный (уже санитизированный) HTML документа. */
    html?: string;
    /** Тело — спиннер. Приоритет над `error` и `html`. */
    loading?: boolean;
    /** Тело — `errorText` + кнопка «Повторить». */
    error?: boolean;
    onretry?: () => void;
    /** Если передан — в шапке кнопка скачивания; на время промиса кнопка в `loading`. */
    ondownload?: () => Promise<void>;
    downloadLabel?: string;
    retryLabel?: string;
    errorText?: string;
    onclose?: () => void;
    /** Кнопки хоста в шапке слева от скачивания (язык и т.п.). */
    actions?: any;
    [key: string]: any;
  } = $props();

  let downloading = $state(false);

  async function download() {
    if (!ondownload || downloading) return;
    downloading = true;
    try {
      await ondownload();
    } finally {
      downloading = false;
    }
  }
</script>

<Dialog bind:open fullScreen showCloseButton={false} layout="form" {onclose} data-testid="document-dialog" {...restProps}>
  {#snippet header()}
    <Header>
      <Toolbar>
        {#snippet start()}
          <BackButton onclick={() => (open = false)} aria-label="Back" />
        {/snippet}
        <Title>{title}</Title>
        {#snippet end()}
          {@render actions?.()}
          {#if ondownload}
            <Button variant="icon" data-testid="document-dialog-download" aria-label={downloadLabel} loading={downloading} onclick={download}>
              <Icon icon={faDownload} />
            </Button>
          {/if}
        {/snippet}
      </Toolbar>
    </Header>
  {/snippet}

  {#if loading}
    <Loading />
  {:else if error}
    <div class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center" data-testid="document-dialog-error">
      <p class="text-body-md text-error">{errorText}</p>
      <Button variant="tonal" data-testid="document-dialog-retry" onclick={() => onretry?.()}>{retryLabel}</Button>
    </div>
  {:else}
    <div class="document-prose text-body-md text-on-surface" data-testid="document-dialog-body">
      {@html html}
    </div>
  {/if}
</Dialog>

<style>
  /* Типографика документа: шаблоны — markdown с inline HTML (заголовки, таблицы, списки). */
  .document-prose :global(a) { color: var(--md-sys-color-primary, #0061a4); }
  .document-prose :global(h1), .document-prose :global(h2), .document-prose :global(h3),
  .document-prose :global(h4), .document-prose :global(h5) { margin: 1em 0 0.5em; font-weight: 600; }
  .document-prose :global(h1) { font-size: 1.5em; }
  .document-prose :global(h2) { font-size: 1.25em; }
  .document-prose :global(p) { margin: 0 0 0.75em; }
  .document-prose :global(ol), .document-prose :global(ul) { padding-inline-start: 1.25rem; margin: 0 0 0.75em; }
  .document-prose :global(table) { width: 100%; border-collapse: collapse; margin: 0 0 0.75em; }
  .document-prose :global(td), .document-prose :global(th) {
    border: 1px solid var(--md-sys-color-outline-variant, #ccc);
    padding: 0.25rem 0.5rem;
    vertical-align: top;
  }
  .document-prose :global(hr) { margin: 1em 0; border-color: var(--md-sys-color-outline-variant, #ccc); }
</style>

<script lang="ts">
  // Тело тоста «уведомления заблокированы» (createPushPermissionPrompt) — рисуется как
  // description-компонент svelte-sonner, он спредит сюда componentProps.
  //
  // Инструкция «как включить уведомления» — статья базы знаний по ключу платформы
  // (pushGuideKey), тем же путём, что «Почему?» у тоста ошибки: резолв через хендлеры
  // <ToasterMount>, открытие через onOpenArticle. Гифку внутри тоста раскрывать нельзя:
  // sonner меряет высоту тоста один раз при показе, выросшее содержимое вылезало за рамку и
  // накрывало переключатель. На время статьи хост тостов ныряет под слой модалок — иначе
  // тост (z 999999999) лёг бы поверх неё.
  import { onDestroy } from 'svelte';
  import Button from '../display/Button.svelte';
  import { getLocale } from '../../i18n/context';
  import {
    getToasterHandlers,
    duckToasterUnderModals,
    restoreToaster,
  } from './toaster-context.svelte';
  import { resolveErrorHelp, type ErrorHelpArticle } from './error-toast';

  let {
    text,
    instructionsLabel = 'Instructions',
    guideKey = null,
  }: { text: string; instructionsLabel?: string; guideKey?: string | null } = $props();

  const handlersOf = getToasterHandlers();
  const handlers = $derived(handlersOf?.() ?? {});
  const localeOf = getLocale();

  let article = $state<ErrorHelpArticle | null>(null);
  let opened = false;

  $effect(() => {
    const resolver = handlers.resolveErrorHelp;
    if (!guideKey || !resolver) return;
    let alive = true;
    resolveErrorHelp(guideKey, localeOf?.() || 'en', resolver)
      // Ключи по платформе уникальны by design — первая статья и есть инструкция.
      .then((list) => { if (alive) article = list[0] ?? null; })
      .catch(() => { /* нет связи — тост живёт без кнопки */ });
    return () => { alive = false; };
  });

  async function openGuide() {
    if (!article) return;
    opened = true;
    duckToasterUnderModals();
    try {
      await handlers.onOpenArticle?.(article);
    } finally {
      opened = false;
      restoreToaster();
    }
  }

  // Тост убрали при открытой статье (выдали разрешение, stop) — хост возвращаем наверх.
  onDestroy(() => {
    if (opened) restoreToaster();
  });
</script>

<div>{text}</div>
{#if article && handlers.onOpenArticle}
  <Button variant="text" size="sm" class="mt-1 -ml-3" data-testid="push-permission-guide" onclick={openGuide}>
    {instructionsLabel}
  </Button>
{/if}

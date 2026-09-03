<script lang="ts">
  // Строка действий тоста ошибки. Рисуется как `description`-компонент svelte-sonner (он
  // спредит в неё componentProps — здесь это один `error`). Сама строка — в
  // <ErrorHelpActions>; тут только то, что нужно именно тосту:
  //  * меню статей портируется в <body> и без явной полосы легло бы ПОД тост (у sonner
  //    z-index 999999999) — публикуем потомкам полосу хоста тостов через provideOverlayZ;
  //  * статью надо читать, а не разглядывать из-под тоста — на время её показа хост
  //    ныряет под слой модалок и возвращается, когда хендлер консьюмера отрезолвится
  //    (`Modal.open(...)` отдаёт промис закрытия; хендлер без промиса вернёт тост сразу).
  import {
    getToasterHandlers,
    duckToasterUnderModals,
    restoreToaster,
    toasterZ,
  } from './toaster-context.svelte';
  import { provideOverlayZ } from './layer-context';
  import ErrorHelpActions from './ErrorHelpActions.svelte';
  import type { ErrorHelpArticle } from './error-toast';

  let { error = null }: { error?: unknown } = $props();

  provideOverlayZ(() => toasterZ());

  const handlersOf = getToasterHandlers();

  async function openArticle(article: ErrorHelpArticle) {
    duckToasterUnderModals();
    try {
      await handlersOf?.().onOpenArticle?.(article);
    } finally {
      restoreToaster();
    }
  }
</script>

<ErrorHelpActions {error} {openArticle} />

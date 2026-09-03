<script lang="ts">
  // Тестовый хост: то, чем в приложении является <ToasterMount> (контекст хендлеров) плюс
  // сам <InlineError> под ним. Только для inline-error.svelte.test.ts.
  import { setToasterHandlers, type ToasterHandlers } from '../toaster-context.svelte';
  import InlineError from '../InlineError.svelte';

  let { handlers, error = null, text = '' }: { handlers?: ToasterHandlers; error?: unknown; text?: string } = $props();
  if (handlers) setToasterHandlers(() => handlers);
</script>

<!-- Слот только при непустом тексте — как у формы с её {#if error}. -->
{#if text}
  <InlineError {error} data-testid="inline">{text}</InlineError>
{:else}
  <InlineError {error} data-testid="inline" />
{/if}

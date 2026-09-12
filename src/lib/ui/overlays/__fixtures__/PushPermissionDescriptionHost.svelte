<script lang="ts">
  // Тестовый хост: контекст хендлеров (то, что в приложении ставит <ToasterMount>) плюс
  // само тело тоста. Только для push-permission-description.svelte.test.ts.
  import { setToasterHandlers, type ToasterHandlers } from '../toaster-context.svelte';
  import PushPermissionDescription from '../PushPermissionDescription.svelte';

  let {
    handlers,
    text = 'Blocked',
    guideKey = null,
  }: { handlers?: ToasterHandlers; text?: string; guideKey?: string | null } = $props();
  if (handlers) setToasterHandlers(() => handlers);
</script>

<PushPermissionDescription {text} {guideKey} instructionsLabel="Instructions" />

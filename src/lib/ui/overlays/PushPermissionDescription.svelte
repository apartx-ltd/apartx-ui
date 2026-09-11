<script lang="ts">
  // Тело тоста «уведомления заблокированы» (createPushPermissionPrompt) — рисуется как
  // description-компонент svelte-sonner, он спредит сюда componentProps. Под текстом —
  // раскрывающаяся гифка-инструкция, как включить уведомления на этом устройстве.
  import Accordion from '../display/Accordion.svelte';
  import AccordionItem from '../display/AccordionItem.svelte';
  import Image from '../display/Image.svelte';
  import type { PushGuide } from './push-permission';

  let {
    text,
    instructionsLabel = 'Instructions',
    guide = null,
  }: { text: string; instructionsLabel?: string; guide?: PushGuide | null } = $props();
</script>

<div>{text}</div>
{#if guide}
  <Accordion class="mt-2">
    <AccordionItem value="guide" title={instructionsLabel}>
      <Image src={guide.src} ratio={guide.ratio} fit="contain" loading="eager" />
    </AccordionItem>
  </Accordion>
{/if}

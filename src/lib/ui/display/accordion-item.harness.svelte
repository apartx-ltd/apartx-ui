<script>
  // AccordionItem живёт только внутри Accordion (контекст bits-ui) — тест монтирует пару.
  import Accordion from './Accordion.svelte';
  import AccordionItem from './AccordionItem.svelte';

  let { error } = $props();
</script>

<Accordion type="single">
  <AccordionItem value="one" title="Photos" {error}>Body</AccordionItem>
</Accordion>

<script>
  // AccordionItem живёт только внутри Accordion (контекст bits-ui) — тест монтирует пару.
  import Accordion from './Accordion.svelte';
  import AccordionItem from './AccordionItem.svelte';

  let { error, withSlots = false, snippetTitle = false } = $props();
</script>

{#snippet start()}<i data-testid="slot-start">S</i>{/snippet}
{#snippet end()}<b data-testid="slot-end">3</b>{/snippet}
{#snippet richTitle()}<span data-testid="slot-title">Photos <small>of the property</small></span>{/snippet}

<Accordion type="single">
  <AccordionItem
    value="one"
    title={snippetTitle ? richTitle : 'Photos'}
    start={withSlots ? start : undefined}
    end={withSlots ? end : undefined}
    {error}
  >Body</AccordionItem>
</Accordion>

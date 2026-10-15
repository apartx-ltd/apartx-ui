<script>
  // AccordionItem живёт только внутри Accordion (контекст bits-ui) — тест монтирует пару.
  import Accordion from './Accordion.svelte';
  import AccordionItem from './AccordionItem.svelte';

  let { error, withSlots = false, snippetTitle = false, subtitle = undefined, expandable = true, nested = false } = $props();
</script>

{#if nested}
  <!-- Раскрытая внешняя секция со свёрнутой вложенной: шеврон каждой — только про себя. -->
  <Accordion value={['outer']}>
    <AccordionItem value="outer" title="Outer" data-testid="outer">
      <Accordion>
        <AccordionItem value="inner" title="Inner" data-testid="inner">Inner body</AccordionItem>
      </Accordion>
    </AccordionItem>
  </Accordion>
{/if}

{#snippet start()}<i data-testid="slot-start">S</i>{/snippet}
{#snippet end()}<b data-testid="slot-end">3</b>{/snippet}
{#snippet richTitle()}<span data-testid="slot-title">Photos <small>of the property</small></span>{/snippet}

{#if !nested}
  <Accordion type="single">
    <AccordionItem
      value="one"
      title={snippetTitle ? richTitle : 'Photos'}
      start={withSlots ? start : undefined}
      end={withSlots ? end : undefined}
      {error}
      {subtitle}
      {expandable}
    >Body</AccordionItem>
  </Accordion>
{/if}

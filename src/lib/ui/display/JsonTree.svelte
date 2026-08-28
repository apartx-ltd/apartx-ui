<script>
  import { cn } from '../utils/cn';
  import JsonNode from './JsonNode.svelte';
  import { getJsonLinkResolver } from './json-link';

  let { value, expandDepth = 2, linkResolver = undefined, class: className } = $props();

  // Контекст читается при инициализации; проп — точечный оверрайд поверх него.
  const contextResolver = getJsonLinkResolver();
  let resolver = $derived(linkResolver ?? contextResolver);
</script>

<div class={cn('bg-[#272822] text-[#f8f8f2] font-mono text-label-sm leading-5 p-3 overflow-auto', className)}>
  <JsonNode {value} keyLabel={null} parent={null} depth={0} {expandDepth} linkResolver={resolver} />
</div>

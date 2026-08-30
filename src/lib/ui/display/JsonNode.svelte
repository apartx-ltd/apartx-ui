<script>
  import JsonNode from './JsonNode.svelte';
  import Link from './Link.svelte';
  import Icon from './Icon.svelte';
  import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
  import { classifyValue } from './json-value';

  let { keyLabel = null, value, depth, expandDepth, linkResolver = undefined, parent = null } = $props();

  const VALUE_CLASS = {
    string: 'text-[#e6db74]',
    number: 'text-[#ae81ff]',
    boolean: 'text-[#ae81ff]',
    null: 'text-white/40 italic',
    undefined: 'text-white/40 italic',
    date: 'text-[#a6e22e]',
    decimal: 'text-[#ae81ff]',
    objectid: 'text-[#66d9ef]',
    regexp: 'text-[#fd971f]',
    function: 'text-white/40 italic',
  };

  let info = $derived(classifyValue(value));
  let isContainer = $derived(info.kind === 'object' || info.kind === 'array');
  let entries = $derived(
    info.kind === 'array' ? value.map((v, i) => [String(i), v])
      : info.kind === 'object' ? Object.entries(value)
      : [],
  );
  let open = $state(depth < expandDepth);
  let href = $derived(
    !isContainer && typeof value === 'string' && keyLabel !== null && parent && linkResolver
      ? linkResolver({ key: keyLabel, value, parent })
      : undefined,
  );
</script>

{#if isContainer && entries.length === 0}
  <div class="ps-3">
    {#if keyLabel !== null}<span class="text-[#f92672]">{keyLabel}</span><span class="text-white/60">: </span>{/if}
    <span class="text-white/60">{info.kind === 'array' ? '[]' : '{}'}</span>
  </div>
{:else if isContainer}
  <div>
    <button type="button" class="inline-flex items-baseline gap-1 cursor-pointer" onclick={() => (open = !open)}>
      <span class="inline-block w-3 text-white/40 transition-transform {open ? 'rotate-90' : ''}">
        <Icon icon={faChevronRight} />
      </span>
      {#if keyLabel !== null}<span><span class="text-[#f92672]">{keyLabel}</span><span class="text-white/60">:</span></span>{/if}
      {#if open}
        <span class="text-white/60">{info.kind === 'array' ? '[' : '{'}</span>
      {:else}
        <span class="text-white/40">{info.kind === 'array' ? `[…] ${entries.length} items` : `{…} ${entries.length} keys`}</span>
      {/if}
    </button>
    {#if open}
      <div class="ps-4 border-s border-white/10">
        {#each entries as [k, v] (k)}
          <JsonNode keyLabel={k} value={v} depth={depth + 1} {expandDepth} {linkResolver} parent={value} />
        {/each}
      </div>
      <span class="ps-3 text-white/60">{info.kind === 'array' ? ']' : '}'}</span>
    {/if}
  </div>
{:else}
  <div class="ps-3">
    {#if keyLabel !== null}<span class="text-[#f92672]">{keyLabel}</span><span class="text-white/60">: </span>{/if}
    {#if href}
      <Link {href} title={info.title} class="text-[#66d9ef] underline decoration-dotted hover:decoration-solid">
        {info.text}
      </Link>
    {:else}
      <span class="{VALUE_CLASS[info.kind]} whitespace-pre-wrap break-words" title={info.title}>{info.text}</span>
    {/if}
  </div>
{/if}

<script lang="ts">
  import TextField from '../ui/forms/TextField.svelte';
  import { cn } from '../ui/utils/cn';
  import { getMapConfig, getProvider } from './context';
  import type { SearchResult } from './providers/types';

  /**
   * Geocoding search box. Debounces input, queries the active provider's
   * `search()`, and lists results; selecting one emits `onSelect(result)`.
   * All user-facing text is a prop with an English default.
   */
  let {
    value = $bindable(''),
    label = '',
    placeholder = 'Search places…',
    debounceMs = 350,
    minLength = 3,
    noResultsText = 'Nothing found',
    onSelect,
    class: className,
  }: {
    value?: string;
    label?: string;
    placeholder?: string;
    debounceMs?: number;
    minLength?: number;
    noResultsText?: string;
    onSelect?: (result: SearchResult) => void;
    class?: string;
  } = $props();

  const cfg = getMapConfig();

  let results = $state<SearchResult[]>([]);
  let open = $state(false);
  let loading = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;

  function onInput() {
    if (timer) clearTimeout(timer);
    const q = value.trim();
    if (q.length < minLength) {
      results = [];
      open = false;
      return;
    }
    timer = setTimeout(runSearch, debounceMs);
  }

  async function runSearch() {
    const provider = getProvider();
    if (!provider.search) return;
    const my = ++seq;
    loading = true;
    open = true;
    try {
      const r = await provider.search(value.trim(), cfg.config);
      if (my === seq) results = r;
    } catch {
      if (my === seq) results = [];
    } finally {
      if (my === seq) loading = false;
    }
  }

  function choose(r: SearchResult) {
    value = r.title;
    open = false;
    results = [];
    onSelect?.(r);
  }
</script>

<div class={cn('relative flex flex-col gap-1', className)}>
  <TextField bind:value {label} {placeholder} oninput={onInput} />

  {#if open}
    <div class="absolute top-full left-0 right-0 z-50 mt-1 rounded-sm bg-surface shadow-level-2 border border-outline-variant overflow-hidden py-1 max-h-64 overflow-y-auto">
      {#if loading}
        <div class="px-3 py-2.5 text-body-md text-on-surface-variant">…</div>
      {:else if results.length === 0}
        <div class="px-3 py-2.5 text-body-md text-on-surface-variant">{noResultsText}</div>
      {:else}
        {#each results as r, i (i)}
          <button
            type="button"
            class="flex flex-col items-start w-full px-3 py-2.5 text-left cursor-pointer hover:bg-on-surface/8 transition-colors"
            onclick={() => choose(r)}
          >
            <span class="text-body-md text-on-surface">{r.title}</span>
            {#if r.subtitle}
              <span class="text-label-sm text-on-surface-variant">{r.subtitle}</span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

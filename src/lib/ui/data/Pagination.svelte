<script>
  import { cn } from '../utils/cn';

  let {
    page = $bindable(0),
    total = 0,
    perPage = 10,
    perPageOptions = [5, 10, 25, 50],
    onPerPageChange,
    class: className,
    ...restProps
  } = $props();

  let totalPages = $derived(Math.ceil(total / perPage));
  let from = $derived(page * perPage + 1);
  let to = $derived(Math.min((page + 1) * perPage, total));

  // Build a compact page list: [0, …, cur-1, cur, cur+1, …, last]
  // Negative numbers are ellipsis sentinels (kept distinct so they don't render as page buttons).
  let pageItems = $derived.by(() => {
    if (totalPages <= 1) return [];
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const last = totalPages - 1;
    let start = Math.max(1, page - 1);
    let end = Math.min(last - 1, page + 1);
    if (page <= 2) end = 3;
    if (page >= last - 2) start = last - 3;
    const items = [0];
    if (start > 1) items.push(-1);
    for (let i = start; i <= end; i++) items.push(i);
    if (end < last - 1) items.push(-2);
    items.push(last);
    return items;
  });

  function prev() { if (page > 0) page--; }
  function next() { if (page < totalPages - 1) page++; }
  function goto(p) { if (p >= 0 && p < totalPages && p !== page) page = p; }
</script>

<div
  class={cn('flex items-center justify-end gap-4 px-4 py-2 text-body-md text-on-surface-variant', className)}
  {...restProps}
>
  {#if perPageOptions.length > 1}
    <div class="flex items-center gap-2">
      <span>Rows per page:</span>
      <select
        class="bg-transparent border-none text-body-md text-on-surface cursor-pointer outline-none"
        value={perPage}
        onchange={(e) => {
          const val = Number(e.target.value);
          page = 0;
          onPerPageChange?.(val);
        }}
      >
        {#each perPageOptions as opt}
          <option value={opt}>{opt}</option>
        {/each}
      </select>
    </div>
  {/if}

  <span>{from}–{to} of {total}</span>

  <div class="flex items-center gap-1">
    <button
      type="button"
      class="w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-on-surface/8 disabled:opacity-38 disabled:cursor-not-allowed cursor-pointer"
      disabled={page === 0}
      onclick={prev}
      aria-label="Previous page"
      title="Previous page"
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
    </button>

    {#each pageItems as p, i (i)}
      {#if p < 0}
        <span class="px-1 text-on-surface-variant select-none">…</span>
      {:else}
        <button
          type="button"
          class={cn(
            'min-w-8 h-8 px-2 rounded-full inline-flex items-center justify-center cursor-pointer text-label-md',
            p === page
              ? 'bg-primary text-on-primary'
              : 'hover:bg-on-surface/8 text-on-surface'
          )}
          onclick={() => goto(p)}
          aria-current={p === page ? 'page' : undefined}
          aria-label={`Page ${p + 1}`}
        >{p + 1}</button>
      {/if}
    {/each}

    <button
      type="button"
      class="w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-on-surface/8 disabled:opacity-38 disabled:cursor-not-allowed cursor-pointer"
      disabled={page >= totalPages - 1}
      onclick={next}
      aria-label="Next page"
      title="Next page"
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  </div>
</div>

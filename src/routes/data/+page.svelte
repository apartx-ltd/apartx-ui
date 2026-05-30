<script lang="ts">
  import { List, Item, ListHeader, DataTable, Pagination, InfiniteScroll, Refresher } from '$lib/ui/data';
  import { VirtualList } from '$lib/virtual';

  let page = $state(0);

  const rows = [
    { id: 1, name: 'Ada Lovelace', role: 'Engineer' },
    { id: 2, name: 'Alan Turing', role: 'Researcher' },
    { id: 3, name: 'Grace Hopper', role: 'Admiral' },
  ];

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
  ];

  // InfiniteScroll demo
  let feed = $state(Array.from({ length: 15 }, (_, i) => i + 1));
  let feedLoading = $state(false);
  let feedHasMore = $derived(feed.length < 45);
  function loadMore() {
    feedLoading = true;
    setTimeout(() => {
      const n = feed.length;
      feed = [...feed, ...Array.from({ length: 15 }, (_, i) => n + i + 1)];
      feedLoading = false;
    }, 600);
  }

  // Refresher demo
  let refreshCount = $state(0);
  function refresh(): Promise<void> {
    return new Promise((res) => setTimeout(() => { refreshCount++; res(); }, 900));
  }

  // VirtualList demo
  let bigList = $state<{ id: number; label: string }[]>([]);
  let vlist = $state<any>(null);
  $effect.pre(() => {
    if (bigList.length === 0) {
      bigList = Array.from({ length: 5000 }, (_, i) => ({ id: i, label: `Virtualized row #${i + 1}` }));
    }
  });
</script>

<h1 class="text-headline-md mb-6">Data</h1>

<section class="mb-8 max-w-md">
  <h2 class="text-title-md mb-3">List</h2>
  <List class="rounded-md border border-outline-variant">
    <ListHeader>Team</ListHeader>
    {#each rows as r (r.id)}
      <Item>{r.name} — <span class="text-on-surface-variant">{r.role}</span></Item>
    {/each}
  </List>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">DataTable</h2>
  <DataTable {columns} data={rows} />
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Pagination</h2>
  <Pagination bind:page total={42} perPage={10} />
  <p class="text-body-sm text-on-surface-variant mt-2">page=<code>{page}</code></p>
</section>

<section class="mb-8 max-w-md">
  <h2 class="text-title-md mb-3">InfiniteScroll</h2>
  <div class="h-64 overflow-y-auto rounded-md border border-outline-variant">
    <InfiniteScroll hasMore={feedHasMore} onLoadMore={loadMore} endMessage="No more items" loading={feedLoading}>
      {#each feed as n (n)}
        <Item>Row {n}</Item>
      {/each}
    </InfiniteScroll>
  </div>
</section>

<section class="mb-8 max-w-md">
  <h2 class="text-title-md mb-3">VirtualList ({bigList.length.toLocaleString()} rows)</h2>
  <div class="mb-2 flex gap-2">
    <button class="text-label-md text-primary" onclick={() => vlist?.scrollToIndex(0)}>Top</button>
    <button class="text-label-md text-primary" onclick={() => vlist?.scrollToIndex(2500, { align: 'center' })}>Middle</button>
    <button class="text-label-md text-primary" onclick={() => vlist?.scrollToIndex(bigList.length - 1, { align: 'end' })}>Bottom</button>
  </div>
  <div class="h-64 rounded-md border border-outline-variant">
    <VirtualList bind:this={vlist} data={bigList} getKey={(r) => r.id}>
      {#snippet children(item)}
        <div class="px-3 py-2 border-b border-outline-variant/50 text-body-md text-on-surface">{item.label}</div>
      {/snippet}
    </VirtualList>
  </div>
</section>

<section class="mb-8 max-w-md">
  <h2 class="text-title-md mb-3">Refresher (pull-to-refresh — touch)</h2>
  <Refresher onRefresh={refresh} class="h-48 rounded-md border border-outline-variant">
    <div class="p-3 text-body-md text-on-surface">
      <p class="mb-2">Drag down from the top on a touch device to refresh.</p>
      <p class="text-on-surface-variant">refreshed {refreshCount} time(s)</p>
    </div>
  </Refresher>
</section>

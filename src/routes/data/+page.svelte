<script lang="ts">
  import { List, Item, ListHeader, DataTable, Pagination } from '$lib/ui/data';

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

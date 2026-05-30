<script lang="ts">
  import { Searchbar, Segment, Toolbar, Title, Buttons } from '$lib/ui/structure';
  import { Button } from '$lib/ui/display';

  let query = $state('');
  let seg = $state('list');
</script>

<h1 class="text-headline-md mb-6">Structure</h1>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Toolbar + Title</h2>
  <Toolbar class="rounded-md border border-outline-variant px-3 py-2">
    <Title>Page title</Title>
    <Button variant="text" class="ml-auto">Action</Button>
  </Toolbar>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Searchbar</h2>
  <Searchbar bind:value={query} placeholder="Search…" class="max-w-md" />
  <p class="text-body-sm text-on-surface-variant mt-2">query=<code>{query}</code></p>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Buttons (group container)</h2>
  <Toolbar class="rounded-md border border-outline-variant px-3 py-2">
    <Title>Actions</Title>
    {#snippet end()}
      <Buttons>
        <Button variant="text">Cancel</Button>
        <Button variant="filled">Save</Button>
      </Buttons>
    {/snippet}
  </Toolbar>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Segment</h2>
  <Segment
    bind:value={seg}
    items={[
      { value: 'list', label: 'List' },
      { value: 'grid', label: 'Grid' },
    ]}
  />
  <p class="text-body-sm text-on-surface-variant mt-2">segment=<code>{seg}</code></p>
</section>

<p class="text-body-md text-on-surface-variant">
  Layout primitives (<code>Page</code>, <code>Header</code>, <code>Content</code>,
  <code>Footer</code>, <code>SplitPane</code>, <code>Menu</code>, <code>BackButton</code>,
  <code>DrawerButton</code>) compose a full app shell — see the component sources.
</p>

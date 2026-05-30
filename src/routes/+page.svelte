<script lang="ts">
  import { base } from '$app/paths';

  const categories = [
    { href: '/display', label: 'Display', desc: 'Button, Icon, Badge, Card, Chip, Avatar, Tabs, Accordion…' },
    { href: '/structure', label: 'Structure', desc: 'Page, Header, Toolbar, Searchbar, Segment, SplitPane, Menu…' },
    { href: '/data', label: 'Data', desc: 'List, Item, ListHeader, DataTable, Pagination' },
    { href: '/forms', label: 'Forms', desc: 'TextField, Select, Checkbox, Switch, DatePicker, createForm' },
    { href: '/overlays', label: 'Overlays', desc: 'Dialog, ConfirmDialog, Drawer, Tooltip, DropdownMenu' },
    { href: '/hooks', label: 'Hooks', desc: 'useMobile, useDebounce, useDisclosure, useNotification…' },
  ];
</script>

<header class="mb-8">
  <h1 class="text-headline-lg mb-2">ApartX UI Kit</h1>
  <p class="text-body-lg text-on-surface-variant max-w-2xl">
    Svelte 5 component library with a themeable design system and Tailwind CSS v4.
    Source-based — consumers compile the raw <code>.svelte</code>/<code>.ts</code>
    sources directly (no build step). Browse a category below.
  </p>
</header>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {#each categories as cat (cat.href)}
    <a
      href="{base}{cat.href}"
      class="block rounded-md border border-outline-variant p-5 transition-shadow hover:shadow-level-2"
    >
      <div class="text-title-md text-primary mb-1">{cat.label}</div>
      <div class="text-body-sm text-on-surface-variant">{cat.desc}</div>
    </a>
  {/each}
</div>

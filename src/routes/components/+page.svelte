<script lang="ts">
  import { base } from '$app/paths';

  const categories = [
    { href: '/display', label: 'Display', desc: 'Button, Icon, Badge, Card, Chip, Avatar, Tabs, Separator, Progress, Skeleton, Loading, Fab, Link, Accordion, PopoverJson' },
    { href: '/structure', label: 'Structure', desc: 'Page, Header, Content, Footer, Toolbar, Title, BackButton, Searchbar, Segment, SplitPane, Menu, DrawerButton' },
    { href: '/data', label: 'Data', desc: 'List, Item, ListHeader, DataTable, Pagination' },
    { href: '/forms', label: 'Forms', desc: 'TextField, Select, Checkbox, Switch, FormField, DatePicker, createForm' },
    { href: '/overlays', label: 'Overlays', desc: 'Dialog, ConfirmDialog, Drawer, Tooltip, DropdownMenu, ToasterMount + confirm service' },
    { href: '/hooks', label: 'Hooks', desc: 'useMobile, useDebounce, useLocalStorage, useDisclosure, useNotification, useSearchQuery' },
  ];
</script>

<header class="mb-8">
  <h1 class="text-headline-lg mb-2">Component docs</h1>
  <p class="text-body-lg text-on-surface-variant max-w-2xl">
    Live playground for the ApartX UI Kit. Pick a category to see every component
    and hook with its variants, sizes and states.
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

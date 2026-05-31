<script lang="ts">
  import { base } from '$app/paths';
  import {
    Button, Icon, Badge, Card, Chip, Avatar, Tabs, Separator,
    Progress, Skeleton, Loading, Fab, Link, Accordion, AccordionItem, PopoverJson,
    Popover, BottomNav, ScrollArea,
  } from '$lib/ui/display';
  import { faHouse, faGear, faHeart, faPlus, faMagnifyingGlass, faBell, faUser } from '@fortawesome/free-solid-svg-icons';
  import { faGithub } from '@fortawesome/free-brands-svg-icons';
  import { Chart } from '$lib/chart';
  import { Carousel } from '$lib/carousel';

  let tab = $state('one');
  let navTab = $state('home');

  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [{ label: 'Bookings', data: [12, 19, 9, 24, 17], backgroundColor: '#6750a4' }],
  };

  const slides = [
    { color: 'bg-primary text-on-primary', label: 'Slide 1' },
    { color: 'bg-secondary text-on-secondary', label: 'Slide 2' },
    { color: 'bg-tertiary text-on-tertiary', label: 'Slide 3' },
  ];
</script>

<h1 class="text-headline-md mb-6">Display</h1>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Button</h2>
  <div class="flex flex-wrap items-center gap-3">
    <Button variant="filled">Filled</Button>
    <Button variant="tonal">Tonal</Button>
    <Button variant="outlined">Outlined</Button>
    <Button variant="text">Text</Button>
    <Button variant="filled" color="error">Error</Button>
    <Button variant="filled" loading>Loading</Button>
    <Button variant="filled" disabled>Disabled</Button>
  </div>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Icon</h2>
  <div class="flex items-center gap-4 text-on-surface-variant">
    <Icon icon={faHouse} />
    <Icon icon={faGear} size="lg" />
    <Icon icon={faHeart} />
    <Icon icon={faGithub} />
  </div>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Badge · Chip · Avatar</h2>
  <div class="flex flex-wrap items-center gap-4">
    <Badge>5</Badge>
    <Chip>Chip label</Chip>
    <Avatar fallback="AL" />
  </div>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Card</h2>
  <Card class="max-w-sm p-4">
    <div class="text-title-md mb-1">Card title</div>
    <div class="text-body-md text-on-surface-variant">Card body content goes here.</div>
  </Card>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Tabs</h2>
  <Tabs
    bind:value={tab}
    items={[
      { value: 'one', label: 'One' },
      { value: 'two', label: 'Two' },
      { value: 'three', label: 'Three' },
    ]}
  />
  <p class="text-body-md mt-2 text-on-surface-variant">Active: {tab}</p>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Separator</h2>
  <Separator />
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Progress · Loading · Skeleton</h2>
  <div class="flex flex-col gap-4 max-w-sm">
    <Progress value={40} />
    <Loading />
    <Skeleton class="h-6 w-48" />
  </div>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Accordion</h2>
  <Accordion class="max-w-md">
    <AccordionItem value="one" title="Section one">Content for section one.</AccordionItem>
    <AccordionItem value="two" title="Section two">Content for section two.</AccordionItem>
  </Accordion>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Link</h2>
  <div class="flex gap-4">
    <Link href="{base}/forms">Internal link (client-side)</Link>
    <Link href="https://svelte.dev" external target="_blank">External link</Link>
  </div>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Fab</h2>
  <Fab><Icon icon={faPlus} /></Fab>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">PopoverJson</h2>
  <PopoverJson src={{ hello: 'world', nested: { count: 3 } }} />
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">Popover</h2>
  <Popover side="bottom" align="start" contentClass="p-3 max-w-xs">
    {#snippet trigger()}
      <Button variant="outlined">Open popover</Button>
    {/snippet}
    <p class="text-body-md text-on-surface">Any content can live inside a Popover.</p>
  </Popover>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">ScrollArea</h2>
  <ScrollArea class="h-40 max-w-sm rounded-md border border-outline-variant p-3">
    <div class="flex flex-col gap-2">
      {#each Array.from({ length: 20 }, (_, i) => i + 1) as n (n)}
        <div class="text-body-md text-on-surface">Scrollable row {n}</div>
      {/each}
    </div>
  </ScrollArea>
</section>

<section class="mb-8 max-w-md">
  <h2 class="text-title-md mb-3">Chart (chart.js · subpath apartx-ui/chart)</h2>
  <div class="h-64">
    <Chart type="bar" data={chartData} />
  </div>
</section>

<section class="mb-8 max-w-md">
  <h2 class="text-title-md mb-3">Carousel (swiper · subpath apartx-ui/carousel)</h2>
  <Carousel items={slides} slidesPerView={1} navigation pagination loop class="rounded-md overflow-hidden">
    {#snippet slide(s)}
      <div class={`flex h-40 items-center justify-center text-title-lg ${s.color}`}>{s.label}</div>
    {/snippet}
  </Carousel>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">BottomNav</h2>
  <!-- Normally `fixed` to the viewport; pinned static here for the demo frame. -->
  <div class="relative max-w-sm overflow-hidden rounded-md border border-outline-variant">
    <BottomNav
      class="!static border-t-0"
      bind:active={navTab}
      items={[
        { value: 'home', label: 'Home', icon: faHouse },
        { value: 'search', label: 'Search', icon: faMagnifyingGlass },
        { value: 'alerts', label: 'Alerts', icon: faBell, badge: 3 },
        { value: 'profile', label: 'Profile', icon: faUser },
      ]}
    />
  </div>
  <p class="text-body-sm text-on-surface-variant mt-2">active=<code>{navTab}</code></p>
</section>

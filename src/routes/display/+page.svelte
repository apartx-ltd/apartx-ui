<script lang="ts">
  import { base } from '$app/paths';
  import {
    Button, Icon, Badge, Card, Chip, Avatar, Tabs, Separator,
    Progress, Skeleton, Loading, Fab, Link, Accordion, AccordionItem, PopoverJson,
  } from '$lib/ui/display';

  let tab = $state('one');
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
    <Icon name="house" />
    <Icon name="gear" size="lg" />
    <Icon name="heart" />
    <Icon name="github" prefix="fab" />
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
  <Fab><Icon name="plus" /></Fab>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">PopoverJson</h2>
  <PopoverJson src={{ hello: 'world', nested: { count: 3 } }} />
</section>

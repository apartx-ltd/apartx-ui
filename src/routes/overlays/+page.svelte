<script lang="ts">
  import { Dialog, Drawer, Tooltip, DropdownMenu, ConfirmDialog, AlertDialog, confirm } from '$lib/ui/overlays';
  import { Button, Popover } from '$lib/ui/display';

  let dialogOpen = $state(false);
  let drawerOpen = $state(false);
  let alertOpen = $state(false);
  let lastConfirm = $state<boolean | null>(null);

  async function askConfirm() {
    lastConfirm = await confirm.open({
      title: 'Delete item?',
      text: 'This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
  }
</script>

<!-- Global confirm service host — mount once near the app root. -->
<ConfirmDialog />

<h1 class="text-headline-md mb-6">Overlays</h1>

<div class="flex flex-wrap gap-3">
  <Button onclick={() => (dialogOpen = true)}>Open Dialog</Button>
  <Button variant="tonal" onclick={() => (drawerOpen = true)}>Open Drawer</Button>
  <Button variant="outlined" onclick={askConfirm}>Confirm…</Button>
  <Button variant="outlined" color="error" onclick={() => (alertOpen = true)}>Alert dialog…</Button>

  <Popover side="bottom" align="start" contentClass="p-3 max-w-xs">
    {#snippet trigger()}
      <Button variant="text">Popover ▾</Button>
    {/snippet}
    <p class="text-body-md text-on-surface">Universal popover content anchored to its trigger.</p>
  </Popover>

  <Tooltip text="Helpful hint">
    <Button variant="text">Hover for tooltip</Button>
  </Tooltip>

  <DropdownMenu align="start">
    {#snippet trigger()}
      <Button variant="outlined">Dropdown ▾</Button>
    {/snippet}
    <div class="flex flex-col p-1">
      <button class="rounded-sm px-3 py-2 text-left hover:bg-primary/8">Edit</button>
      <button class="rounded-sm px-3 py-2 text-left hover:bg-primary/8">Duplicate</button>
      <button class="rounded-sm px-3 py-2 text-left hover:bg-primary/8">Delete</button>
    </div>
  </DropdownMenu>
</div>

<p class="text-body-sm text-on-surface-variant mt-4">last confirm result: <code>{lastConfirm}</code></p>

<Dialog bind:open={dialogOpen} title="Example dialog">
  <p class="px-6 py-2 text-body-lg text-on-surface-variant">Dialog body content.</p>
</Dialog>

<AlertDialog
  bind:open={alertOpen}
  title="Delete item?"
  description="This action cannot be undone."
  confirmText="Delete"
  destructive
  onConfirm={() => { lastConfirm = true; alertOpen = false; }}
  onCancel={() => { lastConfirm = false; }}
/>

<Drawer bind:open={drawerOpen} side="right">
  <div class="p-4 w-72">
    <h2 class="text-title-md mb-2">Drawer</h2>
    <p class="text-body-md text-on-surface-variant">Slide-in panel content.</p>
  </div>
</Drawer>

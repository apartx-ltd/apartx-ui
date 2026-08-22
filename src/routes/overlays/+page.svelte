<script lang="ts">
  import { Dialog, Drawer, Tooltip, DropdownMenu, ConfirmDialog, AlertDialog, confirm } from '$lib/ui/overlays';
  import { Button, Icon, Popover } from '$lib/ui/display';
  import { Select } from '$lib/ui/forms';
  import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';

  let dialogOpen = $state(false);
  // Счётчик кликов по кнопке в шапке: e2e проверяет, что она нажимается и диалог при
  // этом не закрывается (кнопка живёт в шапке, а не в теле — легко было бы уехать в
  // outside-click).
  let actionClicks = $state(0);
  let drawerOpen = $state(false);
  let alertOpen = $state(false);
  let lastConfirm = $state<boolean | null>(null);

  // Select-in-Dialog regression scenario: a long option list whose bottom items
  // render BELOW the dialog's bottom edge. bits-ui dismiss uses a coordinate check,
  // so a body-portalled menu (pre-0.5.0) counted such a click as "outside the dialog"
  // and closed the modal. The dialog must stay open and the value must apply.
  let selectDialogOpen = $state(false);
  let selectValue = $state('');
  const selectOptions = Array.from({ length: 14 }, (_, i) => ({
    value: `opt-${i + 1}`,
    label: `Option ${i + 1}`,
  }));

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
  <Button data-testid="open-dialog" onclick={() => (dialogOpen = true)}>Open Dialog</Button>
  <Button data-testid="open-select-dialog" variant="tonal" onclick={() => (selectDialogOpen = true)}>Dialog with Select</Button>
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
  <!-- actions: кнопки в шапке слева от крестика. Заголовок и крестик остаются кит'овыми,
       в отличие от сниппета header, который заменяет шапку целиком. -->
  {#snippet actions()}
    <Button data-testid="dialog-action" variant="icon" aria-label="Help" onclick={() => (actionClicks += 1)}>
      <Icon icon={faCircleQuestion} />
    </Button>
  {/snippet}
  <p data-testid="dialog-body" class="px-6 py-2 text-body-lg text-on-surface-variant">Dialog body content.</p>
  <p class="px-6 text-body-sm text-on-surface-variant">action clicks: <code data-testid="dialog-action-clicks">{actionClicks}</code></p>
</Dialog>

<Dialog bind:open={selectDialogOpen} title="Select in dialog">
  <div data-testid="select-dialog-body" class="px-6 py-4">
    <Select
      data-testid="dialog-select"
      bind:value={selectValue}
      label="Type"
      placeholder="Choose…"
      options={selectOptions}
    />
    <p class="mt-4 text-body-sm text-on-surface-variant">value=<code data-testid="dialog-select-value">{selectValue}</code></p>
  </div>
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

<script lang="ts">
  import { ConfirmDialog } from './confirm.svelte';
  import Dialog from './Dialog.svelte';
  import Button from '../display/Button.svelte';

  let s = $derived(ConfirmDialog.state);

  function close() {
    ConfirmDialog.close(false);
  }

  function confirm() {
    ConfirmDialog.close(true);
  }

  function onOpenChange(open: boolean) {
    if (!open) close();
  }
</script>

<Dialog
  open={s.open}
  {onOpenChange}
  title={s.title}
  showCloseButton={false}
  role="alertdialog"
  bodyClass="px-6 pt-2 pb-2 text-body-lg text-on-surface-variant"
>
  {s.text}

  {#snippet footer()}
    <div class="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
      <Button variant="text" onclick={close} disabled={s.submitting}>
        {s.cancelText}
      </Button>
      <Button variant="filled" loading={s.submitting} onclick={confirm}>
        {s.confirmText}
      </Button>
    </div>
  {/snippet}
</Dialog>

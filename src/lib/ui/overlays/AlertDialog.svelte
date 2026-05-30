<script lang="ts">
  import Dialog from './Dialog.svelte';
  import Button from '../display/Button.svelte';

  /**
   * Modal alert dialog — a focused confirm/acknowledge surface built on Dialog
   * with `role="alertdialog"`. Unlike the global `confirm` service this is a
   * declarative, locally-mounted variant (bind `open`).
   *
   * All user-facing text is a prop with an English default; translate at the
   * call site. Provide a `footer` snippet to fully customise the actions.
   */
  let {
    children,
    footer: footerOverride,
    open = $bindable(false),
    title = '',
    description = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    showCancel = true,
    destructive = false,
    submitting = false,
    onConfirm,
    onCancel,
    onOpenChange,
    class: className,
    ...restProps
  }: {
    children?: any;
    footer?: any;
    open?: boolean;
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
    destructive?: boolean;
    submitting?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
    onOpenChange?: (v: boolean) => void;
    class?: string;
    [key: string]: any;
  } = $props();

  function cancel() {
    onCancel?.();
    open = false;
  }

  function confirm() {
    onConfirm?.();
  }

  function handleOpenChange(v: boolean) {
    onOpenChange?.(v);
    if (!v) onCancel?.();
  }
</script>

<Dialog
  bind:open
  {title}
  {description}
  role="alertdialog"
  showCloseButton={false}
  onOpenChange={handleOpenChange}
  class={className}
  {...restProps}
>
  {#if children}{@render children()}{/if}

  {#snippet footer()}
    {#if footerOverride}
      {@render footerOverride()}
    {:else}
      <div class="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
        {#if showCancel}
          <Button variant="text" onclick={cancel} disabled={submitting}>
            {cancelText}
          </Button>
        {/if}
        <Button
          variant="filled"
          color={destructive ? 'error' : undefined}
          loading={submitting}
          onclick={confirm}
        >
          {confirmText}
        </Button>
      </div>
    {/if}
  {/snippet}
</Dialog>

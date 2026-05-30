<script>
  import Checkbox from './Checkbox.svelte';
  import { cn } from '../utils/cn';

  /**
   * Form-aware Checkbox wrapper. Adds an error line below the checkbox
   * (the base Checkbox has no error slot). Typically used with createForm().
   */
  let {
    checked = $bindable(false),
    error = '',
    class: className,
    ...props
  } = $props();
</script>

<div class={cn('flex flex-col gap-1', className)}>
  <Checkbox bind:checked {...props} />
  {#if error}
    <span class="text-label-sm text-error">{error}</span>
  {/if}
</div>

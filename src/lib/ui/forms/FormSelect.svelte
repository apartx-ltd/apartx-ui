<script>
  import Select from './Select.svelte';

  /**
   * Form-aware Select wrapper. Accepts the same props as Select
   * (label, options, error, …). Typically used with createForm().
   */
  let { ...props } = $props();
</script>

<Select {...props} />

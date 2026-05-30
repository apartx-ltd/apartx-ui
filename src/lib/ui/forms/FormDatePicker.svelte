<script>
  import DatePicker from './DatePicker.svelte';

  /**
   * Form-aware DatePicker wrapper. Accepts the same props as DatePicker
   * (label, error, minValue, maxValue, …). Typically used with createForm().
   */
  let { ...props } = $props();
</script>

<DatePicker {...props} />

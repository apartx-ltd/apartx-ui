<script>
  import TextField from './TextField.svelte';

  /**
   * Form-aware TextField wrapper.
   * Accepts the same props as TextField.
   * Typically used with createForm().
   */
  let { ...props } = $props();
</script>

<TextField {...props} />

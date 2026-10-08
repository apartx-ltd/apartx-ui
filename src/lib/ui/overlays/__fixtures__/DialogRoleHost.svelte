<script lang="ts">
  import Dialog from '../Dialog.svelte';

  let { role = undefined }: { role?: 'dialog' | 'alertdialog' } = $props();
</script>

<Dialog open={true} title="Role" {role} respectBack={false}>
  <p>body</p>
</Dialog>

<script lang="ts">
  import Page from '../Page.svelte';

  let { edgeToEdge = undefined, class: className = undefined }: { edgeToEdge?: boolean; class?: string } = $props();
</script>

<Page data-testid="page" {edgeToEdge} class={className}>
  <p>body</p>
</Page>

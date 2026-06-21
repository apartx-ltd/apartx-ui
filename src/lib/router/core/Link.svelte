<script lang="ts">
  import type { Snippet } from 'svelte';
  import { link } from './nav';

  let {
    to,
    replace = false,
    class: className = '',
    children,
    ...rest
  }: {
    to: string;
    replace?: boolean;
    class?: string;
    children?: Snippet;
    [key: string]: any;
  } = $props();
</script>

<a href={to} use:link data-replace={replace ? '' : undefined} class={className} {...rest}>
  {@render children?.()}
</a>

<script>
  import { Accordion } from 'bits-ui';
  import { cn } from '../utils/cn';
  import Icon from './Icon.svelte';

  let {
    type = 'multiple',
    value = $bindable([]),
    children,
    class: className,
    ...restProps
  } = $props();
</script>

<Accordion.Root {type} bind:value class={cn('space-y-2', className)} {...restProps}>
  {@render children?.()}
</Accordion.Root>

<script lang="ts">
  import { Label as BitsLabel } from 'bits-ui';
  import { cn } from '../utils/cn';

  /**
   * Standalone form label, M3-styled. Associates with a control via `for`.
   * Used by the Form* wrappers; can also be used directly above any control.
   */
  let {
    children,
    text = '',
    required = false,
    error = false,
    for: forId,
    class: className,
    ...restProps
  }: {
    children?: any;
    text?: string;
    required?: boolean;
    error?: boolean;
    for?: string;
    class?: string;
    [key: string]: any;
  } = $props();
</script>

<BitsLabel.Root
  for={forId}
  class={cn('text-label-md', error ? 'text-error' : 'text-on-surface-variant', className)}
  {...restProps}
>
  {#if children}{@render children()}{:else}{text}{/if}{required ? ' *' : ''}
</BitsLabel.Root>

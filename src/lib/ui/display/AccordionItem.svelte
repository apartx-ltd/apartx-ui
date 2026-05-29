<script>
  import { Accordion } from 'bits-ui';
  import { cn } from '../utils/cn';
  import Icon from './Icon.svelte';

  let {
    value,
    title,
    children,
    class: className,
    ...restProps
  } = $props();
</script>

<Accordion.Item {value} class={cn('rounded-xl bg-surface-container overflow-hidden', className)} {...restProps}>
  <Accordion.Header>
    <Accordion.Trigger class="w-full px-4 py-3 cursor-pointer flex items-center justify-between text-title-sm text-on-surface hover:bg-on-surface/8">
      {title}
      <Icon name="chevron-down" class="transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
    </Accordion.Trigger>
  </Accordion.Header>
  <Accordion.Content class="overflow-hidden">
    <div class="pb-2">
      {@render children?.()}
    </div>
  </Accordion.Content>
</Accordion.Item>

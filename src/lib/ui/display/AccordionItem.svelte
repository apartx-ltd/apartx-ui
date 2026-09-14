<script>
  import { Accordion } from 'bits-ui';
  import { cn } from '../utils/cn';
  import Icon from './Icon.svelte';
  import { faChevronDown, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

  let {
    value,
    title,
    // Секция требует внимания (не заполнена, невалидна): заголовок красный с иконкой
    // предупреждения — видно и в свёрнутом виде, не раскрывая секцию.
    error = false,
    children,
    class: className,
    ...restProps
  } = $props();
</script>

<Accordion.Item {value} class={cn('rounded-xl bg-surface-container overflow-hidden', className)} data-error={error || undefined} {...restProps}>
  <Accordion.Header>
    <Accordion.Trigger class={cn('w-full px-4 py-3 cursor-pointer flex items-center justify-between gap-2 text-title-sm text-on-surface hover:bg-on-surface/8', error && 'text-error')}>
      <span class="flex items-center gap-2">
        {#if error}
          <Icon icon={faTriangleExclamation} />
        {/if}
        {title}
      </span>
      <Icon icon={faChevronDown} class="transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
    </Accordion.Trigger>
  </Accordion.Header>
  <Accordion.Content class="overflow-hidden">
    <div class="pb-2">
      {@render children?.()}
    </div>
  </Accordion.Content>
</Accordion.Item>

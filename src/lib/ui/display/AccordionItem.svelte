<script>
  import { Accordion } from 'bits-ui';
  import { cn } from '../utils/cn';
  import Icon from './Icon.svelte';
  import { faChevronDown, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

  let {
    value,
    // Строка или сниппет — когда в заголовке больше текста (название + подзаголовок).
    title,
    // Слева от заголовка (иконка) и справа перед шевроном (счётчик, бейдж, статус) — как
    // start/end у Item и Toolbar. Заголовок целиком — кнопка-триггер, поэтому в слоты кладут
    // неинтерактивное содержимое: кнопка внутри кнопки — невалидная разметка.
    start,
    end,
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
    <Accordion.Trigger class={cn('w-full px-4 py-3 cursor-pointer flex items-center gap-2 text-left text-title-sm text-on-surface hover:bg-on-surface/8', error && 'text-error')}>
      {#if error}
        <Icon icon={faTriangleExclamation} />
      {/if}
      {#if start}
        <span class="shrink-0 flex items-center">{@render start()}</span>
      {/if}
      <span class="flex-1 min-w-0">
        {#if typeof title === 'function'}{@render title()}{:else}{title}{/if}
      </span>
      {#if end}
        <span class="shrink-0 flex items-center gap-2">{@render end()}</span>
      {/if}
      <Icon icon={faChevronDown} class="shrink-0 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
    </Accordion.Trigger>
  </Accordion.Header>
  <Accordion.Content class="overflow-hidden">
    <div class="pb-2">
      {@render children?.()}
    </div>
  </Accordion.Content>
</Accordion.Item>

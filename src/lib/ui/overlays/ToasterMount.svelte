<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import { Toaster } from 'svelte-sonner';
  import { cn } from '../utils/cn';
  import { setToasterHandlers, type ToasterHandlers } from './toaster-context';

  // Хост тостов: svelte-sonner сам ничего не монтирует, `toast.*` без него уходит
  // в никуда. Пропы прокидываются в <Toaster> как есть.
  //
  // Дефолты — прежнее поведение (richColors + top-right), на котором стоит admin:
  // менять их нельзя, там верхний правый угол свободен. Мобильным консьюмерам он
  // не подходит — в кабинете там кнопки действий Toolbar, и тост перехватывает по
  // ним клики (на этом падал e2e locks-gateways), поэтому позиция и отступы
  // задаются вызывающей стороной.
  // Хендлеры действий тоста ошибки вынимаются из rest ДО спреда — иначе улетели бы
  // в <Toaster> DOM-атрибутами. Дальше — контекстом вниз до <ErrorToastActions>
  // (спека docs/plans/2026-09-01-error-toast-actions в оркестраторе).
  let {
    richColors = true,
    position = 'top-right',
    class: className = undefined,
    resolveErrorHelp = undefined,
    onOpenArticle = undefined,
    onContactSupport = undefined,
    detailsContext = undefined,
    labels = undefined,
    ...rest
  }: ComponentProps<typeof Toaster> & ToasterHandlers = $props();

  setToasterHandlers(() => ({
    resolveErrorHelp, onOpenArticle, onContactSupport, detailsContext, labels,
  }));
</script>

<!-- pointer-events-auto на самом <ol data-sonner-toaster>: пока открыта модалка, bits-ui
     держит на <body> `pointer-events: none` (внутрь пускает только контент диалога, у него
     свой pointer-events-auto). Тост живёт вне диалога и это наследовал — был виден, но не
     кликался, а ошибки чаще всего и прилетают из модалки. Список сам по себе нулевой высоты
     (тосты в нём absolute), так что ничего лишнего он не перехватывает. -->
<Toaster {richColors} {position} class={cn('pointer-events-auto', className)} {...rest} />

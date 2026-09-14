<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import { Toaster } from 'svelte-sonner';
  import { cn } from '../utils/cn';
  import { toastLayer } from './toaster-context.svelte';

  // Хост тостов: svelte-sonner сам ничего не монтирует, `toast.*` без него уходит
  // в никуда. Пропы прокидываются в <Toaster> как есть.
  //
  // Дефолты — прежнее поведение (richColors + top-right), на котором стоит admin:
  // менять их нельзя, там верхний правый угол свободен. Мобильным консьюмерам он
  // не подходит — в кабинете там кнопки действий Toolbar, и тост перехватывает по
  // ним клики (на этом падал e2e locks-gateways), поэтому позиция и отступы
  // задаются вызывающей стороной.
  // Кит не знает, что рисуется внутри тоста: строка действий ошибки, подсказки и т.п. —
  // это слой хоста поверх кита (он оборачивает <ToasterMount> и кладёт свои хендлеры
  // контекстом). Здесь только sonner и z-полоса (см. toaster-context).
  let {
    richColors = true,
    position = 'top-right',
    // Тост ошибки у хостов висит до закрытия — крестик обязателен: свайп на десктопе
    // не найти, а без него ошибку нечем убрать.
    closeButton = true,
    class: className = undefined,
    style: styleProp = undefined,
    ...rest
  }: ComponentProps<typeof Toaster> = $props();

  // z-index — инлайном и только когда хост «нырнул» под модалки (см. toaster-context):
  // у sonner он прописан в его же `:global([data-sonner-toaster])` как 999999999, и класс
  // консьюмера его не перебьёт (та же специфичность, порядок бандлов не гарантирован) —
  // инлайн выигрывает всегда. Стиль консьюмера идёт следом и при желании перебьёт и z.
  const style = $derived(
    [toastLayer.z != null ? `z-index:${toastLayer.z}` : '', styleProp].filter(Boolean).join(';'),
  );
</script>

<!-- pointer-events-auto на самом <ol data-sonner-toaster>: пока открыта модалка, bits-ui
     держит на <body> `pointer-events: none` (внутрь пускает только контент диалога, у него
     свой pointer-events-auto). Тост живёт вне диалога и это наследовал — был виден, но не
     кликался, а ошибки чаще всего и прилетают из модалки. Список сам по себе нулевой высоты
     (тосты в нём absolute), так что ничего лишнего он не перехватывает. -->
<Toaster {richColors} {position} {closeButton} class={cn('pointer-events-auto', className)} {style} {...rest} />

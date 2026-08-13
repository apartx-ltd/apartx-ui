<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import { Toaster } from 'svelte-sonner';

  // Хост тостов: svelte-sonner сам ничего не монтирует, `toast.*` без него уходит
  // в никуда. Пропы прокидываются в <Toaster> как есть.
  //
  // Дефолты — прежнее поведение (richColors + top-right), на котором стоит admin:
  // менять их нельзя, там верхний правый угол свободен. Мобильным консьюмерам он
  // не подходит — в кабинете там кнопки действий Toolbar, и тост перехватывает по
  // ним клики (на этом падал e2e locks-gateways), поэтому позиция и отступы
  // задаются вызывающей стороной.
  let {
    richColors = true,
    position = 'top-right',
    ...rest
  }: ComponentProps<typeof Toaster> = $props();
</script>

<Toaster {richColors} {position} {...rest} />

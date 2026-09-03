<script lang="ts">
  // Ошибка под формой с той же строкой действий, что у тоста (спека
  // docs/plans/2026-09-03-inline-error-help в оркестраторе). Текст — только слотом: кит не
  // владеет i18n, а у форм текст часто не перевод ключа, а склейка (отсчёт, своя
  // формулировка). `error` — объект как есть (Meteor.Error, Error, null): без ключа —
  // только текст; без ключа и без слота — не рисуется ничего. Без <ToasterMount> (нет
  // хендлеров) вырождается в текст. Слой для меню статей не задаёт: внутри Dialog его уже
  // даёт диалог, на странице — дефолт Popover (z-50).
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '../utils/cn';
  import ErrorHelpActions from './ErrorHelpActions.svelte';
  import { errorHelpProps } from './error-toast';

  // Атрибуты (в том числе testid) — rest-спредом на обёртку, а не именованным пропом:
  // сканер кабинета (e2e/registry/testid-scan.mjs) ищет в исходниках literal-атрибут
  // testid, и именованный проп выглядел бы для него как пропавший айди.
  // NB: сам этот атрибут в комментариях не писать в literal-форме — сканер прочитает
  // его как настоящий айди и уронит гейт именования.
  let {
    error = null,
    class: className = undefined,
    children = undefined,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & {
    error?: unknown;
    children?: Snippet;
  } = $props();

  const hasKey = $derived(!!errorHelpProps(error).errorKey);
</script>

{#if children || hasKey}
  <div role="alert" class={cn('text-body-sm text-error', className)} {...rest}>
    {@render children?.()}
    <ErrorHelpActions {error} />
  </div>
{/if}

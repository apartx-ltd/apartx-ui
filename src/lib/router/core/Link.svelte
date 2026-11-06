<script lang="ts">
  import { getContext, type Snippet } from 'svelte';
  import { link, shouldHandle } from './nav';
  import { ROUTER_LOCATION_CTX } from './location-source';
  import { useRouter } from './useRouter.svelte';

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

  // Внутри <VirtualRouter> путь виртуальный: href — полный реальный адрес (для ctrl/middle-клика
  // в новую вкладку), обычный клик идёт через роутер поддерева. Снаружи — как всегда, use:link.
  // Абсолютный/внешний `to` — как у обычной ссылки: без переписывания фрагмента, дефолт браузера.
  const scoped = getContext(ROUTER_LOCATION_CTX) != null;
  const scopedRouter = scoped ? useRouter() : null;
  const router = $derived(/^[a-z]+:\/\//i.test(to) ? null : scopedRouter);

  // onclick хоста зовём первым: его preventDefault отменяет переход (shouldHandle), как у use:link.
  function onScopedClick(e: MouseEvent) {
    rest.onclick?.(e);
    if (!router || !shouldHandle(e, (e.currentTarget as HTMLAnchorElement).target)) return;
    e.preventDefault();
    if (replace) {
      router.replace(to);
      return;
    }
    router.push(to);
  }
</script>

{#if router}
  <a href={router.resolveHref(to)} class={className} {...rest} onclick={onScopedClick}>
    {@render children?.()}
  </a>
{:else}
  <a href={to} use:link data-replace={replace ? '' : undefined} class={className} {...rest}>
    {@render children?.()}
  </a>
{/if}

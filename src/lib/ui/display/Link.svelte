<script lang="ts">
  import { cn } from '../utils/cn';
  import { getLinkNavigate, type LinkNavigate } from './link-context';

  let {
    href = '',
    children,
    replace = false,
    external = false,
    target,
    onclick,
    navigate,
    class: className,
    ...restProps
  }: {
    href: string;
    children: any;
    replace?: boolean;
    external?: boolean;
    target?: string;
    onclick?: (e: MouseEvent) => void;
    /** Per-instance navigator override. Falls back to the injected navigator, then native `<a href>`. */
    navigate?: LinkNavigate;
    class?: string;
    [key: string]: any;
  } = $props();

  const ctxNavigate = getLinkNavigate();

  let isExternal = $derived(
    external || /^(https?:|mailto:|tel:)/.test(href) || target === '_blank',
  );

  function handleClick(e: MouseEvent) {
    onclick?.(e);
    if (e.defaultPrevented) return;
    if (isExternal) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.button !== 0) return;

    const nav = navigate ?? ctxNavigate;
    // No router injected → let the browser perform native navigation.
    if (!nav) return;

    e.preventDefault();
    nav(href, { replace });
  }
</script>

<a
  {href}
  {target}
  class={cn('text-primary hover:underline cursor-pointer', className)}
  onclick={handleClick}
  {...restProps}
>
  {@render children()}
</a>

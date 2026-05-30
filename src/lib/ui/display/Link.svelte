<script lang="ts">
  import { cn } from '../utils/cn';
  import { getNavigator, type LinkNavigate } from '../../navigation/context';

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

  const navigator = getNavigator();

  let isExternal = $derived(
    external || /^(https?:|mailto:|tel:)/.test(href) || target === '_blank',
  );

  function handleClick(e: MouseEvent) {
    onclick?.(e);
    if (e.defaultPrevented) return;
    if (isExternal) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.button !== 0) return;

    // Priority: per-instance override → injected navigator → native <a href>.
    if (navigate) {
      e.preventDefault();
      navigate(href, { replace });
      return;
    }
    if (navigator) {
      e.preventDefault();
      if (replace) navigator.replace(href);
      else navigator.push(href);
    }
    // No navigator → let the browser perform native navigation.
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

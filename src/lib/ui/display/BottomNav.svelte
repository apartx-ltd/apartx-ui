<script lang="ts">
  import { cn } from '../utils/cn';
  import Icon from './Icon.svelte';
  import Link from './Link.svelte';
  import Badge from './Badge.svelte';

  type NavItem = {
    value: string;
    label?: string;
    icon?: string;
    href?: string;
    badge?: string | number;
    disabled?: boolean;
  };

  /**
   * Mobile bottom navigation bar — fixed to the viewport bottom with iOS
   * safe-area padding. Router-agnostic: items with `href` render through
   * `<Link>` (Navigator contract), otherwise emit `onChange(value)`.
   *
   * All labels are caller-supplied props (translate at the call site).
   */
  let {
    items = [],
    active = $bindable(''),
    showLabels = true,
    replace = false,
    onChange,
    class: className,
    ...restProps
  }: {
    items?: NavItem[];
    active?: string;
    showLabels?: boolean;
    /** Tab links replace the current history entry instead of pushing — so
        back leaves the shell rather than retracing visited tabs. */
    replace?: boolean;
    onChange?: (value: string) => void;
    class?: string;
    [key: string]: any;
  } = $props();

  function select(item: NavItem) {
    if (item.disabled) return;
    active = item.value;
    onChange?.(item.value);
  }
</script>

<nav
  class={cn(
    'fixed bottom-0 inset-x-0 z-30 flex items-stretch justify-around',
    'bg-surface-container border-t border-outline-variant',
    'pb-[env(safe-area-inset-bottom)]',
    className,
  )}
  {...restProps}
>
  {#each items as item (item.value)}
    {@const isActive = active === item.value}
    {#snippet inner()}
      <span class="relative flex items-center justify-center">
        {#if item.icon}
          <Icon icon={item.icon} />
        {/if}
        {#if item.badge !== undefined && item.badge !== ''}
          <span class="absolute -top-1 -right-2">
            <Badge>{item.badge}</Badge>
          </span>
        {/if}
      </span>
      {#if showLabels && item.label}
        <span class="text-label-sm truncate max-w-full">{item.label}</span>
      {/if}
    {/snippet}

    {@const cls = cn(
      'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-14',
      'transition-colors no-underline',
      isActive ? 'text-primary' : 'text-on-surface-variant',
      item.disabled && 'opacity-38 pointer-events-none',
    )}

    {#if item.href}
      <Link href={item.href} {replace} class={cls} onclick={() => select(item)} aria-current={isActive ? 'page' : undefined}>
        {@render inner()}
      </Link>
    {:else}
      <button type="button" class={cls} disabled={item.disabled} aria-current={isActive ? 'page' : undefined} onclick={() => select(item)}>
        {@render inner()}
      </button>
    {/if}
  {/each}
</nav>

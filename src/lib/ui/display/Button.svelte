<script>
  import { cn } from '../utils/cn';

  /**
   * Button component.
   * @param variant - filled | outlined | text | tonal | icon | fab
   * @param color - primary | secondary | tertiary | error
   * @param size - sm | md | lg
   * @param loading - show loading state
   * @param disabled - disabled state
   */
  let {
    children,
    variant = 'filled',
    color = 'primary',
    size = 'md',
    type = 'button',
    loading = false,
    disabled = false,
    class: className,
    ...restProps
  } = $props();

  const base = 'inline-flex items-center justify-center gap-2 font-medium transition-all cursor-pointer disabled:opacity-38 disabled:cursor-not-allowed';

  const variants = {
    filled: {
      primary: 'bg-primary text-on-primary hover:shadow-level-1 active:shadow-level-0',
      secondary: 'bg-secondary text-on-secondary hover:shadow-level-1 active:shadow-level-0',
      tertiary: 'bg-tertiary text-on-tertiary hover:shadow-level-1 active:shadow-level-0',
      error: 'bg-error text-on-error hover:shadow-level-1 active:shadow-level-0',
    },
    outlined: {
      primary: 'border border-outline text-primary hover:bg-primary/8 active:bg-primary/12',
      secondary: 'border border-outline text-secondary hover:bg-secondary/8 active:bg-secondary/12',
      tertiary: 'border border-outline text-tertiary hover:bg-tertiary/8 active:bg-tertiary/12',
      error: 'border border-outline text-error hover:bg-error/8 active:bg-error/12',
    },
    text: {
      primary: 'text-primary hover:bg-primary/8 active:bg-primary/12',
      secondary: 'text-secondary hover:bg-secondary/8 active:bg-secondary/12',
      tertiary: 'text-tertiary hover:bg-tertiary/8 active:bg-tertiary/12',
      error: 'text-error hover:bg-error/8 active:bg-error/12',
    },
    tonal: {
      primary: 'bg-secondary-container text-on-secondary-container hover:shadow-level-1',
      secondary: 'bg-secondary-container text-on-secondary-container hover:shadow-level-1',
      tertiary: 'bg-tertiary-container text-on-tertiary-container hover:shadow-level-1',
      error: 'bg-error-container text-on-error-container hover:shadow-level-1',
    },
    icon: {
      primary: 'text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12',
      secondary: 'text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12',
      tertiary: 'text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12',
      error: 'text-error hover:bg-error/8 active:bg-error/12',
    },
    fab: {
      primary: 'bg-primary-container text-on-primary-container shadow-level-3 hover:shadow-level-4',
      secondary: 'bg-secondary-container text-on-secondary-container shadow-level-3 hover:shadow-level-4',
      tertiary: 'bg-tertiary-container text-on-tertiary-container shadow-level-3 hover:shadow-level-4',
      error: 'bg-error-container text-on-error-container shadow-level-3 hover:shadow-level-4',
    },
  };

  const sizes = {
    icon: { sm: 'w-8 h-8 rounded-full', md: 'w-10 h-10 rounded-full', lg: 'w-12 h-12 rounded-full' },
    fab: { sm: 'w-10 h-10 rounded-md', md: 'w-14 h-14 rounded-lg', lg: 'w-24 h-24 rounded-xl' },
    default: { sm: 'px-3 h-8 text-label-md rounded-full', md: 'px-6 h-10 text-label-lg rounded-full', lg: 'px-8 h-12 text-label-lg rounded-full' },
  };

  let sizeGroup = $derived(variant === 'icon' ? 'icon' : variant === 'fab' ? 'fab' : 'default');
</script>

<button
  {type}
  class={cn(
    base,
    variants[variant]?.[color],
    sizes[sizeGroup]?.[size],
    className
  )}
  disabled={disabled || loading}
  {...restProps}
>
  {#if loading}
    <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
  {/if}
  {@render children()}
</button>

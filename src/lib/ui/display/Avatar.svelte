<script>
  import { cn } from '../utils/cn';

  let {
    src,
    alt = '',
    fallback = '',
    size = 'md',
    class: className,
    ...restProps
  } = $props();

  let imgError = $state(false);

  const sizes = {
    sm: 'w-8 h-8 text-label-sm',
    md: 'w-10 h-10 text-label-lg',
    lg: 'w-14 h-14 text-title-md',
    xl: 'w-20 h-20 text-title-lg',
  };

  let initials = $derived(
    fallback || alt?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  );
</script>

<div
  class={cn(
    'relative inline-flex items-center justify-center rounded-full bg-primary-container text-on-primary-container overflow-hidden flex-shrink-0',
    sizes[size],
    className
  )}
  {...restProps}
>
  {#if src && !imgError}
    <img
      {src}
      {alt}
      class="w-full h-full object-cover"
      onerror={() => { imgError = true; }}
    />
  {:else}
    <span class="font-medium">{initials}</span>
  {/if}
</div>

<script>
  import { cn } from '../utils/cn';

  let { value, max = 100, indeterminate = false, class: className, ...restProps } = $props();
  let pct = $derived(value != null ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);
</script>

<div
  role="progressbar"
  aria-valuenow={indeterminate ? undefined : value}
  aria-valuemax={max}
  class={cn('h-1 w-full bg-surface-variant rounded-full overflow-hidden', className)}
  {...restProps}
>
  {#if indeterminate}
    <div class="h-full bg-primary rounded-full animate-[indeterminate_1.5s_ease-in-out_infinite] w-1/3"></div>
  {:else}
    <div class="h-full bg-primary rounded-full transition-all duration-300" style:width="{pct}%"></div>
  {/if}
</div>

<style>
  @keyframes indeterminate {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
</style>

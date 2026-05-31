<script>
  import { cn } from '../utils/cn';
  import Icon from '../display/Icon.svelte';
  import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

  let { onclick, class: className, ...restProps } = $props();

  function handleClick(e) {
    if (onclick) {
      onclick(e);
    } else {
      history.back();
    }
  }
</script>

<button
  type="button"
  class={cn(
    'inline-flex items-center justify-center w-10 h-10 rounded-full',
    'text-on-surface hover:bg-on-surface/8 active:bg-on-surface/12',
    'transition-colors cursor-pointer',
    className
  )}
  onclick={handleClick}
  {...restProps}
>
  <Icon icon={faArrowLeft} />
</button>

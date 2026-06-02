<script>
  import { cn } from '../utils/cn';
  import Icon from '../display/Icon.svelte';
  import { getNavigator } from '../../navigation/context';
  import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

  // A back/up button. By default it pops one history entry. Pass `href` to go
  // "up" to a specific route instead — useful for deep-linked pages with no list
  // behind them. Either way it always plays the router's *backward* transition
  // (via the injected Navigator's `back()`), never a forward slide. `onclick` is
  // an escape hatch for non-navigation actions (e.g. closing a modal).
  let { href, onclick, class: className, ...restProps } = $props();

  const navigator = getNavigator();

  function handleClick(e) {
    if (onclick) {
      onclick(e);
      return;
    }
    if (navigator) {
      navigator.back(href);
    } else if (href) {
      window.location.assign(href);
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

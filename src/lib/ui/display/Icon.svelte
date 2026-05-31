<script>
  import { cn } from '../utils/cn';
  import Fa from 'svelte-fa';

  /**
   * FontAwesome SVG icon wrapper.
   *
   * The kit imports NO icon sets — that would force the whole FontAwesome library
   * into every consumer's bundle (it can't be tree-shaken through a dynamic
   * name→icon lookup). Instead the CONSUMER passes a FontAwesome `IconDefinition`
   * via `icon`, using a tree-shaken named import so only the icons actually used
   * ship:
   *
   * @example
   *   import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
   *   <Icon icon={faArrowLeft} />
   *   <Icon icon={faPlus} size="lg" />
   *
   * Kit components that need their own icon (e.g. a dropdown chevron) import that
   * single icon by name and pass it here the same way.
   */
  let { icon, size, class: className, ...restProps } = $props();
</script>

{#if icon}
  <span class={cn('inline-flex items-center justify-center', className)} {...restProps}>
    <Fa {icon} {size} />
  </span>
{/if}

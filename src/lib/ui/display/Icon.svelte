<script>
  import { cn } from '../utils/cn';
  import Fa from 'svelte-fa';
  import * as solidIcons from '@fortawesome/free-solid-svg-icons';
  import * as brandIcons from '@fortawesome/free-brands-svg-icons';
  import * as regularIcons from '@fortawesome/free-regular-svg-icons';

  /**
   * FontAwesome SVG icon wrapper.
   * Accepts icon name (kebab-case, e.g. "arrow-left") and resolves to a FA icon.
   * Defaults to the solid set; pass prefix="fab" for brand icons or "far" for regular.
   *
   * @example <Icon name="arrow-left" />
   * @example <Icon name="plus" size="lg" />
   * @example <Icon name="whatsapp" prefix="fab" />
   */
  let { name, size, prefix = 'fas', class: className, ...restProps } = $props();

  const sets = { fas: solidIcons, fab: brandIcons, far: regularIcons };

  // Convert kebab-case name to FA icon object
  // "arrow-left" → "faArrowLeft"; falls back to solid if not found in the requested set.
  function resolveIcon(name, prefix) {
    if (!name) return null;
    const camelCase = 'fa' + name
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    const set = sets[prefix] || solidIcons;
    return set[camelCase] || solidIcons[camelCase] || null;
  }

  let icon = $derived(resolveIcon(name, prefix));
</script>

{#if icon}
  <span class={cn('inline-flex items-center justify-center', className)} {...restProps}>
    <Fa {icon} {size} />
  </span>
{/if}

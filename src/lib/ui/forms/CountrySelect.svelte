<script lang="ts">
  import Dialog from '../overlays/Dialog.svelte';
  import Toolbar from '../structure/Toolbar.svelte';
  import BackButton from '../structure/BackButton.svelte';
  import TextField from './TextField.svelte';
  import List from '../data/List.svelte';
  import Item from '../data/Item.svelte';

  /**
   * Country picker modal — data-agnostic. The consumer passes the country list
   * (e.g. `countryPhoneData` from the `phone` package or any ISO-3166 source).
   * Each country needs at least `country_name` and `country_code`; an optional
   * stable `key` (alpha2/alpha3) is used for keyed iteration.
   */
  type Country = {
    country_name: string;
    country_code: string | number;
    alpha2?: string;
    alpha3?: string;
    [k: string]: unknown;
  };

  let {
    open = $bindable(false),
    countries = [],
    onselect,
    title = '',
    searchPlaceholder = 'Search',
    fullScreen = undefined,
  }: {
    open?: boolean;
    countries?: Country[];
    onselect?: (country?: Country) => void;
    title?: string;
    searchPlaceholder?: string;
    /** Force full-screen. When undefined, auto: full-screen on mobile (≤640px),
     *  centered above. */
    fullScreen?: boolean;
  } = $props();

  let searchText = $state('');

  // Responsive default: full-screen on small viewports, centered dialog on
  // larger ones. An explicit `fullScreen` prop overrides this.
  let isMobile = $state(false);
  $effect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 640px)');
    isMobile = mq.matches;
    const onChange = (e: MediaQueryListEvent) => (isMobile = e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });

  const effectiveFullScreen = $derived(fullScreen ?? isMobile);

  const sorted = $derived(
    [...countries].sort((a, b) => String(a.country_name).localeCompare(String(b.country_name))),
  );

  const filtered = $derived.by(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        String(c.country_name).toLowerCase().includes(q) ||
        String(c.country_code).includes(q),
    );
  });

  function keyOf(c: Country, i: number) {
    return (c.alpha3 ?? c.alpha2 ?? `${c.country_code}-${c.country_name}-${i}`) as string;
  }

  function pick(country?: Country) {
    searchText = '';
    open = false;
    onselect?.(country);
  }

  function onOpenChange(v: boolean) {
    if (!v) pick();
  }
</script>

<Dialog
  bind:open
  {title}
  {onOpenChange}
  showCloseButton={false}
  fullScreen={effectiveFullScreen}
  contentClass={effectiveFullScreen ? '' : 'max-w-md max-h-[80vh]'}
  bodyClass="p-0"
>
  {#snippet header()}
    <div class="border-outline-variant border-b">
      <Toolbar>
        {#snippet start()}
          <BackButton onclick={() => pick()} />
        {/snippet}
        <TextField bind:value={searchText} placeholder={searchPlaceholder} />
      </Toolbar>
    </div>
  {/snippet}

  <List>
    {#each filtered as country, i (keyOf(country, i))}
      <Item onclick={() => pick(country)}>
        {country.country_name}
        {#snippet end()}
          <span class="text-on-surface-variant">+{country.country_code}</span>
        {/snippet}
      </Item>
    {/each}
  </List>
</Dialog>

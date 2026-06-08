<script lang="ts">
  import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
  import Dialog from '../overlays/Dialog.svelte';
  import Toolbar from '../structure/Toolbar.svelte';
  import BackButton from '../structure/BackButton.svelte';
  import Button from '../display/Button.svelte';
  import Icon from '../display/Icon.svelte';
  import TextField from './TextField.svelte';
  import Item from '../data/Item.svelte';
  import VirtualList from '../../virtual/VirtualList.svelte';

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
    searchLabel = 'Search',
    searchPlaceholder = 'Search',
    fullScreen = undefined,
    scrollKey = 'country-select',
  }: {
    open?: boolean;
    countries?: Country[];
    onselect?: (country?: Country) => void;
    title?: string;
    searchLabel?: string;
    searchPlaceholder?: string;
    /** Force full-screen. When undefined, auto: full-screen on mobile (≤640px),
     *  centered above. */
    fullScreen?: boolean;
    /** Scroll-restore key for the virtualized list — the position is remembered
     *  across reopen (the modal remounts the list). Pass `''` to disable. */
    scrollKey?: string;
  } = $props();

  let searchText = $state('');
  // Toolbar starts as a title + search button; tapping search swaps the title
  // for an autofocused input (mirrors the legacy two-mode country picker).
  let searching = $state(false);

  function enterSearch() {
    searching = true;
  }
  function exitSearch() {
    searching = false;
    searchText = '';
  }

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
    searching = false;
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
      <Toolbar contentClass="flex-nowrap">
        {#snippet start()}
          <BackButton onclick={() => pick()} />
        {/snippet}

        {#if searching}
          <!-- svelte-ignore a11y_autofocus -->
          <TextField
            class="flex-1"
            bind:value={searchText}
            placeholder={searchPlaceholder}
            autofocus
          />
        {:else}
          <span class="text-title-md text-on-surface truncate">{title}</span>
        {/if}

        {#snippet end()}
          {#if searching}
            <Button variant="icon" onclick={exitSearch} aria-label={searchLabel}>
              <Icon icon={faXmark} />
            </Button>
          {:else}
            <Button variant="icon" onclick={enterSearch} aria-label={searchLabel}>
              <Icon icon={faMagnifyingGlass} />
            </Button>
          {/if}
        {/snippet}
      </Toolbar>
    </div>
  {/snippet}

  <!-- Virtualized: 232 countries render lazily, and `scrollKey` makes the list
       remember its position across reopen. virtua needs a definite height —
       full-screen fills the flex-1 body (`h-full`); the centered variant has an
       auto-height (max-h-capped) panel where `flex-1` would collapse to 0, so it
       gets a fixed `h-[60vh]`. -->
  <div class={effectiveFullScreen ? 'h-full' : 'h-[60vh]'}>
    <VirtualList
      class="h-full"
      data={filtered}
      getKey={(c, i) => keyOf(c as Country, i)}
      name={scrollKey || undefined}
    >
      {#snippet children(country: Country)}
        <Item onclick={() => pick(country)}>
          {country.country_name}
          {#snippet end()}
            <span class="text-on-surface-variant">+{country.country_code}</span>
          {/snippet}
        </Item>
      {/snippet}
    </VirtualList>
  </div>
</Dialog>

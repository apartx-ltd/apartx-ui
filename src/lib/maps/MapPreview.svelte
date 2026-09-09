<script lang="ts">
  import { faMapLocationDot } from '@fortawesome/free-solid-svg-icons';
  import Dialog from '../ui/overlays/Dialog.svelte';
  import Icon from '../ui/display/Icon.svelte';
  import Loading from '../ui/display/Loading.svelte';
  import { useMobile } from '../hooks/useMobile.svelte';
  import MapConfig from './MapConfig.svelte';
  import StaticMap from './StaticMap.svelte';
  import { getMapConfigOptional } from './context';
  import type { StaticMapMarker } from './providers/static';
  import type { LngLat, MapControls, MapProviderName, MapTheme } from './providers/types';

  /**
   * Static map that opens the live map on tap.
   *
   * The preview is `<StaticMap>` (one <img>, no SDK) inside a <button>; the tap opens a kit
   * `Dialog` with `<MapView>`. MapView and MapMarker are pulled in with a dynamic import() on the
   * FIRST open, so a page that only ever shows the preview never pays for the map bundle, and
   * the provider SDK (loaded by MapView's own effect) never hits the network before a tap.
   *
   * Keys are named as on `<MapConfig>`: `apiKey` is the JS-API key the live map needs,
   * `staticApiKey` the static-image key. Yandex keeps these separate — a `<StaticMap>`-style
   * single `apiKey` would leave the live map without one. Both StaticMap and MapView sit under
   * a MapConfig of this component's own; every prop left unset falls back to an outer
   * `<MapConfig>` if there is one.
   *
   * The kit owns no text: `title` (address) and `openLabel` come from the host.
   *
   * @example
   * <MapPreview provider="yandex" apiKey={jsKey} staticApiKey={staticKey}
   *             center={{lng: 76.9, lat: 43.2}} markers={[{ coordinates: {lng: 76.9, lat: 43.2} }]}
   *             zoom={16} size={{width: 300, height: 150}} title="Almaty, Abay 1" openLabel="Show on map">
   *   {#snippet footer()}<Button onclick={openInMaps}>Open in Maps</Button>{/snippet}
   * </MapPreview>
   */
  let {
    provider,
    apiKey,
    staticApiKey,
    center,
    zoom = 15,
    size,
    markers = [],
    lang,
    theme,
    scale = 2,
    alt = '',
    class: className = '',
    fullScreen,
    title = '',
    openLabel = 'Show on map',
    controls = { zoom: true, geolocation: true, layer: false, attribution: false },
    actions,
    footer,
    open = $bindable(false),
    ...rest
  }: {
    provider?: MapProviderName;
    /** JS-API key — what the live map loads with (MapConfig's `apiKey`). */
    apiKey?: string;
    /** Static-image key, where the provider keeps one apart from the JS-API key (Yandex). */
    staticApiKey?: string;
    center: LngLat | null | undefined;
    zoom?: number;
    size: { width: number; height: number };
    markers?: StaticMapMarker[];
    lang?: string;
    theme?: MapTheme;
    scale?: 1 | 2;
    alt?: string;
    class?: string;
    /** Sheet on the whole screen vs centred window. Unset → the kit's `useMobile()` (600px). */
    fullScreen?: boolean;
    /** Dialog heading — the address, typically. */
    title?: string;
    /** aria-label of the preview button and the text of the no-image placeholder. */
    openLabel?: string;
    controls?: MapControls;
    /** Dialog header buttons (left of the close icon) — the host's "open in Maps" etc. */
    actions?: any;
    /** Dialog footer. */
    footer?: any;
    open?: boolean;
    [key: string]: any;
  } = $props();

  const outer = getMapConfigOptional();
  const mobile = useMobile();
  const isFull = $derived(fullScreen ?? mobile.current);
  const valid = $derived(!!center && Number.isFinite(center.lat) && Number.isFinite(center.lng));

  // One import() for both: MapMarker is only ever used inside MapView, and a second round trip
  // for a component that small buys nothing.
  const loadMap = () => Promise.all([import('./MapView.svelte'), import('./MapMarker.svelte')]);
</script>

{#if valid}
  <MapConfig
    provider={provider ?? outer?.provider ?? 'yandex'}
    apiKey={apiKey ?? outer?.config.apiKey ?? ''}
    staticApiKey={staticApiKey ?? outer?.config.staticApiKey ?? ''}
    lang={lang ?? outer?.config.lang ?? 'en_US'}
    mapId={outer?.config.mapId ?? ''}
    theme={theme ?? outer?.config.theme ?? 'light'}
  >
    <button
      type="button"
      class="block w-full cursor-zoom-in overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-primary"
      aria-label={openLabel}
      onclick={() => (open = true)}
      {...rest}
    >
      <StaticMap center={center as LngLat} {zoom} {size} {markers} {alt} {scale} class={className}>
        {#snippet fallback()}
          <div
            class="bg-surface-container text-on-surface-variant text-body-sm flex items-center justify-center gap-2 {className}"
          >
            <Icon icon={faMapLocationDot} />
            <span>{openLabel}</span>
          </div>
        {/snippet}
      </StaticMap>
    </button>

    <Dialog bind:open fullScreen={isFull} layout="flush" {title} {actions} {footer}>
      {#if open}
        {#await loadMap()}
          <Loading />
        {:then [{ default: MapView }, { default: MapMarker }]}
          <!-- Full-screen: the dialog body is flex-1, so h-full fills it. Windowed: the body has
               no height of its own (only an 85vh cap on the panel) — give the map one. -->
          <div class={isFull ? 'h-full' : 'h-[60vh]'}>
            <MapView center={center as LngLat} {zoom} {controls} class="h-full w-full">
              {#each markers as m}
                <MapMarker coordinates={m.coordinates} />
              {/each}
            </MapView>
          </div>
        {:catch e}
          <p class="text-error text-body-sm p-4">{e instanceof Error ? e.message : String(e)}</p>
        {/await}
      {/if}
    </Dialog>
  </MapConfig>
{/if}

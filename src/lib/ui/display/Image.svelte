<script module lang="ts">
  type ImageStatus = 'loading' | 'loaded' | 'error';

  // Session cache of src URLs that have successfully loaded at least once. A
  // remounted <Image> with a cached src starts straight in 'loaded' (no skeleton,
  // opacity-100 from the first frame) instead of replaying loading → loaded —
  // the browser already has the bytes, so that replay was just a visible flicker.
  // Only successful loads are recorded, so errored images still retry normally.
  const loadedSrcs = new Set<string>();
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import { AspectRatio as BitsAspectRatio } from 'bits-ui';
  import { cn } from '../utils/cn';
  import Icon from './Icon.svelte';
  import Button from './Button.svelte';
  import Skeleton from './Skeleton.svelte';
  import { faImage, faArrowRotateRight } from '@fortawesome/free-solid-svg-icons';

  /**
   * Image with a loading skeleton and an error state + retry button.
   *
   * Layout-shift safe: the image, skeleton and error UI are absolutely
   * positioned fills, so the box must reserve its size up front. Pass `ratio`
   * (e.g. `16 / 9`) to lock an aspect-ratio via bits-ui `AspectRatio` (the
   * padding-% technique — reserves space even on browsers without CSS
   * `aspect-ratio`), or give the box a height/aspect via `class` (`h-48`,
   * `aspect-video`, …). The box keeps that size across loading → loaded →
   * error, so nothing reflows when the image arrives.
   *
   * Retry re-mounts the `<img>` (via `{#key}`) so the URL is never mutated —
   * safe for signed/tokenised links.
   *
   * @example
   *   <Image src={url} alt="Cover" ratio={16 / 9} class="rounded-lg" />
   *   <Image src={url} class="h-48 w-full" fit="contain" />
   *   <Image src={url} ratio={1} errorText="Photo unavailable" retryText="Retry"
   *          onStatusChange={(s) => track('img', s)} onRetry={() => track('img_retry')} />
   */
  let {
    src,
    alt = '',
    ratio,
    fit = 'cover',
    loading = 'lazy',
    errorText = 'Couldn’t load image',
    retryText = 'Try again',
    showError = true,
    onStatusChange,
    onRetry,
    class: className,
    imgClass,
    ...restProps
  }: {
    src?: string;
    alt?: string;
    /** Lock an aspect-ratio (width / height, e.g. 16 / 9) to reserve space and prevent layout shift. */
    ratio?: number;
    /** object-fit of the image within the box. */
    fit?: 'cover' | 'contain';
    /** Native lazy/eager loading hint, forwarded to the `<img>`. Defaults to lazy. */
    loading?: 'lazy' | 'eager';
    /** Status text shown when the image fails to load. */
    errorText?: string;
    /** Retry button label. */
    retryText?: string;
    /** Render the error UI (status + retry). Set false to fail silently. */
    showError?: boolean;
    /** Fires when the load status changes (loading → loaded | error). */
    onStatusChange?: (status: ImageStatus) => void;
    /** Discrete action: the "try again" button was tapped. */
    onRetry?: () => void;
    class?: string;
    imgClass?: string;
    [key: string]: any;
  } = $props();

  // Cached src → skip the loading state entirely; no src → error; otherwise load.
  function initialStatus(s: string | undefined): ImageStatus {
    if (!s) return 'error';
    return loadedSrcs.has(s) ? 'loaded' : 'loading';
  }

  // Initial value only — `src` is read for the first paint; the $effect below
  // re-derives status on every later src change. untrack keeps this intentional
  // one-shot read from emitting the state_referenced_locally warning.
  let status = $state<ImageStatus>(untrack(() => initialStatus(src)));
  let retryCount = $state(0);

  function setStatus(next: ImageStatus) {
    if (status === next) return;
    status = next;
    onStatusChange?.(next);
  }

  // Reset whenever the source changes (cached → loaded, no src → error). untrack
  // so the status read/write and the callback don't register as effect deps.
  $effect(() => {
    void src;
    untrack(() => setStatus(initialStatus(src)));
  });

  function retry(e?: Event) {
    // Stop the click bubbling — Image is often nested in a clickable card/<a>,
    // and tapping retry must not also trigger that navigation.
    e?.preventDefault();
    e?.stopPropagation();
    if (!src) return;
    retryCount += 1;
    setStatus('loading');
    onRetry?.();
  }

  // `relative` makes the plain box a positioning context for the absolute fills;
  // in the AspectRatio path bits-ui makes the inner element absolute inset-0, so
  // the fills still anchor to the reserved box.
  let boxClass = $derived(cn('relative overflow-hidden bg-surface-variant', className));
</script>

{#snippet stage()}
  {#if src}
    {#key retryCount}
      <img
        {src}
        {alt}
        class={cn(
          'absolute inset-0 w-full h-full transition-opacity duration-300',
          fit === 'contain' ? 'object-contain' : 'object-cover',
          status === 'loaded' ? 'opacity-100' : 'opacity-0',
          imgClass
        )}
        draggable="false"
        {loading}
        onload={() => { if (src) loadedSrcs.add(src); setStatus('loaded'); }}
        onerror={() => setStatus('error')}
      />
    {/key}
  {/if}

  {#if status === 'loading'}
    <Skeleton class="absolute inset-0 w-full h-full" />
  {/if}

  {#if status === 'error' && showError}
    <div
      class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center bg-surface-variant text-on-surface-variant"
    >
      <Icon icon={faImage} size="lg" class="opacity-60" />
      <span class="text-body-sm">{errorText}</span>
      {#if src}
        <Button variant="text" color="primary" size="sm" class="mt-0.5" onclick={retry}>
          <Icon icon={faArrowRotateRight} />
          {retryText}
        </Button>
      {/if}
    </div>
  {/if}
{/snippet}

{#if ratio != null}
  <BitsAspectRatio.Root {ratio} class={boxClass} {...restProps}>
    {@render stage()}
  </BitsAspectRatio.Root>
{:else}
  <div class={boxClass} {...restProps}>
    {@render stage()}
  </div>
{/if}

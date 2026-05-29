<script lang="ts">
  import { useMobile, useDebounce, useDisclosure, useNotification } from '$lib/hooks';
  import { TextField } from '$lib/ui/forms';
  import { Button } from '$lib/ui/display';
  import { ToasterMount } from '$lib/ui/overlays';

  const mobile = useMobile();
  const disclosure = useDisclosure();
  const notify = useNotification();

  let raw = $state('');
  const debounced = useDebounce(() => raw, 400);
</script>

<ToasterMount />

<h1 class="text-headline-md mb-6">Hooks</h1>

<section class="mb-8">
  <h2 class="text-title-md mb-3">useMobile</h2>
  <p class="text-body-md text-on-surface-variant">
    isMobile = <code>{mobile.current}</code> (resize the window)
  </p>
</section>

<section class="mb-8 max-w-md">
  <h2 class="text-title-md mb-3">useDebounce</h2>
  <TextField bind:value={raw} placeholder="Type fast…" />
  <p class="text-body-sm text-on-surface-variant mt-2">
    raw=<code>{raw}</code> · debounced=<code>{debounced.current}</code>
  </p>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">useDisclosure</h2>
  <Button onclick={disclosure.toggle}>Toggle</Button>
  <p class="text-body-md text-on-surface-variant mt-2">open = <code>{disclosure.isOpen}</code></p>
</section>

<section class="mb-8">
  <h2 class="text-title-md mb-3">useNotification</h2>
  <Button onclick={() => notify.showNotification('Saved!', { variant: 'success' })}>Show toast</Button>
</section>

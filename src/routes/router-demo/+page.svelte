<!-- projects/apartx-ui/src/routes/router-demo/+page.svelte -->
<script lang="ts">
  import { getContext } from 'svelte';
  import type { SvelteKitNavigation } from '$lib/router/sveltekit';
  import { useNavigationGuard } from '$lib/router';
  import { Button } from '$lib/ui/display';
  import { Dialog, confirm } from '$lib/ui/overlays';

  const nav = getContext<SvelteKitNavigation>('router-demo:nav');

  let overlayOpen = $state(false);
  let overlayToken = 0;

  // Open via the overlay-stack so browser/native BACK closes the overlay (the
  // stack pushes a synthetic shallow-routing entry and intercepts the popstate).
  function openOverlay() {
    overlayOpen = true;
    overlayToken = nav.overlay.openOverlay(() => {
      overlayOpen = false;
    });
  }

  // Keep the overlay-stack in sync when the Dialog closes via X / backdrop / Esc
  // (not via the back button — the stack handles that path itself).
  function onOverlayOpenChange(open: boolean) {
    overlayOpen = open;
    if (!open) nav.overlay.closeOverlay(overlayToken);
  }

  const items = [
    { id: 'alpha', label: 'Alpha' },
    { id: 'beta', label: 'Beta' },
    { id: 'gamma', label: 'Gamma' },
  ];

  // Гард ухода (демо): пока черновик не пуст — уход со страницы спрашивает подтверждение.
  let draft = $state('');
  let stays = $state(0);
  useNavigationGuard({
    when: () => draft !== '',
    confirm: () => confirm.open({ title: 'Unsaved changes', text: 'Leave without saving?', confirmText: 'Leave', cancelText: 'Stay' }),
    onStay: () => { stays += 1; },
  });
</script>

<h1 class="text-headline-md mb-2">Router demo</h1>
<p class="text-body-md text-on-surface-variant mb-6">
  SvelteKit adapter smoke: forward/back page transitions + overlay-back over shallow routing.
</p>

<!-- Plain SvelteKit links: the client router intercepts them, firing the
     beforeNavigate/afterNavigate events the SvelteKit adapter listens to, which
     drives the <PageTransition> direction. (The engine <Link> targets the
     browser-history registry, not SvelteKit's goto — wrong primitive here.) -->
<ul class="mb-8 flex flex-col gap-2">
  {#each items as item (item.id)}
    <li>
      <a
        href="/router-demo/detail?id={item.id}"
        class="block rounded-sm border border-outline-variant px-4 py-3 text-body-lg hover:bg-primary/8"
      >
        {item.label} →
      </a>
    </li>
  {/each}
</ul>

<Button onclick={openOverlay}>Open overlay</Button>

<div class="mt-6 flex flex-col gap-2">
  <label class="text-body-md" for="leave-guard-draft">Draft (leave guard)</label>
  <input id="leave-guard-draft" data-testid="leave-guard-draft" class="rounded-sm border border-outline-variant px-3 py-2" bind:value={draft} />
  <span data-testid="leave-guard-stays">{stays}</span>
</div>

<Dialog open={overlayOpen} onOpenChange={onOverlayOpenChange} title="Overlay">
  <p class="px-6 py-2 text-body-lg text-on-surface-variant">
    Press the browser/native back button — it should close this overlay and keep the page.
  </p>
</Dialog>

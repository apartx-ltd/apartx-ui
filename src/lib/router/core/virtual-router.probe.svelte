<script lang="ts">
  // Test-only probe: an outer <Router> on the real pathname next to a <VirtualRouter>
  // whose inner <Router> routes on the `#panel=` fragment value.
  import Router from './Router.svelte';
  import Route from './Route.svelte';
  import VirtualRouter from './VirtualRouter.svelte';
  import RouterProbe from './useRouter.probe.svelte';
  import type { useRouter } from './useRouter.svelte';

  let { onrouter }: { onrouter: (r: ReturnType<typeof useRouter>) => void } = $props();
</script>

<Router>
  <Route path="/accounts/chats/:id/chat" back="/accounts/chats">
    {#snippet children()}<span data-testid="outer-chat"></span>{/snippet}
  </Route>
</Router>

<VirtualRouter hashParam="panel" prefix="/accounts">
  <RouterProbe {onrouter} />
  <Router>
    <Route path="/accounts/properties/:id/info" back={(p) => `/accounts/properties/${p.id}`}>
      {#snippet children(params)}<span data-testid="info" data-id={params.id}></span>{/snippet}
    </Route>
    <Route path="/accounts/properties/:id/booking/new">
      {#snippet children(params)}<span data-testid="booking-new" data-id={params.id}></span>{/snippet}
    </Route>
  </Router>
</VirtualRouter>

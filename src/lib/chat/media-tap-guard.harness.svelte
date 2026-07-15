<script>
  // Mirrors Message.svelte's exact structure so a DOM test exercises the REAL Svelte-compiled
  // event delegation: the row opens the menu on tap (mobile `menuOnClick`), the bubble opens it on
  // `contextmenu` (desktop right-click / touch long-press), and the media button carries the guard.
  import { createMediaTapGuard } from './helpers';

  let { onRowMenu, onBubbleMenu, onViewer } = $props();

  const guard = createMediaTapGuard(() => onViewer());
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div data-testid="row" onclick={() => onRowMenu()}>
  <div data-testid="bubble" oncontextmenu={(e) => { e.preventDefault(); onBubbleMenu(); }}>
    <button
      data-testid="media"
      type="button"
      onpointerdown={guard.onpointerdown}
      oncontextmenu={guard.oncontextmenu}
      onclick={guard.onclick}
    >media</button>
  </div>
</div>

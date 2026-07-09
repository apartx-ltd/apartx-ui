<script>
  // Audio media — kit default slot for the `audio` message type. Native <audio controls>; a custom
  // waveform player is deferred polish. Not full-bleed — renders in the normal padded stacked bubble.
  let { message } = $props();
  let url = $derived(message.meta?.file?.url);
</script>

{#if url}
  <div class="px-3 pt-2">
    <!-- svelte-ignore a11y_media_has_caption -->
    <audio controls src={url} class="max-w-full"></audio>
  </div>
{/if}

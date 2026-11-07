<script>
  // Holds the message in $state the way the chat list does, so a DOM test can re-push it (the host
  // re-sends the message with `file.transcript` after a transcribe call) without remounting the slot.
  // The wrapper mirrors Message.svelte's row: a Svelte-delegated tap-to-menu `onclick`, which a
  // press on the player must not reach (Svelte delegates events, so only a compiled parent proves it).
  import AudioMedia from './slots/AudioMedia.svelte';

  let { initial, onTranscribe = undefined, onRow = () => {} } = $props();
  // svelte-ignore state_referenced_locally
  let message = $state.raw(initial); // seeded once, then driven by push()

  /** @param {any} next */
  export function push(next) {
    message = next;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div onclick={() => onRow()}>
  <AudioMedia {message} {onTranscribe} />
</div>

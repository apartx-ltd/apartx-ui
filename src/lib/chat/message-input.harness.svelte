<script>
  // Mounts MessageInput over a reactive fake recorder (runes live in components, not in a .ts test):
  // the test reads how often start/stop/cancel ran and drives `seconds`/`recording` the way a host does.
  import MessageInput from './MessageInput.svelte';

  let { session, hasVoice = true, interaction = undefined, labels = {} } = $props();

  let recording = $state(false);
  let seconds = $state(0);
  export const calls = { start: 0, stop: 0, cancel: 0 };
  /** @type {null | (() => void)} */
  let resolveStop = null;

  const voice = {
    get recording() { return recording; },
    get seconds() { return seconds; },
    get interaction() { return interaction; },
    start() { calls.start += 1; recording = true; },
    stop() { calls.stop += 1; return new Promise((resolve) => { resolveStop = resolve; }); },
    cancel() { calls.cancel += 1; recording = false; },
  };

  /** @param {number} n */
  export function setSeconds(n) { seconds = n; }
  /** @param {boolean} v */
  export function setRecording(v) { recording = v; }
  /** The host finished uploading: the recorder is idle again and `stop()` resolves. */
  export function finishStop() { recording = false; resolveStop?.(); resolveStop = null; }
</script>

<MessageInput {session} voice={hasVoice ? voice : null} {...labels} />

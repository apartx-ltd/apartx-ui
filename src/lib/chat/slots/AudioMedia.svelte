<script>
  // Audio media — kit default slot for the `audio` message type. Telegram-style voice player: a
  // round play/pause button, the note's real waveform (`file.waveform`, 48 levels the server cuts
  // once while transcoding; none → a flat low strip), the played part highlighted, a tap on the
  // waveform seeks, and the time under it (elapsed while playing or paused mid-way, total otherwise).
  // One player at a time: starting one pauses the previous (`voicePlayback`). Not full-bleed —
  // renders in the normal padded stacked bubble.
  //
  // Transcript: when the host puts `onTranscribe(message)` into the slot context, a small «→A»
  // button sits at the end of the row. A ready `file.transcript` is toggled under the player without
  // a call; otherwise the handler runs (spinner on the button) and the text appears once the message
  // is re-pushed with `file.transcript` (or from what the handler resolved with). No handler → no
  // button: the kit never knows who transcribes.
  //
  // While the server converts a voice note (ogg/webm → AAC, which iOS plays) the file is
  // 'processing': a stub instead of a player that would fail on iOS. The message is re-pushed with
  // the ready file, and the stub turns into the player.
  import { onDestroy } from 'svelte';
  import { faPlay, faPause, faArrowRight, faChevronUp, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
  import Button from '../../ui/display/Button.svelte';
  import Icon from '../../ui/display/Icon.svelte';
  import { chatT } from '../i18n';
  import {
    isMediaProcessing, voiceBars, voiceProgress, playedBarCount, seekFraction, voiceDuration,
    voiceTimeLabel, formatDuration, transcribeResultText, voicePlayback,
  } from '../helpers';

  /** Tallest bar, px (a full-peak level). */
  const BAR_MAX_H = 20;
  /** Shortest bar, px — silence still shows as a dot. */
  const BAR_MIN_H = 2;
  /** Arrow-key seek step, seconds. */
  const SEEK_STEP = 5;

  let {
    message,
    me = false,
    /** @type {import('../types').AudioTranscribeHandler | undefined} */
    onTranscribe = undefined,
    processingLabel = chatT('chat.audio_processing', { defaultValue: 'Processing audio…' }),
    playLabel = chatT('chat.audio_play', { defaultValue: 'Play' }),
    pauseLabel = chatT('chat.audio_pause', { defaultValue: 'Pause' }),
    positionLabel = chatT('chat.audio_position', { defaultValue: 'Playback position' }),
    errorLabel = chatT('chat.audio_error', { defaultValue: "Couldn't play the voice message" }),
    transcribeLabel = chatT('chat.audio_transcribe', { defaultValue: 'Transcribe' }),
    hideTranscriptLabel = chatT('chat.audio_transcript_hide', { defaultValue: 'Hide transcript' }),
    transcribeFailedLabel = chatT('chat.audio_transcribe_failed', { defaultValue: "Couldn't transcribe the voice message" }),
  } = $props();

  let file = $derived(message.meta?.file ?? {});
  let processing = $derived(isMediaProcessing(file));

  /** @type {HTMLAudioElement | undefined} */
  let audio = $state();
  let playing = $state(false);
  let currentTime = $state(0);
  /** @type {number | null} */
  let mediaDuration = $state(null);
  let unplayable = $state(false);

  let duration = $derived(voiceDuration(file.duration, mediaDuration));
  let bars = $derived(voiceBars(file.waveform));
  let played = $derived(playedBarCount(voiceProgress(currentTime, duration), bars.length));
  let clock = $derived(voiceTimeLabel({ currentTime, duration, playing }));

  // Stable per-instance reference — the coordinator compares it on release.
  const stop = () => audio?.pause();

  // timeupdate fires ~4×/s; while playing, follow the element every frame so the highlight moves smoothly.
  $effect(() => {
    if (!playing || !audio || typeof requestAnimationFrame !== 'function') return;
    let raf = 0;
    const tick = () => {
      currentTime = audio?.currentTime ?? 0;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  onDestroy(() => {
    // A detached <audio> keeps playing — stop it with the row.
    audio?.pause();
    voicePlayback.release(stop);
  });

  function onPlay() {
    playing = true;
    unplayable = false;
    voicePlayback.claim(stop);
  }
  function onPause() {
    playing = false;
    voicePlayback.release(stop);
  }
  function onEnded() {
    playing = false;
    currentTime = 0;
    if (audio) audio.currentTime = 0;
    voicePlayback.release(stop);
  }
  function onError() {
    playing = false;
    unplayable = true;
    voicePlayback.release(stop);
  }
  function onMetadata() {
    mediaDuration = audio?.duration ?? null;
  }

  /** @param {Event} e */
  function toggle(e) {
    e.stopPropagation(); // a press on the player never reaches the row's tap-to-menu target
    if (!audio || unplayable) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    // Autoplay policy / a source the browser can't decode reject here; the latter also fires `error`.
    audio.play()?.catch?.(() => { playing = false; });
  }

  /** @param {number} fraction */
  function seek(fraction) {
    if (!audio || !duration) return;
    const t = fraction * duration;
    audio.currentTime = t;
    currentTime = t;
  }

  /** @param {MouseEvent & { currentTarget: HTMLElement }} e */
  function onWaveClick(e) {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    seek(seekFraction(e.clientX, r.left, r.width));
  }

  /** @param {KeyboardEvent} e */
  function onWaveKey(e) {
    if (!duration) return;
    /** @type {Record<string, number>} */
    const targets = {
      ArrowRight: currentTime + SEEK_STEP, ArrowUp: currentTime + SEEK_STEP,
      ArrowLeft: currentTime - SEEK_STEP, ArrowDown: currentTime - SEEK_STEP,
      Home: 0, End: duration,
    };
    if (!(e.key in targets)) return;
    e.preventDefault();
    seek(Math.min(1, Math.max(0, targets[e.key] / duration)));
  }

  // ── Transcript ──
  let canTranscribe = $derived(typeof onTranscribe === 'function');
  let transcriptOpen = $state(false);
  let transcribing = $state(false);
  let transcribeFailed = $state(false);
  let resolvedText = $state('');
  let transcript = $derived(typeof file.transcript === 'string' && file.transcript.trim() ? file.transcript : resolvedText);

  /** @param {Event} e */
  async function onTranscribeClick(e) {
    e.stopPropagation();
    if (transcribing || !onTranscribe) return;
    if (transcriptOpen) {
      transcriptOpen = false;
      return;
    }
    transcribeFailed = false;
    if (transcript) {
      transcriptOpen = true;
      return;
    }
    transcribing = true;
    try {
      resolvedText = transcribeResultText(await onTranscribe(message));
      transcriptOpen = true;
    } catch {
      transcribeFailed = true;
    } finally {
      transcribing = false;
    }
  }

  let barIdle = $derived(me ? 'bg-on-primary-container/30' : 'bg-on-surface-variant/35');
  let timeTone = $derived(me ? 'text-on-primary-container/70' : 'text-on-surface-variant');
</script>

{#if processing}
  <!-- The player's own skeleton (same row, same height), so the bubble doesn't change shape when
       the transcode finishes: a spinner in place of play, still bars, the label in the time slot. -->
  <div class="px-1 pt-1" role="status" data-testid="chat-audio-processing">
    <div class="flex items-center gap-2.5">
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary" aria-hidden="true">
        <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </span>
      <div class="flex min-w-0 flex-col gap-1">
        <div class="flex h-5 animate-pulse items-end gap-px" aria-hidden="true">
          {#each bars as level, i (i)}
            <span class="w-[2px] shrink-0 rounded-full {barIdle}" style="height:{Math.max(BAR_MIN_H, Math.round(level * BAR_MAX_H))}px"></span>
          {/each}
        </div>
        <span class="h-4 truncate text-[11px] leading-4 {timeTone}">{processingLabel}</span>
      </div>
    </div>
  </div>
{:else if file.url}
  <div class="px-1 pt-1" data-testid="chat-audio">
    <!-- svelte-ignore a11y_media_has_caption -->
    <audio
      bind:this={audio}
      src={file.url}
      preload="metadata"
      class="hidden"
      onplay={onPlay}
      onpause={onPause}
      onended={onEnded}
      onerror={onError}
      onloadedmetadata={onMetadata}
      ondurationchange={onMetadata}
      ontimeupdate={() => { currentTime = audio?.currentTime ?? 0; }}
    ></audio>

    <div class="flex items-center gap-2.5">
      <Button
        variant="filled"
        color="primary"
        class="h-10 w-10 shrink-0 px-0"
        aria-label={unplayable ? errorLabel : playing ? pauseLabel : playLabel}
        title={unplayable ? errorLabel : undefined}
        disabled={unplayable}
        onclick={toggle}
        data-testid="chat-audio-play"
        data-state={unplayable ? 'error' : playing ? 'playing' : 'paused'}
      >
        {#if unplayable}
          <Icon icon={faTriangleExclamation} />
        {:else if playing}
          <Icon icon={faPause} />
        {:else}
          <Icon icon={faPlay} class="translate-x-px" />
        {/if}
      </Button>

      <div class="flex min-w-0 flex-col gap-1">
        <div
          role="slider"
          tabindex="0"
          aria-label={positionLabel}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration ?? 0)}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={duration ? `${formatDuration(currentTime)} / ${formatDuration(duration)}` : formatDuration(currentTime)}
          class="flex h-5 cursor-pointer items-end gap-px rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onclick={onWaveClick}
          onkeydown={onWaveKey}
          data-testid="chat-audio-wave"
        >
          {#each bars as level, i (i)}
            <span
              class="w-[2px] shrink-0 rounded-full {i < played ? 'bg-primary' : barIdle}"
              style="height:{Math.max(BAR_MIN_H, Math.round(level * BAR_MAX_H))}px"
              data-testid="chat-audio-bar"
              data-played={i < played}
            ></span>
          {/each}
        </div>
        <span class="h-4 text-[11px] leading-4 tabular-nums {timeTone}" data-testid="chat-audio-time">{clock}</span>
      </div>

      {#if canTranscribe}
        <Button
          variant="icon"
          size="sm"
          class="h-7 w-8 shrink-0 gap-0.5 rounded-lg bg-primary/12 text-primary hover:bg-primary/20"
          aria-label={transcriptOpen ? hideTranscriptLabel : transcribeLabel}
          aria-expanded={transcriptOpen}
          title={transcriptOpen ? hideTranscriptLabel : transcribeLabel}
          loading={transcribing}
          onclick={onTranscribeClick}
          data-testid="chat-audio-transcribe"
        >
          {#if transcribing}
            <!-- the Button's own spinner -->
          {:else if transcriptOpen}
            <Icon icon={faChevronUp} />
          {:else}
            <Icon icon={faArrowRight} class="text-[9px]" />
            <span class="text-label-md font-bold leading-none">A</span>
          {/if}
        </Button>
      {/if}
    </div>

    {#if transcribeFailed}
      <p class="mt-1 text-body-sm text-error" data-testid="chat-audio-transcribe-failed">{transcribeFailedLabel}</p>
    {/if}
    {#if transcriptOpen && transcript}
      <p class="mt-1.5 whitespace-pre-wrap break-words text-body-md" data-testid="chat-audio-transcript">{transcript}</p>
    {/if}
  </div>
{/if}

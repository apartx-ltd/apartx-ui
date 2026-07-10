import type { SlotSet } from './registry.svelte';
import MessageBodyDefault from './slots/MessageBodyDefault.svelte';
import ImageMedia from './slots/ImageMedia.svelte';
import VideoMedia from './slots/VideoMedia.svelte';
import AudioMedia from './slots/AudioMedia.svelte';
import DocumentMedia from './slots/DocumentMedia.svelte';

// Generic media message-type → slot map (image/video/audio/document). Media rendering is not
// app-specific, so it lives in the kit; hosts spread this into their own registry alongside their
// business types: `setMessageRendererRegistry({ ...mediaSlots, ...businessTypes })`.
// The caption body is just the default text body (a caption is inline message.text) — no separate slot.
export const mediaSlots: Record<string, SlotSet> = {
  image: { body: MessageBodyDefault, media: ImageMedia },
  video: { body: MessageBodyDefault, media: VideoMedia },
  audio: { body: MessageBodyDefault, media: AudioMedia },
  document: { body: MessageBodyDefault, media: DocumentMedia },
};

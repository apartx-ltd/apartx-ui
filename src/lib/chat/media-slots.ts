import type { SlotSet } from './registry.svelte';
import MessageBodyDefault from './slots/MessageBodyDefault.svelte';
import MediaAttachments from './slots/MediaAttachments.svelte';

// Generic media message-type → slot map (image/video/audio/document). Media rendering is not
// app-specific, so it lives in the kit; hosts spread this into their own registry alongside their
// business types: `setMessageRendererRegistry({ ...mediaSlots, ...businessTypes })`.
// The caption body is just the default text body (a caption is inline message.text) — no separate slot.
//
// Все четыре типа получают ОДИН слот-диспетчер: сообщение может нести несколько вложений, и что
// именно рисовать — одиночный ImageMedia/VideoMedia/AudioMedia/DocumentMedia или альбом — решает
// MediaAttachments по количеству вложений, а не по типу сообщения (у смешанного альбома тип задаёт
// первое вложение).
export const mediaSlots: Record<string, SlotSet> = {
  image: { body: MessageBodyDefault, media: MediaAttachments },
  video: { body: MessageBodyDefault, media: MediaAttachments },
  audio: { body: MessageBodyDefault, media: MediaAttachments },
  document: { body: MessageBodyDefault, media: MediaAttachments },
};

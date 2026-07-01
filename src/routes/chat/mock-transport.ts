import type { ChatTransport, LiveEvent, Message, OutgoingDraft } from '$lib/chat';

const CHAT_ID = 'demo-chat';
const ME = 'me';
const THEM = 'them';

/** Controller exposing demo levers beyond the ChatTransport interface. */
export interface MockController {
  transport: ChatTransport;
  /** Push a new incoming message from the other party. */
  injectInbound(text?: string): void;
  /** Push a new incoming photo message (type 'image' with meta.images). */
  injectPhoto(): void;
  /** Push a new incoming video message (type 'video' with meta { src, poster, mime }). */
  injectVideo(): void;
  /** Push an AI assistant message: shows "typing…" then live-upserts the answer. */
  injectAi(): void;
  /** When true, the next sendMessage() rejects (to demo failed → retry). */
  failNextSend: boolean;
  /** When true, the next fetchOlder() rejects (to demo olderStatus 'error'). */
  failNextFetch: boolean;
  /** Emit a delete live-event for the newest message. */
  deleteNewest(hard: boolean): void;
  dispose(): void;
}

const THEM_LINES = [
  'Hi! Is the apartment still available?',
  'Great — what time can I check in?',
  'Could you send the address again?',
  'Thanks, see you then 👍',
];

const AI = 'ai-assistant';
const AI_ANSWERS = [
  'Check-in is from 14:00. The lockbox code will be sent 1 hour before arrival.',
  'The apartment is a 7-minute walk from the metro. I can share a map pin if helpful.',
  'Yes, early check-in is possible for an extra fee — would you like me to request it?',
];

type Photo = { src: string; alt: string };
const photo = (seed: string, alt: string): Photo => ({ src: `https://picsum.photos/seed/${seed}/480/360`, alt });

// Reusable photo sets for the demo's media messages (single image and galleries).
const PHOTO_SETS: Photo[][] = [
  [photo('apartx-balcony', 'Balcony view')],
  [photo('apartx-living', 'Living room'), photo('apartx-kitchen', 'Kitchen'), photo('apartx-bedroom', 'Bedroom')],
  [photo('apartx-street', 'Street view'), photo('apartx-lobby', 'Lobby')],
];

// A public sample clip for the demo's video messages.
const VIDEO = {
  src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  poster: 'https://picsum.photos/seed/apartx-tour/480/270',
  mime: 'video/mp4',
};

function buildHistory(): Message[] {
  const now = Date.now();
  const out: Message[] = [];
  const total = 60;
  for (let i = 0; i < total; i++) {
    const seq = i + 1;
    const mine = i % 2 === 0;
    const createdAt = new Date(now - (total - i) * 60_000);
    if (seq === 3) {
      out.push({ _id: `h${seq}`, chatId: CHAT_ID, seq, type: 'system', text: 'Tenant joined the chat', createdAt });
      continue;
    }
    if (seq === 8) {
      out.push({ _id: `h${seq}`, chatId: CHAT_ID, seq, userId: ME, type: 'booking', text: 'Booking #A-1042', createdAt, delivery: 'read', meta: { checkIn: '2026-07-02', checkOut: '2026-07-09', guests: 2 } });
      continue;
    }
    if (seq === 15) {
      // An older media message (visible after scrolling up to load earlier pages).
      out.push({ _id: `h${seq}`, chatId: CHAT_ID, seq, userId: THEM, type: 'image', text: 'Here is the view from the balcony 🌇', createdAt, meta: { images: PHOTO_SETS[0] } });
      continue;
    }
    if (seq === 50) {
      out.push({ _id: `h${seq}`, chatId: CHAT_ID, seq, userId: THEM, type: 'image', text: 'Here is the view from the balcony 🌇', createdAt, meta: { images: PHOTO_SETS[0] } });
      continue;
    }
    if (seq === 54) {
      // A gallery in the initial window so media is visible on load.
      out.push({ _id: `h${seq}`, chatId: CHAT_ID, seq, userId: ME, type: 'image', text: 'Sending a few shots of the place', createdAt, delivery: 'read', meta: { images: PHOTO_SETS[1] } });
      continue;
    }
    if (seq === 57) {
      // A video message in the initial window.
      out.push({ _id: `h${seq}`, chatId: CHAT_ID, seq, userId: THEM, type: 'video', text: 'Quick walkthrough of the apartment 🎬', createdAt, meta: VIDEO });
      continue;
    }
    if (seq === 58) {
      // An AI assistant message in the initial window.
      out.push({ _id: `h${seq}`, chatId: CHAT_ID, seq, userId: AI, type: 'ai', text: AI_ANSWERS[0], createdAt });
      continue;
    }
    if (!mine && (seq === 56 || seq === 60)) {
      // The two newest incoming plain messages, seeded unread so the unread divider shows on load.
      out.push({ _id: `h${seq}`, chatId: CHAT_ID, seq, userId: THEM, text: THEM_LINES[i % THEM_LINES.length], createdAt, read: false });
      continue;
    }
    out.push({
      _id: `h${seq}`, chatId: CHAT_ID, seq, userId: mine ? ME : THEM,
      text: mine ? `Sure, message ${seq}.` : THEM_LINES[i % THEM_LINES.length],
      createdAt, delivery: mine ? 'read' : undefined,
    });
  }
  return out;
}

export function createMockTransport(): MockController {
  const history = buildHistory();              // ascending by seq
  let maxSeq = history.length;
  let emit: (e: LiveEvent) => void = () => {};
  let inboundTimer: ReturnType<typeof setInterval> | null = null;
  const timers: ReturnType<typeof setTimeout>[] = [];
  // Ordered ids of live (non-deleted) messages, newest last — so deleteNewest targets the real newest
  // regardless of whether it was sent (`s…`) or inbound (`in…`).
  const liveIds: string[] = history.map((m) => m._id);

  const ctl: MockController = {
    failNextSend: false,
    failNextFetch: false,
    transport: {
      async fetchOlder({ before, limit }) {
        await delay(450);
        if (ctl.failNextFetch) { ctl.failNextFetch = false; throw new Error('mock fetch failure'); }
        const older = before ? history.filter((mm) => mm.createdAt < before!) : history;
        return older.slice(Math.max(0, older.length - limit));
      },
      subscribeLive(_chatId, onEvent) {
        emit = onEvent;
        inboundTimer = setInterval(() => ctl.injectInbound(), 9_000);
        return () => { if (inboundTimer) clearInterval(inboundTimer); inboundTimer = null; emit = () => {}; };
      },
      async sendMessage(draft: OutgoingDraft) {
        // Allocate the seq at submission time (mirrors a real server appending in submit order), BEFORE the
        // network delay — otherwise an inbound arriving during the delay would grab a lower seq and sort above
        // the message the user already hit Send on.
        const seq = ++maxSeq;
        const id = `s${seq}`;
        await delay(500);
        if (ctl.failNextSend) { ctl.failNextSend = false; throw new Error('mock send failure'); }
        const server: Message = {
          _id: id, chatId: CHAT_ID, seq, userId: ME, text: draft.text,
          createdAt: new Date(), delivery: 'sent',
          meta: { clientToken: draft.clientToken, replyMessageId: draft.replyMessageId },
        };
        liveIds.push(id);
        timers.push(setTimeout(() => emit({ type: 'upsert', message: { ...server, delivery: 'delivered' } }), 900));
        timers.push(setTimeout(() => emit({ type: 'upsert', message: { ...server, delivery: 'read' } }), 2_400));
        return server;
      },
      async markRead() { await delay(50); }, // receives { chatId, message }
    },
    injectInbound(text?: string) {
      const seq = ++maxSeq;
      const id = `in${seq}`;
      liveIds.push(id);
      emit({
        type: 'upsert',
        message: { _id: id, chatId: CHAT_ID, seq, userId: THEM, text: text ?? THEM_LINES[seq % THEM_LINES.length], createdAt: new Date() },
      });
    },
    injectPhoto() {
      const seq = ++maxSeq;
      const id = `in${seq}`;
      liveIds.push(id);
      emit({
        type: 'upsert',
        message: { _id: id, chatId: CHAT_ID, seq, userId: THEM, type: 'image', text: 'Sharing a couple of photos 📸', createdAt: new Date(), meta: { images: PHOTO_SETS[2] } },
      });
    },
    injectVideo() {
      const seq = ++maxSeq;
      const id = `in${seq}`;
      liveIds.push(id);
      emit({
        type: 'upsert',
        message: { _id: id, chatId: CHAT_ID, seq, userId: THEM, type: 'video', text: 'Sending a short clip 🎬', createdAt: new Date(), meta: VIDEO },
      });
    },
    injectAi() {
      const seq = ++maxSeq;
      const id = `in${seq}`;
      liveIds.push(id);
      const answer = AI_ANSWERS[seq % AI_ANSWERS.length];
      const base = { _id: id, chatId: CHAT_ID, seq, userId: AI, type: 'ai', createdAt: new Date() } as const;
      const tokens = answer.split(' ');
      const startDelay = 400;   // brief "typing…" before the first token
      const perToken = 70;      // generation speed (ms per token)
      // Show "typing…" first, then stream the answer token-by-token via repeated live-upserts of the same id.
      emit({ type: 'upsert', message: { ...base, text: '', meta: { pending: true } } });
      for (let i = 0; i < tokens.length; i++) {
        const partial = tokens.slice(0, i + 1).join(' ');
        const last = i === tokens.length - 1;
        timers.push(setTimeout(
          () => emit({ type: 'upsert', message: { ...base, text: partial, meta: last ? undefined : { streaming: true } } }),
          startDelay + i * perToken,
        ));
      }
    },
    deleteNewest(hard: boolean) {
      const id = liveIds[liveIds.length - 1];
      if (!id) return;
      if (hard) liveIds.pop();
      emit({ type: 'delete', targetId: id, hard });
    },
    dispose() {
      if (inboundTimer) clearInterval(inboundTimer);
      timers.forEach(clearTimeout);
    },
  };
  return ctl;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

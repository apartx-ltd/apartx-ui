<script lang="ts">
  // Source-messenger badge for a message (inbound WhatsApp/Telegram/OTA, or an explicit
  // `meta.messenger` channel tag). Maps the messenger key (see helpers.messengerKey) to a
  // brand/solid icon + brand color. Renders nothing for native in-app messages.
  import Fa from 'svelte-fa';
  import { faWhatsapp, faTelegram, faAirbnb } from '@fortawesome/free-brands-svg-icons';
  import { faHotel, faGroupArrowsRotate, faEnvelope } from '@fortawesome/free-solid-svg-icons';
  import type { Message } from '../types';
  import { messengerKey } from '../helpers';

  let { message, class: className = '' }: { message: Message; class?: string } = $props();

  const MAP: Record<string, { icon: any; color: string }> = {
    whatsapp: { icon: faWhatsapp, color: '#0dc143' },
    telegram: { icon: faTelegram, color: '#0088cc' },
    telegram_bot: { icon: faTelegram, color: '#0088cc' },
    airbnb: { icon: faAirbnb, color: '#FF5A5F' },
    'booking.com': { icon: faHotel, color: '#003580' },
    channex: { icon: faGroupArrowsRotate, color: '#0088cc' },
    email: { icon: faEnvelope, color: '#6b7280' },
  };

  const info = $derived.by(() => {
    const key = messengerKey(message);
    return key ? MAP[key] ?? null : null;
  });
</script>

{#if info}
  <Fa icon={info.icon} class={className} style="color: {info.color}" />
{/if}

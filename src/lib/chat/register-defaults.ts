import { setDefaultSlots } from './registry.svelte';
import MessageHeaderDefault from './slots/MessageHeaderDefault.svelte';
import MessageBodyDefault from './slots/MessageBodyDefault.svelte';
import MessageTimeDefault from './slots/MessageTimeDefault.svelte';

/** Install the kit's default slots. Hosts call this once before registering their own type slots. */
export function registerChatDefaults(): void {
  setDefaultSlots({ header: MessageHeaderDefault, body: MessageBodyDefault, time: MessageTimeDefault });
}

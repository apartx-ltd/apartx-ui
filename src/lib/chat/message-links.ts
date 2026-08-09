// Chat special-link contract, mirror of the server side (apartx-server
// whatsapp/telegram utils): AI emits [title](#/<type>/<id>); legacy path forms
// /show/:id and /accounts/my-bookings/:id are kept from the React-era cabinet.
export type ChatLinkType = 'booking' | 'property' | 'article' | 'search' | 'external';

export interface ChatLink {
  type: ChatLinkType;
  /** Entity id; for 'search' — the query string after '#/search/' (e.g. '?q=x'); '' for external. */
  entityId: string;
  /** The original href as written in the message. */
  href: string;
}

const HASH_ENTITY = /^\/(booking|property|article)\/([a-zA-Z0-9]+)$/;
const HASH_SEARCH = /^\/search\/(.*)$/;
const PATH_PROPERTY = /^\/show\/([a-zA-Z0-9]+)$/;
const PATH_BOOKING = /^\/accounts\/my-bookings\/([a-zA-Z0-9]+)$/;

export function classifyChatLink(href: string, baseUrl?: string): ChatLink {
  const external: ChatLink = { type: 'external', entityId: '', href };
  let url: URL;
  try {
    url = new URL(href, baseUrl ?? 'http://chat-link.internal');
  } catch {
    return external;
  }
  if (url.hash) {
    const hashPath = decodeURI(url.hash.substring(1));
    const entity = HASH_ENTITY.exec(hashPath);
    if (entity) return { type: entity[1] as ChatLinkType, entityId: entity[2], href };
    const search = HASH_SEARCH.exec(hashPath);
    if (search) return { type: 'search', entityId: search[1], href };
    return external;
  }
  const property = PATH_PROPERTY.exec(url.pathname);
  if (property) return { type: 'property', entityId: property[1], href };
  const booking = PATH_BOOKING.exec(url.pathname);
  if (booking) return { type: 'booking', entityId: booking[1], href };
  return external;
}

// Chat special-link contract, mirror of the server side (apartx-server whatsapp/telegram
// utils): AI emits [title](#/<type>/<id>). The kit only knows the SHAPE — `#/<type>/<rest>`
// — plus `external`; which types exist and any host path forms (e.g. a legacy `/show/:id`)
// come from the host through the slot context (`linkTypes`, `linkPaths`), so the kit carries
// no product routes.
export type ChatLinkType = string;

export interface ChatLink {
  /** Hash type token (`booking`, `article`, …, whatever the host registers) or 'external'. */
  type: ChatLinkType;
  /** Everything after `#/<type>/` — an id, or a query string for search-like links; '' for external. */
  entityId: string;
  /** The original href as written in the message. */
  href: string;
}

/** A host path form: `pattern` matched against the pathname, group 1 is the entity id. */
export interface ChatLinkPathRule {
  pattern: RegExp;
  type: ChatLinkType;
}

export interface ChatLinkRules {
  /** Base for resolving relative hrefs (host origin). */
  baseUrl?: string;
  /** Known hash types; when set, `#/<other>/…` is external. Unset — any `#/<type>/<rest>` is accepted. */
  types?: readonly ChatLinkType[];
  /** Host path forms, first match wins. */
  paths?: readonly ChatLinkPathRule[];
}

const HASH_LINK = /^\/([a-z][a-z0-9_-]*)\/(.+)$/;

export function classifyChatLink(href: string, rules: ChatLinkRules = {}): ChatLink {
  const external: ChatLink = { type: 'external', entityId: '', href };
  let url: URL;
  try {
    url = new URL(href, rules.baseUrl ?? 'http://chat-link.internal');
  } catch {
    return external;
  }
  if (url.hash) {
    const match = HASH_LINK.exec(decodeURI(url.hash.substring(1)));
    if (!match) return external;
    const [, type, entityId] = match;
    if (type === 'external') return external;
    if (rules.types && !rules.types.includes(type)) return external;
    return { type, entityId, href };
  }
  for (const rule of rules.paths ?? []) {
    const match = rule.pattern.exec(url.pathname);
    if (match) return { type: rule.type, entityId: match[1] ?? '', href };
  }
  return external;
}

// Chat markdown dialect: GFM (marked built-ins) + Telegram-flavored extensions.
// Lexer ONLY — rendering is done by Svelte components (MarkdownTokens.svelte),
// never {@html}: unknown/html tokens are displayed as plain text, which is the
// entire sanitization story (same stance as react-markdown v5 defaults).
import { Marked } from 'marked';
import * as linkify from 'linkifyjs';

// Inline dialect extensions. Custom extensions run BEFORE marked's built-in
// tokenizers, which is what lets __underline__ beat **strong** for '__'.
const spoiler = {
  name: 'spoiler',
  level: 'inline' as const,
  start(src: string) {
    const i = src.indexOf('||');
    return i < 0 ? undefined : i;
  },
  tokenizer(this: any, src: string) {
    const m = /^\|\|([\s\S]+?)\|\|/.exec(src);
    if (!m) return undefined;
    return { type: 'spoiler', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
  },
};

const underline = {
  name: 'underline',
  level: 'inline' as const,
  start(src: string) {
    const i = src.indexOf('__');
    return i < 0 ? undefined : i;
  },
  tokenizer(this: any, src: string) {
    const m = /^__(?!_)([\s\S]*?[^_])__(?!_)/.exec(src);
    if (!m) return undefined;
    return { type: 'underline', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
  },
};

// Single tilde = subscript (Telegram/pandoc style); '~~' stays GFM strikethrough,
// so the regex forbids a tilde right after the opener.
const sub = {
  name: 'sub',
  level: 'inline' as const,
  start(src: string) {
    const i = src.indexOf('~');
    return i < 0 ? undefined : i;
  },
  tokenizer(this: any, src: string) {
    const m = /^~(?!~)([^~\s](?:[^~\n]*[^~\s])?)~(?!~)/.exec(src);
    if (!m) return undefined;
    return { type: 'sub', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
  },
};

const sup = {
  name: 'sup',
  level: 'inline' as const,
  start(src: string) {
    const i = src.indexOf('^');
    return i < 0 ? undefined : i;
  },
  tokenizer(this: any, src: string) {
    const m = /^\^([^^\s](?:[^^\n]*[^^\s])?)\^/.exec(src);
    if (!m) return undefined;
    return { type: 'sup', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
  },
};

// Telegram MarkdownV2 expandable blockquote: first line starts '**>', block ends
// with '||' (continuation lines keep the '>' prefix).
const expandableQuote = {
  name: 'expandableQuote',
  level: 'block' as const,
  start(src: string) {
    const m = /(^|\n)\*\*>/.exec(src);
    return m ? m.index + m[1].length : undefined;
  },
  tokenizer(this: any, src: string) {
    const m = /^\*\*>([\s\S]*?)\|\|[ \t]*(?:\n+|$)/.exec(src);
    if (!m) return undefined;
    const inner = m[1].replace(/\n>[ ]?/g, '\n').trim();
    return { type: 'expandableQuote', raw: m[0], tokens: this.lexer.blockTokens(inner, []) };
  },
};

// GFM footnotes, minimal: inline ref [^label], block def '[^label]: text'.
const footnoteDef = {
  name: 'footnoteDef',
  level: 'block' as const,
  start(src: string) {
    const m = /(^|\n)\[\^/.exec(src);
    return m ? m.index + m[1].length : undefined;
  },
  tokenizer(this: any, src: string) {
    const m = /^\[\^([^\]]+)\]:[ \t]*([^\n]*)(?:\n+|$)/.exec(src);
    if (!m) return undefined;
    return { type: 'footnoteDef', raw: m[0], label: m[1], tokens: this.lexer.inlineTokens(m[2]) };
  },
};

const footnoteRef = {
  name: 'footnoteRef',
  level: 'inline' as const,
  start(src: string) {
    const i = src.indexOf('[^');
    return i < 0 ? undefined : i;
  },
  tokenizer(_src: string) {
    const m = /^\[\^([^\]]+)\]/.exec(_src);
    if (!m) return undefined;
    return { type: 'footnoteRef', raw: m[0], label: m[1] };
  },
};

const md = new Marked({ gfm: true, breaks: true });
md.use({ extensions: [spoiler, underline, sub, sup, expandableQuote, footnoteDef, footnoteRef] as any });

export function lexMessage(text: string): any[] {
  return md.lexer(text ?? '');
}

// Plain-mode auto-linkify: linkifyjs spans + newline breaks, merged into an
// ordered part list. Rewritten from the React LinkifyText.coffee, whose tail
// handling dropped the last character — covered by a test here.
export type PlainPart =
  | { kind: 'text'; text: string }
  | { kind: 'br' }
  | { kind: 'link'; text: string; href: string };

export function linkifyParts(text: string): PlainPart[] {
  const source = text ?? '';
  const marks: Array<{ start: number; end: number; part: PlainPart }> = [];
  for (const found of linkify.find(source)) {
    marks.push({ start: found.start, end: found.end, part: { kind: 'link', text: found.value, href: found.href } });
  }
  for (const nl of source.matchAll(/\n/g)) {
    marks.push({ start: nl.index!, end: nl.index! + 1, part: { kind: 'br' } });
  }
  marks.sort((a, b) => a.start - b.start);
  const parts: PlainPart[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start > cursor) parts.push({ kind: 'text', text: source.substring(cursor, mark.start) });
    parts.push(mark.part);
    cursor = mark.end;
  }
  if (cursor < source.length) parts.push({ kind: 'text', text: source.substring(cursor) });
  if (!parts.length) parts.push({ kind: 'text', text: source });
  return parts;
}

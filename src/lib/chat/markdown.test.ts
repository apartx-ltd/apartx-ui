import { describe, it, expect } from 'vitest';
import { lexMessage, linkifyParts } from './markdown';

// Walk every nested token array marked produces (inline tokens, list items,
// table header cells, table row cells). Guarded by Array.isArray: a table cell
// carries a boolean `header` flag, not an array.
const kids = (t: any): any[] => ['tokens', 'items', 'header', 'rows']
  .flatMap((key) => (Array.isArray(t[key]) ? t[key].flat() : []));
const flat = (tokens: any[]): any[] => tokens.flatMap((t) => [t, ...flat(kids(t))]);
const find = (tokens: any[], type: string) => flat(tokens).find((t) => t.type === type);

describe('lexMessage (GFM tier)', () => {
  it('lexes bold, italic, strike, links, lists, blockquote, code, hr, heading, table', () => {
    const md = [
      '# Заголовок', '', '**жирный** *курсив* ~~зачёркнутый~~ `код`', '',
      '- пункт 1', '- пункт 2', '', '> цитата', '', '---', '',
      '| A | B |', '| --- | --- |', '| 1 | 2 |', '',
      '[статья](#/article/a1)',
    ].join('\n');
    const tokens = lexMessage(md);
    expect(find(tokens, 'heading')).toBeTruthy();
    expect(find(tokens, 'strong')).toBeTruthy();
    expect(find(tokens, 'em')).toBeTruthy();
    expect(find(tokens, 'del')).toBeTruthy();
    expect(find(tokens, 'codespan')).toBeTruthy();
    expect(find(tokens, 'list')).toBeTruthy();
    expect(find(tokens, 'blockquote')).toBeTruthy();
    expect(find(tokens, 'hr')).toBeTruthy();
    expect(find(tokens, 'table')).toBeTruthy();
    expect(find(tokens, 'link')).toMatchObject({ href: '#/article/a1' });
  });

  it('single newline becomes br (messenger style)', () => {
    expect(find(lexMessage('a\nb'), 'br')).toBeTruthy();
  });
});

describe('lexMessage (dialect tier)', () => {
  it('spoiler ||…||', () => {
    const tok = find(lexMessage('это ||секрет|| текст'), 'spoiler');
    expect(tok).toBeTruthy();
    expect(tok.tokens[0].raw).toBe('секрет');
  });
  it('underline __…__ wins over strong for double underscore', () => {
    const tokens = lexMessage('__подчёркнутый__ и **жирный**');
    expect(find(tokens, 'underline')).toBeTruthy();
    expect(find(tokens, 'strong')).toBeTruthy();
  });
  it('sub ~x~ and sup ^x^; ~~strike~~ still wins', () => {
    const tokens = lexMessage('H~2~O и x^2^ и ~~нет~~');
    expect(find(tokens, 'sub')).toBeTruthy();
    expect(find(tokens, 'sup')).toBeTruthy();
    expect(find(tokens, 'del')).toBeTruthy();
  });
  it('expandable blockquote **> … ||', () => {
    const tok = find(lexMessage('**>скрытая\n>цитата||'), 'expandableQuote');
    expect(tok).toBeTruthy();
  });
  it('footnote ref + def', () => {
    const tokens = lexMessage('текст[^1]\n\n[^1]: сноска');
    expect(find(tokens, 'footnoteRef')).toMatchObject({ label: '1' });
    expect(find(tokens, 'footnoteDef')).toMatchObject({ label: '1' });
  });
});

describe('linkifyParts (plain mode)', () => {
  it('splits text / link / br and keeps the last character', () => {
    const parts = linkifyParts('смотри https://example.com/x\nконец!');
    expect(parts).toEqual([
      { kind: 'text', text: 'смотри ' },
      { kind: 'link', text: 'https://example.com/x', href: 'https://example.com/x' },
      { kind: 'br' },
      { kind: 'text', text: 'конец!' },
    ]);
  });
  it('plain text without links is a single part', () => {
    expect(linkifyParts('просто текст')).toEqual([{ kind: 'text', text: 'просто текст' }]);
  });
});

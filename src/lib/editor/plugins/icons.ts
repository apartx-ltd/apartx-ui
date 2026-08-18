// Иконки панелей редактора — инлайновым SVG.
//
// Не тянем сюда fontawesome: панели строятся императивным DOM'ом внутри ProseMirror-плагинов,
// и заводить ради них Svelte-рендер (а с ним mount/unmount на каждое обновление селекции)
// дороже, чем два десятка path'ов. Все иконки — 24×24, `currentColor`, штрих 2.

const stroke = (path: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

export const icons = {
  bold: stroke('<path d="M6 4h7a4 4 0 0 1 0 8H6z"/><path d="M6 12h8a4 4 0 0 1 0 8H6z"/>'),
  italic: stroke('<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>'),
  underline: stroke('<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/>'),
  strike: stroke('<path d="M16 4H9a3 3 0 0 0-2.8 4"/><path d="M14 12a4 4 0 0 1-1 8H8"/><line x1="4" y1="12" x2="20" y2="12"/>'),
  highlight: stroke('<path d="m9 11-6 6v3h3l6-6"/><path d="m22 5-3-3-9 9 3 3z"/>'),
  code: stroke('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  codeBlock: stroke('<rect x="3" y="4" width="18" height="16" rx="2"/><polyline points="10 10 8 12 10 14"/><polyline points="14 10 16 12 14 14"/>'),
  link: stroke('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
  unlink: stroke('<path d="M17 7l3-3a5 5 0 0 1 0 7l-2 2"/><path d="M7 17l-3 3"/><line x1="2" y1="2" x2="22" y2="22"/>'),
  bulletList: stroke('<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>'),
  orderedList: stroke('<line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><path d="M4 4h1v4"/><path d="M3.6 11.5c.6-.7 1.8-.6 1.8.4 0 .8-1.6 1.3-1.9 2.6H5.6"/>'),
  quote: stroke('<path d="M7 15a4 4 0 1 1 0-8v0a4 4 0 0 0 4 4"/><path d="M17 15a4 4 0 1 1 0-8v0a4 4 0 0 0 4 4"/>'),
  hr: stroke('<line x1="3" y1="12" x2="21" y2="12"/>'),
  table: stroke('<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="10" x2="9" y2="20"/><line x1="15" y1="10" x2="15" y2="20"/>'),
  image: stroke('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5L5 20"/>'),
  variable: stroke('<path d="M8 4C6 8 6 16 8 20"/><path d="M16 4c2 4 2 12 0 16"/><line x1="10" y1="12" x2="14" y2="12"/>'),
  undo: stroke('<path d="M3 8h11a5 5 0 0 1 0 10H9"/><polyline points="7 4 3 8 7 12"/>'),
  redo: stroke('<path d="M21 8H10a5 5 0 0 0 0 10h5"/><polyline points="17 4 21 8 17 12"/>'),
  text: stroke('<polyline points="4 7 4 5 20 5 20 7"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="9" y1="19" x2="15" y2="19"/>'),
  plus: stroke('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
  drag: stroke('<circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/>'),
  check: stroke('<polyline points="20 6 9 17 4 12"/>'),
  trash: stroke('<polyline points="3 6 21 6"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>'),
  open: stroke('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
  rowAfter: stroke('<rect x="3" y="4" width="18" height="6" rx="1"/><line x1="12" y1="14" x2="12" y2="20"/><line x1="9" y1="17" x2="15" y2="17"/>'),
  colAfter: stroke('<rect x="4" y="3" width="6" height="18" rx="1"/><line x1="17" y1="9" x2="17" y2="15"/><line x1="14" y1="12" x2="20" y2="12"/>'),
};

/** Заголовки в меню — цифрой, а не иконкой: так короче и понятнее. */
export function headingIcon(level: number): string {
  return `<span aria-hidden="true" style="font-weight:600;font-size:0.95rem">H${level}</span>`;
}

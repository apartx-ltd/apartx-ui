import { describe, it, expect } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { editorSchema } from './schema';
import { insertImage, insertTable } from './commands';
import { parseMarkdown } from './markdown';

/**
 * Команды, у которых есть арифметика позиций.
 *
 * Остальные — тонкие обёртки над prosemirror-commands, их проверять нечего. А вот вставка
 * таблицы сама ищет первую ячейку, и промах по позиции стоит либо исключения, либо
 * выделения НА ячейке вместо текста внутри (ProseMirror ругается «endpoint not pointing
 * into a node with inline content»).
 */

const stateFrom = (markdown: string) =>
  EditorState.create({ schema: editorSchema, doc: parseMarkdown(markdown) });

/** Применить команду и вернуть получившееся состояние. */
function apply(state: EditorState, command = insertTable(3, 3)) {
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next };
}

describe('insertImage', () => {
  it('вставляет узел со всеми тремя атрибутами', () => {
    const { ok, state } = apply(
      stateFrom(''),
      insertImage('https://cdn.example.com/plan.png', 'Схема', 'Как добраться'),
    );
    expect(ok).toBe(true);

    const image = state.doc.firstChild?.firstChild;
    expect(image?.type.name).toBe('image');
    expect(image?.attrs).toMatchObject({
      src: 'https://cdn.example.com/plan.png',
      alt: 'Схема',
      title: 'Как добраться',
    });
  });

  it('пустые alt и title не попадают в атрибуты (в md не будет пустых кавычек)', () => {
    const { state } = apply(stateFrom(''), insertImage('https://x/y.png'));
    const image = state.doc.firstChild?.firstChild;
    expect(image?.attrs.alt ?? null).toBeNull();
    expect(image?.attrs.title ?? null).toBeNull();
  });
});

describe('insertTable', () => {
  // Регрессия: позицию таблицы считали как «текущее выделение минус nodeSize», исходя из
  // того, что курсор после вставки стоит ЗА таблицей. Он стоит внутри неё — в последней
  // ячейке, — и на пустом документе разность уходила в минус: RangeError «Position -3 out
  // of range», таблица не появлялась вовсе.
  it('вставляется в пустой документ', () => {
    const { ok, state } = apply(stateFrom(''));
    expect(ok).toBe(true);

    const table = state.doc.firstChild;
    expect(table?.type.name).toBe('table');
    expect(table?.childCount).toBe(3);
    expect(table?.firstChild?.childCount).toBe(3);
    expect(table?.firstChild?.firstChild?.type.name).toBe('table_header');
  });

  it('ставит курсор в первую ячейку — текст едет в шапку', () => {
    const { state } = apply(stateFrom(''));
    const next = state.apply(state.tr.insertText('Услуга'));

    expect(next.doc.firstChild?.firstChild?.firstChild?.textContent).toBe('Услуга');
  });

  it('вставляется в середину непустого документа, не съедая соседей', () => {
    const state = stateFrom('Первый абзац\n\nВторой абзац');
    // Курсор в конец первого абзаца.
    // 1 — начало первого абзаца, +длина текста — его конец.
    const at = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, 1 + 'Первый абзац'.length)),
    );

    const { ok, state: next } = apply(at);
    expect(ok).toBe(true);
    expect(next.doc.textContent).toContain('Первый абзац');
    expect(next.doc.textContent).toContain('Второй абзац');
    expect(next.doc.child(1).type.name).toBe('table');
  });
});

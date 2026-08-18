// Примитивы плавающих панелей: контейнер в body, кнопки, позиционирование.
//
// Панели живут в document.body, а не внутри редактора: страницы приложений — скролл-
// контейнеры внутри overflow-hidden, и панель, растущая вниз от курсора, обрезается их
// границей. Классы стилей глобальные (не заскоплены под .k-editor) именно затем, чтобы
// вынос наружу не стоил оформления.
import { computePosition, flip, shift, offset, size, type VirtualElement } from '@floating-ui/dom';

export interface ButtonSpec {
  icon: string;
  title: string;
  onClick: (event: MouseEvent) => void;
  /** Показывать кнопку нажатой (марка/блок активны). */
  active?: () => boolean;
  /** Кнопка недоступна (команда неприменима). */
  disabled?: () => boolean;
}

export function createPopover(extraClass = ''): HTMLElement {
  const el = document.createElement('div');
  el.className = `k-editor-popover ${extraClass}`.trim();
  el.style.display = 'none';
  // mousedown на панели не должен уводить фокус из редактора: иначе к моменту клика
  // выделение уже схлопнулось и команда применяется в пустоту.
  el.addEventListener('mousedown', (event) => event.preventDefault());
  document.body.appendChild(el);
  return el;
}

export function createButton(spec: ButtonSpec): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'k-editor-btn';
  button.title = spec.title;
  button.setAttribute('aria-label', spec.title);
  button.innerHTML = spec.icon;
  button.addEventListener('click', spec.onClick);
  return button;
}

export function createSeparator(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'k-editor-sep';
  return el;
}

/** Пункт меню вставки: иконка + подпись. */
export function createMenuItem(icon: string, label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'k-editor-menu-item';
  button.innerHTML = `${icon}<span>${label}</span>`;
  button.addEventListener('click', onClick);
  return button;
}

export function createGroupLabel(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'k-editor-menu-group';
  el.textContent = text;
  return el;
}

/** Виртуальный элемент floating-ui из прямоугольника в координатах вьюпорта. */
export function rectAnchor(rect: DOMRect | { left: number; top: number; right: number; bottom: number }): VirtualElement {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  return {
    getBoundingClientRect: () =>
      ({
        x: rect.left,
        y: rect.top,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width,
        height,
      }) as DOMRect,
  };
}

/**
 * Поставить панель у якоря.
 *
 * `size()` обязателен, а не «на всякий случай»: у высокого меню при курсоре в середине
 * страницы места не хватает ни снизу, ни сверху, и один только flip() в такой ситуации
 * перебирает обе стороны, обе отвергает и оставляет исходную — низ списка уезжает за
 * границу. size() режет высоту по реально доступной, дальше список скроллится сам.
 */
export async function place(
  anchor: VirtualElement | HTMLElement,
  panel: HTMLElement,
  placement: 'top' | 'bottom' | 'right-start' = 'top',
  /** Потолок высоты панели. Список пунктов не должен растягиваться во весь экран. */
  maxHeight = Number.POSITIVE_INFINITY,
): Promise<void> {
  const { x, y } = await computePosition(anchor, panel, {
    strategy: 'absolute',
    placement,
    middleware: [
      offset(8),
      flip(),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, elements }) {
          const height = Math.min(availableHeight, maxHeight);
          elements.floating.style.maxHeight = `${Math.max(160, height)}px`;
        },
      }),
    ],
  });
  // Скролл страницы сюда добавлять НЕ надо: при strategy 'absolute' computePosition уже
  // отдаёт координаты относительно offset-родителя панели (а она лежит в body). Ручная
  // добавка window.scrollX/Y учитывала бы скролл дважды и уводила панель от курсора.
  panel.style.left = `${x}px`;
  panel.style.top = `${y}px`;
}

export function showPanel(panel: HTMLElement): void {
  panel.style.display = 'flex';
}

export function hidePanel(panel: HTMLElement): void {
  panel.style.display = 'none';
}

export function isPanelVisible(panel: HTMLElement): boolean {
  return panel.style.display !== 'none';
}

/** Обновить нажатость/доступность набора кнопок. */
export function refreshButtons(entries: Array<[HTMLButtonElement, ButtonSpec]>): void {
  for (const [button, spec] of entries) {
    button.setAttribute('aria-pressed', String(Boolean(spec.active?.())));
    button.disabled = Boolean(spec.disabled?.());
  }
}

import { test, expect, type Locator } from '@playwright/test';

/**
 * Ручки блока (⠿ и +) — путь курсора от текста до самой ручки.
 *
 * Показать ручки по ховеру мало: до них ещё надо ДОЕХАТЬ. Курсор идёт влево через полосу
 * отступа, и любой разрыв на этом пути — ручки шире полосы и торчат наружу, слушатели
 * висят на `.ProseMirror`, а не на всём редакторе — гасит их ровно в момент, когда
 * пользователь тянется к ⠿. Скриншотом и проверкой «появились по ховеру» это не видно:
 * ручки честно появляются, а потом исчезают по дороге.
 */

const HANDLES = '.k-editor-handles';
const VISIBLE = '.k-editor-handles[data-visible="true"]';

/** Прямоугольник, по которому реально кликают/наводят. */
async function box(locator: Locator, what: string) {
  const rect = await locator.boundingBox();
  expect(rect, `${what} не имеет коробки`).not.toBeNull();
  return rect!;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/editor');
  await expect(page.getByTestId('editor-demo').locator('.ProseMirror')).toBeVisible();
});

test('ручки не гаснут, пока курсор едет от текста к ⠿', async ({ page }) => {
  const paragraph = page.getByTestId('editor-demo').locator('.ProseMirror p').first();
  const text = await box(paragraph, 'абзац');
  await paragraph.hover();
  await expect(page.locator(VISIBLE)).toBeVisible();

  const handles = await box(page.locator(HANDLES), 'ручки');
  const y = text.y + text.height / 2;
  const startX = text.x + 40;
  const endX = handles.x + handles.width / 4; // центр левой кнопки (⠿ или +)

  // Шагаем мелко: пропасть может быть в пару пикселей — на границе отступа или на самом
  // краю редактора, куда ручки вылезают, если полоса под них уже них самих.
  const steps = 24;
  for (let i = 0; i <= steps; i += 1) {
    const x = startX + ((endX - startX) * i) / steps;
    await page.mouse.move(x, y);
    await expect(page.locator(VISIBLE), `ручки погасли на x=${Math.round(x)}`).toBeVisible();
  }
});

test('ручки целиком внутри редактора — их видно и по ним можно попасть', async ({ page }) => {
  await page.getByTestId('editor-demo').locator('.ProseMirror p').first().hover();
  await expect(page.locator(VISIBLE)).toBeVisible();

  const editor = await box(page.getByTestId('editor-demo'), 'редактор');
  const handles = await box(page.locator(HANDLES), 'ручки');
  expect(handles.x, 'ручки вылезают за левый край редактора').toBeGreaterThanOrEqual(editor.x);
  expect(handles.x + handles.width, 'ручки залезают на текст').toBeLessThanOrEqual(
    editor.x + editor.width,
  );

  // Наводимся на саму ручку — она остаётся видимой и является целью попадания.
  const drag = page.getByRole('button', { name: 'Drag block' });
  await drag.hover();
  await expect(page.locator(VISIBLE)).toBeVisible();
  const hit = await drag.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el.contains(top);
  });
  expect(hit, 'по ⠿ нельзя попасть курсором — её что-то перекрывает').toBe(true);
});

test('ручки не убегают на соседний блок, пока курсор в жёлобе', async ({ page }) => {
  // Живая рука дрейфует и по вертикали. Если в жёлобе (полосе слева от текста) каждое
  // движение перепривязывает ручки к блоку под курсором, то дрейф через границу блоков
  // уводит их к соседу — ручка убегает из-под курсора, и поймать её нельзя в принципе.
  // Контракт: пока курсор в жёлобе, ручки держатся за блок, на котором их показали.
  // Вводный абзац: сверху h1, снизу h2 — дрейф по вертикали гарантированно задевает
  // высоты соседних блоков.
  const intro = page.getByTestId('editor-demo').locator('.ProseMirror > p').first();
  const text = await box(intro, 'вводный абзац');
  await intro.hover();
  await expect(page.locator(VISIBLE)).toBeVisible();

  const anchored = await box(page.locator(HANDLES), 'ручки');
  const gutterX = anchored.x + anchored.width / 2;

  // Заходим в жёлоб по горизонтали, затем ездим по вертикали на высоты СОСЕДНИХ блоков.
  const y0 = text.y + text.height / 2;
  await page.mouse.move(text.x + 30, y0);
  await page.mouse.move(gutterX, y0);
  for (const dy of [-30, -60, 20, 60, 0]) {
    await page.mouse.move(gutterX, y0 + dy, { steps: 6 });
    await expect(page.locator(VISIBLE), `ручки погасли на dy=${dy}`).toBeVisible();
    const now = await box(page.locator(HANDLES), 'ручки');
    expect(Math.round(now.y), `ручки убежали от блока на dy=${dy}`).toBe(Math.round(anchored.y));
  }

  // Из жёлоба — на саму ручку: она всё ещё у исходного блока и по ней попадает курсор.
  const drag = page.getByRole('button', { name: 'Drag block' });
  await drag.hover();
  await expect(page.locator(VISIBLE)).toBeVisible();
  const now = await box(page.locator(HANDLES), 'ручки');
  expect(Math.round(now.y), 'ручки убежали при наведении на ⠿').toBe(Math.round(anchored.y));
});

test('ручку можно поймать при диагональном заходе с дрейфом вверх', async ({ page }) => {
  // Худший реальный путь: ховер по нижней части блока, бросок по диагонали вверх-влево к
  // ручке. Траектория задевает высоты соседних блоков — ручки не должны ни гаснуть, ни
  // переанкериваться.
  const intro = page.getByTestId('editor-demo').locator('.ProseMirror > p').first();
  const text = await box(intro, 'абзац');
  await intro.hover();
  await expect(page.locator(VISIBLE)).toBeVisible();

  const anchored = await box(page.locator(HANDLES), 'ручки');
  const startX = text.x + 80;
  const startY = text.y + text.height - 2; // нижняя кромка блока
  const endX = anchored.x + anchored.width * 0.75;
  const endY = anchored.y - 8; // промах выше ручки — рука перелетает
  await page.mouse.move(startX, startY);
  const steps = 20;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(
      startX + ((endX - startX) * i) / steps,
      startY + ((endY - startY) * i) / steps,
    );
  }
  // Возврат на ручку после перелёта.
  await page.mouse.move(endX, anchored.y + anchored.height / 2, { steps: 4 });
  await expect(page.locator(VISIBLE), 'ручки погасли на диагонали').toBeVisible();
  const now = await box(page.locator(HANDLES), 'ручки');
  expect(Math.round(now.y), 'ручки уехали на другой блок').toBe(Math.round(anchored.y));
});

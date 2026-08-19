import { test, expect } from '@playwright/test';

/**
 * Переменные `{{name}}` в СЕРЕДИНЕ текста.
 *
 * Узел inline с самого начала, но все пути вставки вели в отдельный блок: `/` открывался
 * только в пустом абзаце, «+» сам заводит новый, а набранный руками `{{name}}` оставался
 * плоским текстом до пересохранения. Эти спеки прибивают оба живых пути: набор с
 * клавиатуры превращается в чип на месте, `/` после пробела открывает меню посреди строки.
 */

const pm = '[data-testid="editor-demo"] .ProseMirror';
const CHIP = `${pm} p span.k-editor-variable`;

test.beforeEach(async ({ page }) => {
  await page.goto('/editor');
  await expect(page.locator(pm)).toBeVisible();
  // Пустой документ: чистый абзац, никакой готовой разметки демо.
  await page.locator(pm).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
});

test('набранный руками {{name}} становится чипом прямо в тексте', async ({ page }) => {
  await page.keyboard.type('До {{appName}} после');

  const chip = page.locator(CHIP);
  await expect(chip).toHaveText('{{appName}}');
  // Чип ВНУТРИ того же абзаца, окружённый текстом, — не отдельный блок.
  await expect(page.locator(`${pm} > p`)).toHaveCount(1);
  await expect(page.locator(`${pm} > p`)).toContainText('До');
  await expect(page.locator(`${pm} > p`)).toContainText('после');

  // И в markdown он уезжает инлайном, в той же строке.
  await page.getByRole('button', { name: 'getMarkdown()' }).click();
  await expect(page.getByTestId('editor-demo-output')).toContainText('До {{appName}} после');
});

test('«/» после пробела открывает меню посреди строки и вставляет чип на место', async ({
  page,
}) => {
  await page.keyboard.type('Пишу договор ');
  await page.keyboard.type('/');
  const menu = page.locator('body > .k-editor-popover.k-editor-menu');
  await expect(menu).toBeVisible();

  await page.keyboard.type('app');
  await menu.getByText('{{appName}}', { exact: true }).click();
  await page.keyboard.type(' дальше');

  await expect(page.locator(CHIP)).toHaveText('{{appName}}');
  // Запрос «/app» стёрт, текст с обеих сторон чипа остался в ОДНОМ абзаце.
  await expect(page.locator(`${pm} > p`)).toHaveCount(1);
  await expect(page.locator(`${pm} > p`)).toContainText('Пишу договор');
  await expect(page.locator(`${pm} > p`)).toContainText('дальше');
  await expect(page.locator(`${pm} > p`)).not.toContainText('/app');
});

test('чип в конце строки не уводит каретку на следующую', async ({ page }) => {
  // После инлайн-атома в конце блока ProseMirror ставит разделительный
  // `img.ProseMirror-separator`. Generic-правила потребителя (Tailwind-префлайт делает
  // все img блочными) превращают его в перенос: абзац становится двухстрочным, каретка
  // рисуется строкой ниже — хотя логически стоит сразу за чипом, и набор идёт туда.
  // Пользовательская проверка: абзац с чипом на конце остаётся ОДНОстрочным.
  await page.keyboard.type('Текст {{appName}}');
  await expect(page.locator(CHIP)).toHaveText('{{appName}}');

  const metrics = await page.locator(`${pm} > p`).evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    lineHeight: parseFloat(getComputedStyle(el).lineHeight),
  }));
  expect(
    metrics.height,
    'абзац с чипом на конце стал двухстрочным — каретка рисуется на следующей строке',
  ).toBeLessThan(metrics.lineHeight * 1.8);
});

test('«/» внутри слова — обычный символ, меню не лезет', async ({ page }) => {
  await page.keyboard.type('и');
  await page.keyboard.type('/');
  await expect(page.locator('body > .k-editor-popover.k-editor-menu')).toBeHidden();
  await page.keyboard.type('или');
  await expect(page.locator(`${pm} > p`)).toContainText('и/или');
});

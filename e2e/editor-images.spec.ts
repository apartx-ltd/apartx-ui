import { test, expect } from '@playwright/test';

/**
 * Попап картинки: вставка по URL / файлом / дропом и правка атрибутов по клику.
 *
 * До него пункт Image меню спрашивал URL через window.prompt (ни файла, ни дропа), а
 * title/alt уже вставленной картинки не редактировались никак — только удалить и вставить
 * заново.
 */

const pm = '[data-testid="editor-demo"] .ProseMirror';
const form = 'body > .k-editor-popover.k-editor-image-form';
// После инлайн-атома ProseMirror держит служебный img.ProseMirror-separator — его
// селектор картинок обязан исключать, иначе strict mode ловит два элемента.
const docImg = `${pm} img:not(.ProseMirror-separator)`;

// 1×1 прозрачный png.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test.beforeEach(async ({ page }) => {
  await page.goto('/editor');
  await expect(page.locator(pm)).toBeVisible();
  await page.locator(pm).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
});

test('меню вставки открывает попап; URL + alt + title уезжают в узел и markdown', async ({
  page,
}) => {
  await page.keyboard.type('/');
  const menu = page.locator('body > .k-editor-popover.k-editor-menu');
  await expect(menu).toBeVisible();
  await menu.getByText('Image', { exact: true }).click();

  const popup = page.locator(form);
  await expect(popup).toBeVisible();
  await popup.getByPlaceholder('https://…').fill('https://cdn.example.com/plan.png');
  await popup.getByPlaceholder('Alt text').fill('Схема');
  await popup.getByPlaceholder('Title').fill('Как добраться');
  await popup.getByText('Apply', { exact: true }).click();

  // Не toBeVisible: URL фиктивный, битая картинка рендерится 0×0 и «невидима». Здесь
  // проверяется документ, а не загрузка байтов.
  const img = page.locator(`${pm} img[src="https://cdn.example.com/plan.png"]`);
  await expect(img).toHaveCount(1);
  await expect(img).toHaveAttribute('alt', 'Схема');
  await expect(img).toHaveAttribute('title', 'Как добраться');

  await page.getByRole('button', { name: 'getMarkdown()' }).click();
  await expect(page.getByTestId('editor-demo-output')).toContainText(
    '![Схема](https://cdn.example.com/plan.png "Как добраться")',
  );
});

test('клик по картинке открывает попап с её атрибутами; правка title сохраняется', async ({
  page,
}) => {
  // Картинку заводим через попап data-URL'ом: по нему она реально рендерится, и клик
  // имеет по чему попадать (битый внешний URL дал бы элемент 0×0).
  const src = `data:image/png;base64,${PNG_BASE64}`;
  await page.keyboard.type('/');
  await page.locator('body > .k-editor-popover.k-editor-menu').getByText('Image').click();
  const popup = page.locator(form);
  await popup.getByPlaceholder('https://…').fill(src);
  await popup.getByText('Apply', { exact: true }).click();
  await expect(popup).toBeHidden();

  await page.locator(docImg).click();
  await expect(popup).toBeVisible();
  // Попап открылся ЗАПОЛНЕННЫМ — это и есть режим правки.
  await expect(popup.getByPlaceholder('https://…')).toHaveValue(src);
  await popup.getByPlaceholder('Title').fill('Новый заголовок');
  await popup.getByPlaceholder('Title').press('Enter');

  await expect(page.locator(docImg)).toHaveAttribute('title', 'Новый заголовок');
  await page.getByRole('button', { name: 'getMarkdown()' }).click();
  await expect(page.getByTestId('editor-demo-output')).toContainText('"Новый заголовок"');
});

test('загрузка файлом с диска: выбранный файл становится картинкой', async ({ page }) => {
  await page.keyboard.type('/');
  await page.locator('body > .k-editor-popover.k-editor-menu').getByText('Image').click();
  const popup = page.locator(form);
  await expect(popup).toBeVisible();

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    popup.getByText('Upload — or drop a file here').click(),
  ]);
  await chooser.setFiles({
    name: 'plan.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_BASE64, 'base64'),
  });

  // Демо-хук отдаёт data-URL; alt подставлен из имени файла.
  const img = page.locator(docImg);
  await expect(img).toHaveAttribute('src', /^data:image\/png/);
  await expect(img).toHaveAttribute('alt', 'plan.png');
  await expect(popup).toBeHidden();
});

test('дроп файла прямо на попап загружает его', async ({ page }) => {
  await page.keyboard.type('/');
  await page.locator('body > .k-editor-popover.k-editor-menu').getByText('Image').click();
  const popup = page.locator(form);
  await expect(popup).toBeVisible();

  await popup.evaluate((el, base64) => {
    const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'dropped.png', { type: 'image/png' }));
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, PNG_BASE64);

  const img = page.locator(docImg);
  await expect(img).toHaveAttribute('src', /^data:image\/png/);
  await expect(img).toHaveAttribute('alt', 'dropped.png');
});

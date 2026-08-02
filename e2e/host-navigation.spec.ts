import { test, expect, type Page } from '@playwright/test';

// Регресс «drawer → пункт меню → навигация откатывается» (вариант B: кит отпускает
// history при хостовой навигации). Причина была в том, что оверлей-стек владел
// историей единолично и на закрытии слепо звал history.back() — но хост уже успел
// запушить новый роут поверх синтетической записи оверлея, так что слепой back
// выпиливал именно route-запись, откатывая навигацию, а drawer оставался открытым.
// Drawer и гамбургер рендерятся только под sm-брейкпоинтом, поэтому фиксируем
// мобильный viewport.
test.use({ viewport: { width: 390, height: 844 } });

// SvelteKit SSR-ит гамбургер, клик до гидрации теряется — ретраим до появления
// цели (тот же приём, что openOverlay в overlays.spec.ts).
//
// Scoping to `.dr-slide` (the Drawer's own slide-in wrapper, present only while
// open — see src/lib/ui/overlays/Drawer.svelte) matters because some page bodies
// (e.g. /display) contain their own plain `<a href="/components">` CTA links —
// a bare `a[href=…]` would then match more than one element.
async function openDrawer(page: Page, linkHref: string) {
  const link = page.locator('.dr-slide').locator(`a[href="${linkHref}"]`);
  await expect(async () => {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(link).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
  return link;
}

test("пункт меню drawer'а навигирует, drawer закрывается, back возвращает", async ({ page }) => {
  await page.goto('/');
  const link = await openDrawer(page, '/display');
  await link.click();
  // Навигация состоялась и НЕ откатилась слепым back'ом оверлей-стека.
  await expect(page).toHaveURL(/\/display$/);
  await expect(page.getByRole('heading', { name: 'Display' })).toBeVisible();
  // Drawer закрыт — его ссылки не видимы (десктопный сайдбар скрыт всегда на этом viewport).
  await expect(link).toBeHidden();
  // Первый back корректен: брошенная синтетическая запись несёт URL исходной страницы.
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test('повторный цикл drawer→навигация работает (suppressNextPop не залипает)', async ({ page }) => {
  await page.goto('/');
  await (await openDrawer(page, '/display')).click();
  await expect(page).toHaveURL(/\/display$/);
  // Второй заход тем же жестом — до фикса здесь всё разваливалось из-за
  // залипшего suppressNextPop и уплывшего depth.
  await (await openDrawer(page, '/components')).click();
  await expect(page).toHaveURL(/\/components$/);
  await expect(page.getByRole('heading', { name: 'Component docs' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/display$/);
});

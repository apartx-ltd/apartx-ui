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
// open — see src/lib/ui/overlays/Drawer.svelte) is required, not optional: a bare
// `a[href=…]` also matches the always-in-DOM desktop `<aside>` mirror of the same
// nav links (src/routes/+layout.svelte:106 — hidden via CSS but present), and for
// `/components` specifically the visible "Browse components →" CTA rendered on the
// home page (src/routes/+page.svelte:16-21). `.filter({ visible: true })` alone is
// NOT enough there — that CTA is visible even while the drawer's scrim covers it —
// so a DOM-scoped locator is the only reliable fix.
async function openDrawer(page: Page, linkHref: string) {
  const link = page.locator('.dr-slide').locator(`a[href="${linkHref}"]`);
  await expect(async () => {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(link).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
  return link;
}

// Верифицирует, что навигация УСТОЯЛА, а не мигнула. До фикса блокирующий баг
// проявлялся так: клик по ссылке синхронно меняет URL на целевой (SvelteKit's
// pushState происходит сразу), а слепой history.back() оверлей-стека прилетает
// через десятки мс ПОСЛЕ этого — асинхронно, из popstate-обработчика. Разовая
// проверка `toHaveURL` сразу после клика попадает точно в это окно и молча
// проходит на сломанном коде. Поэтому ждём, пока PageTransition (280ms анимация +
// 40ms hold, см. src/lib/navigation/PageTransition.svelte) точно доиграет, и
// проверяем URL ещё раз. Дополнительно — симптом из репорта «обе страницы
// отрендерены разом»: после отстоя на странице должен остаться ровно один `<h1>`.
async function expectNavigationSettled(page: Page, urlPattern: RegExp, headingName: string) {
  await expect(page).toHaveURL(urlPattern);
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(urlPattern);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: headingName })).toBeVisible();
}

test("пункт меню drawer'а навигирует, drawer закрывается, back возвращает", async ({ page }) => {
  await page.goto('/');
  const link = await openDrawer(page, '/display');
  await link.click();
  // Навигация состоялась и НЕ откатилась слепым back'ом оверлей-стека — проверено
  // после отстоя транзишена, а не транзиентно сразу после клика.
  await expectNavigationSettled(page, /\/display$/, 'Display');
  // Drawer закрыт — его ссылки не видимы (десктопный сайдбар скрыт всегда на этом viewport).
  await expect(link).toBeHidden();
  // Первый back корректен: брошенная синтетическая запись несёт URL исходной страницы.
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

// Второй цикл drawer→навигация тем же жестом должен работать так же надёжно, как
// первый: back-цепочка не должна расползтись после первой навигации. (Ресинк
// внутреннего счётчика `depth` из history.state, который тоже чинился в рамках
// этого фикса, e2e не наблюдаем в принципе — pushOverlay пересчитывает его заново
// на каждом открытии оверлея, так что он самовосстанавливается; это покрыто
// юнит-тестами роутера, не этой спекой.)
test('второй цикл drawer→навигация тоже не откатывается', async ({ page }) => {
  await page.goto('/');
  await (await openDrawer(page, '/display')).click();
  await expectNavigationSettled(page, /\/display$/, 'Display');
  await (await openDrawer(page, '/components')).click();
  await expectNavigationSettled(page, /\/components$/, 'Component docs');
  await page.goBack();
  await expect(page).toHaveURL(/\/display$/);
});

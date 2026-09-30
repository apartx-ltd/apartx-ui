import { test, expect, type Page } from '@playwright/test';
import { openOverlay } from './helpers';

// Правило «инсет забирает контейнер у края экрана» (AGENTS.md → «Safe-area»). Кордова-хост
// кладёт высоту статус-бара и home indicator в --safe-area-inset-top/bottom на <html>;
// здесь они задаются так же. Отступить должен контейнер (Page, панель Dialog/Drawer), а
// Header/Toolbar внутри него — увидеть 0.

const TOP = 40;
const BOTTOM = 30;

type CssProp = 'paddingTop' | 'paddingBottom' | 'backgroundSize';

const css = (page: Page, testId: string, prop: CssProp) =>
  page.getByTestId(testId).evaluate((el, p) => getComputedStyle(el)[p as CssProp], prop);

// Панели въезжают keyframe-анимацией: до её конца координаты врут.
const settle = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

test.describe('safe-area: инсет задан', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/safe-area');
    await page.evaluate(
      ([top, bottom]) => {
        document.documentElement.style.setProperty('--safe-area-inset-top', `${top}px`);
        document.documentElement.style.setProperty('--safe-area-inset-bottom', `${bottom}px`);
      },
      [TOP, BOTTOM],
    );
  });

  test('Page с шапкой: отступает Page, шапка видит ноль, полоска цвета шапки', async ({ page }) => {
    expect(await css(page, 'sa-page-header', 'paddingTop')).toBe(`${TOP}px`);
    expect(await css(page, 'sa-header', 'paddingTop')).toBe('0px');
    expect(await css(page, 'sa-page-header', 'backgroundSize')).toBe(`100% ${TOP}px`);
  });

  test('Page без шапки: контент ниже инсета', async ({ page }) => {
    expect(await css(page, 'sa-page-bare', 'paddingTop')).toBe(`${TOP}px`);
    const box = await page.getByTestId('sa-page-bare').boundingBox();
    const text = await page.getByTestId('sa-bare-text').boundingBox();
    expect(text!.y).toBeGreaterThanOrEqual(box!.y + TOP);
  });

  test('вложенный Page отступ не удваивает', async ({ page }) => {
    expect(await css(page, 'sa-page-outer', 'paddingTop')).toBe(`${TOP}px`);
    expect(await css(page, 'sa-page-inner', 'paddingTop')).toBe('0px');
  });

  test('Header вне Page отступает сам, как раньше', async ({ page }) => {
    expect(await css(page, 'sa-header-standalone', 'paddingTop')).toBe(`${TOP}px`);
  });

  test('класс хоста p-0 не снимает отступ Page', async ({ page }) => {
    expect(await css(page, 'sa-page-p0', 'paddingTop')).toBe(`${TOP}px`);
    expect(await css(page, 'sa-page-p0', 'paddingBottom')).toBe(`${BOTTOM}px`);
  });

  test('низ: Page без футера отступает на нижний инсет, вложенный Page не удваивает', async ({ page }) => {
    expect(await css(page, 'sa-page-bare', 'paddingBottom')).toBe(`${BOTTOM}px`);
    expect(await css(page, 'sa-page-outer', 'paddingBottom')).toBe(`${BOTTOM}px`);
    expect(await css(page, 'sa-page-inner', 'paddingBottom')).toBe('0px');
  });

  test('низ: Footer внутри Page видит ноль и докрашивает полоску под собой', async ({ page }) => {
    expect(await css(page, 'sa-page-footer', 'paddingBottom')).toBe(`${BOTTOM}px`);
    expect(await css(page, 'sa-footer', 'paddingBottom')).toBe('0px');

    // Футер стоит над полоской инсета, а его ::after закрывает её целиком своим фоном.
    const pageBox = await page.getByTestId('sa-page-footer').boundingBox();
    const footerBox = await page.getByTestId('sa-footer').boundingBox();
    expect(footerBox!.y + footerBox!.height).toBeCloseTo(pageBox!.y + pageBox!.height - BOTTOM, 0);
    const strip = await page.getByTestId('sa-footer').evaluate((el) => {
      const after = getComputedStyle(el, '::after');
      return { height: after.height, color: after.backgroundColor, own: getComputedStyle(el).backgroundColor };
    });
    expect(strip.height).toBe(`${BOTTOM}px`);
    expect(strip.color).toBe(strip.own);
  });

  test('низ: над нижней навигацией Page не отступает, навигация берёт инсет сама', async ({ page }) => {
    expect(await css(page, 'sa-page-navhost', 'paddingBottom')).toBe('0px');
    expect(await css(page, 'sa-page-navhost', 'paddingTop')).toBe(`${TOP}px`);
    expect(await css(page, 'sa-nav', 'paddingBottom')).toBe(`${BOTTOM + 8}px`);
  });

  test('полноэкранный Dialog с сырой шапкой: шапка ниже статус-бара', async ({ page }) => {
    await openOverlay(page, 'open-sa-dialog-raw', 'sa-dialog-raw');
    await settle(page, 'sa-dialog-raw');
    expect(await css(page, 'sa-dialog-raw', 'paddingTop')).toBe(`${TOP}px`);
    const close = await page.getByTestId('sa-dialog-raw-close').boundingBox();
    expect(close!.y).toBeGreaterThanOrEqual(TOP);
  });

  test('полноэкранный Dialog с contentClass="p-0": отступы панели на месте', async ({ page }) => {
    await openOverlay(page, 'open-sa-dialog-p0', 'sa-dialog-p0');
    await settle(page, 'sa-dialog-p0');
    expect(await css(page, 'sa-dialog-p0', 'paddingTop')).toBe(`${TOP}px`);
    expect(await css(page, 'sa-dialog-p0', 'paddingBottom')).toBe(`${BOTTOM}px`);
    const footer = await page.getByTestId('sa-dialog-p0-footer').boundingBox();
    const viewport = page.viewportSize()!;
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(viewport.height - BOTTOM);
  });

  test('edgeToEdge: панель сверху не отступает, дети видят настоящий инсет', async ({ page }) => {
    await openOverlay(page, 'open-sa-dialog-edge', 'sa-dialog-edge');
    await settle(page, 'sa-dialog-edge');
    expect(await css(page, 'sa-dialog-edge', 'paddingTop')).toBe('0px');
    expect(await css(page, 'sa-dialog-edge', 'paddingBottom')).toBe(`${BOTTOM}px`);
    // Фон содержимого доходит до верхнего края экрана, отступ контента — его собственный.
    const probe = await page.getByTestId('sa-dialog-edge-probe').boundingBox();
    expect(probe!.y).toBe(0);
    expect(await css(page, 'sa-dialog-edge-probe', 'paddingTop')).toBe(`${TOP}px`);
  });

  test('Drawer, объявленный внутри Page: панель отступает, шапка внутри видит ноль', async ({ page }) => {
    await openOverlay(page, 'open-sa-drawer', 'sa-drawer');
    expect(await css(page, 'sa-drawer', 'paddingTop')).toBe(`${TOP}px`);
    expect(await css(page, 'sa-drawer', 'paddingBottom')).toBe(`${BOTTOM}px`);
    expect(await css(page, 'sa-drawer-header', 'paddingTop')).toBe('0px');
  });
});

test.describe('safe-area: инсет не задан (веб)', () => {
  test('контейнеры не отступают', async ({ page }) => {
    await page.goto('/safe-area');
    expect(await css(page, 'sa-page-header', 'paddingTop')).toBe('0px');
    expect(await css(page, 'sa-page-bare', 'paddingTop')).toBe('0px');
    expect(await css(page, 'sa-header-standalone', 'paddingTop')).toBe('0px');
  });
});

import { test, expect, type Page, type Locator } from '@playwright/test';

// PhoneInput на демо-площадке: поле гоняется с НАСТОЯЩЕЙ таблицей стран
// (`countryPhoneData` из пакета `phone`) — ровно так, как его передаёт кабинет.
// Отсюда и регресс, который эта спека держит: демо какое-то время показывало
// урезанную выборку из пяти стран, и «+81» не давал Японию просто потому, что
// её не было в списке — компонент при этом был исправен.

/** Инпут по подписи: у демо два PhoneInput, различаются только лейблом. */
function fieldByLabel(page: Page, label: string): Locator {
  return page.locator('div').filter({ has: page.getByText(label, { exact: true }) }).last().locator('input');
}

/** Чип на странице ровно один — его рисует только поле со списком стран. */
function chip(page: Page): Locator {
  return page.getByTestId('phone-country-chip');
}

/**
 * Дождаться гидрации. SvelteKit отдаёт разметку с сервера, и `fill()` до
 * гидрации МОЛЧА проходит: значение в DOM меняется, а обработчик ещё не навешан,
 * поэтому ни чипа, ни переформатирования не появляется — тест падает на пустом
 * месте. Признак живого компонента — именно переформатирование ввода
 * (`+7701` → `+7 701`): его делает только клиентский код.
 */
async function waitHydrated(page: Page) {
  const input = fieldByLabel(page, 'PhoneInput + countries');
  await expect(async () => {
    await input.fill('+7701');
    expect(await input.inputValue()).toBe('+7 701');
  }).toPass({ timeout: 20000 });
  await input.fill('');
}

test.describe('PhoneInput со списком стран', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forms');
    await waitHydrated(page);
  });

  test('уникальный код называет страну сразу', async ({ page }) => {
    await fieldByLabel(page, 'PhoneInput + countries').fill('+81');
    await expect(chip(page)).toHaveText('Japan');
  });

  test('общий код +7 различает Казахстан и Россию по первой цифре', async ({ page }) => {
    const input = fieldByLabel(page, 'PhoneInput + countries');

    await input.fill('+7');
    await expect(chip(page)).toHaveText('+7');

    await input.fill('+7701');
    await expect(chip(page)).toHaveText('Kazakhstan');

    await input.fill('+7916');
    await expect(chip(page)).toHaveText('Russian Federation');
  });

  test('пустое поле показывает плюс, и его нельзя стереть', async ({ page }) => {
    const input = fieldByLabel(page, 'PhoneInput + countries');
    await input.fill('+7701');
    await input.fill('');
    await expect(input).toHaveValue('+');
  });

  test('легаси-поле без списка стран чипа не показывает', async ({ page }) => {
    await fieldByLabel(page, 'PhoneInput (legacy)').fill('+81');
    // Чип принадлежит только intl-полю, и ввод в легаси-поле его не создаёт:
    // иначе легаси-режим втихую обзавёлся бы новым UI.
    await expect(chip(page)).toHaveCount(0);
  });
});

import { expect, test, type Page } from '@playwright/test';

const card = (page: Page, text: string) =>
  page.locator('[data-element-id]').filter({ hasText: text }).first();

/** Новая ветка сразу открывается на правку: печатать, когда редактор получил фокус. */
async function typeInNew(page: Page, text: string) {
  await expect(page.locator('[contenteditable="true"]:focus')).toBeVisible();
  await page.keyboard.type(text);
  await page.keyboard.press('Escape');
}

async function select(page: Page, text: string) {
  const box = await card(page, text).boundingBox();
  if (box === null) throw new Error(`нет карточки ${text}`);
  await page.mouse.click(box.x + 8, box.y + box.height - 6);
}

for (const theme of ['light', 'dark']) {
  test(`майнд-карта: линии, сворачивание, вид (${theme})`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/e2e/mindmap-fixture.html?theme=${theme}`);
    await expect(card(page, 'Квест: пропавший кузнец')).toBeVisible();
    await expect(page.locator('svg path[d]').first()).toBeAttached();
    await expect(card(page, 'Следы борьбы')).toHaveCount(0);
    const collapsed = page.getByRole('button', { name: 'Развернуть: 1 скрытая карточка' });
    await expect(collapsed).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`mindmap-${theme}.png`) });
    await collapsed.click();
    await expect(card(page, 'Следы борьбы')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`mindmap-expanded-${theme}.png`) });
    expect(errors).toEqual([]);
  });
}

test('майнд-карта: Tab и Enter добавляют ветки, удаление спрашивает', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/e2e/mindmap-fixture.html');
  await select(page, 'Кузнец в клетке');
  await page.keyboard.press('Tab');
  await typeInNew(page, 'Освободить кузнеца');
  await expect(card(page, 'Освободить кузнеца')).toBeVisible();
  await select(page, 'Освободить кузнеца');
  await page.keyboard.press('Enter');
  await typeInNew(page, 'Вывести через штольню');
  await expect(card(page, 'Вывести через штольню')).toBeVisible();
  const freeBox = await card(page, 'Освободить кузнеца').boundingBox();
  const exitBox = await card(page, 'Вывести через штольню').boundingBox();
  expect(exitBox?.x).toBeCloseTo(freeBox?.x ?? 0, 0);
  expect((exitBox?.y ?? 0) > (freeBox?.y ?? 0)).toBe(true);

  await select(page, 'Таверна');
  await page.keyboard.press('Delete');
  const dialog = page.getByRole('dialog', { name: 'Удалить узел майнд-карты' });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Только этот узел — ветки перейдут к родителю' })
    .click();
  await expect(card(page, 'Таверна')).toHaveCount(0);
  await expect(card(page, 'Расспросить трактирщика')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(card(page, 'Таверна')).toBeVisible();
  expect(errors).toEqual([]);
});

test('майнд-карта: меню узла и панель элементов', async ({ page }) => {
  await page.goto('/e2e/mindmap-fixture.html');
  await select(page, 'Старая шахта');
  const box = await card(page, 'Старая шахта').boundingBox();
  if (box === null) throw new Error('нет карточки');
  await page.mouse.click(box.x + 8, box.y + box.height - 6, { button: 'right' });
  await expect(page.getByRole('menuitem', { name: /Добавить ветку/ })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Свернуть ветку' }).click();
  await expect(card(page, 'Засада гоблинов')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Майнд-карта' })).toBeVisible();
});

test('майнд-карта: брошенный на узел узел становится его веткой, PNG с линиями', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/e2e/mindmap-fixture.html');
  const from = await card(page, 'Засада гоблинов').boundingBox();
  const to = await card(page, 'Таверна').boundingBox();
  if (from === null || to === null) throw new Error('нет карточек');
  await page.mouse.move(from.x + 10, from.y + from.height - 6);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  const moved = await card(page, 'Засада гоблинов').boundingBox();
  const tavern = await card(page, 'Таверна').boundingBox();
  expect((moved?.x ?? 0) > (tavern?.x ?? 0) + (tavern?.width ?? 0)).toBe(true);

  await page.getByRole('button', { name: 'Экспорт' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить PNG…' }).click();
  await (await download).saveAs(testInfo.outputPath('mindmap-export.png'));
  expect(errors).toEqual([]);
});

test('майнд-карта на телефоне', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto('/e2e/mindmap-fixture.html');
  await expect(card(page, 'Таверна')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mindmap-phone.png') });
  await context.close();
});

test('майнд-карта: вложенный список вставляется картой, карта копируется и дублируется', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/e2e/mindmap-fixture.html');
  await expect(card(page, 'Таверна')).toBeVisible();
  const nodes = page.locator('[data-element-id]');
  const before = await nodes.count();
  await page.evaluate(() =>
    navigator.clipboard.writeText('- Сюжет\n  - Завязка\n  - Кульминация\n    - Битва'),
  );
  await page.mouse.click(700, 700);
  await page.keyboard.press('Control+v');
  await expect(card(page, 'Кульминация')).toBeVisible();
  await expect(nodes).toHaveCount(before + 4);
  const plot = await card(page, 'Сюжет').boundingBox();
  const fight = await card(page, 'Битва').boundingBox();
  expect((fight?.x ?? 0) > (plot?.x ?? 0)).toBe(true);

  await select(page, 'Сюжет');
  await page.keyboard.press('Control+d');
  await expect(page.locator('[data-element-id]').filter({ hasText: 'Битва' })).toHaveCount(2);
  expect(errors).toEqual([]);
});

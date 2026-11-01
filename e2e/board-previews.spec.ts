import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  test(`карточки досок: миниатюры, счётчик, живое обновление и переход (${theme})`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    await page.goto(`/e2e/board-previews-fixture.html?theme=${theme}`);
    const cards = page.locator('[data-linked-board]');
    await expect(cards).toHaveCount(6);
    await expect(cards.locator('[data-preview-state="ready"]')).toHaveCount(6);
    const npcs = cards.filter({ has: page.getByTitle('НПС', { exact: true }) });
    await expect(npcs).toContainText('4 карточки · Доска');
    await expect(npcs.locator('img')).toHaveCount(1);
    await expect(cards.filter({ has: page.getByTitle('Механики', { exact: true }) })).toContainText(
      'Пустая доска',
    );
    await expect(
      page.getByRole('button', { name: 'Открыть доску «НПС»', exact: true }),
    ).toBeVisible();
    await page.getByTitle('Масштаб 100 %', { exact: true }).click();
    const clip = await cards.evaluateAll((nodes) => {
      const boxes = nodes.map((node) => node.getBoundingClientRect());
      const x = Math.min(...boxes.map((box) => box.x));
      const y = Math.min(...boxes.map((box) => box.y));
      return {
        x,
        y,
        width: Math.max(...boxes.map((box) => box.right)) - x,
        height: Math.max(...boxes.map((box) => box.bottom)) - y,
      };
    });
    await page.screenshot({ path: testInfo.outputPath(`board-cards-${theme}.png`), clip });
    await page.getByRole('button', { name: 'Добавить карточку НПС', exact: true }).click();
    await expect(npcs).toContainText('5 карточек · Доска');
    await expect(npcs).toContainText('Новый персонаж');
    await page.getByRole('button', { name: 'Переименовать НПС', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Открыть доску «Персонажи»', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Открыть доску «Персонажи»', exact: true }).click();
    await expect(page.getByLabel('Текущая доска')).toHaveText('Персонажи');
    await page.getByRole('button', { name: 'На главную доску', exact: true }).click();
    await expect(cards).toHaveCount(6);
    const locations = cards.filter({ has: page.getByTitle('Локации', { exact: true }) });
    await locations.locator('> div').first().dblclick();
    await expect(page.getByLabel('Текущая доска')).toHaveText('Локации');
    expect(errors).toEqual([]);
  });
}

test('старые карточки 160×150 остаются читаемыми на телефоне и открываются касанием', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/e2e/board-previews-fixture.html');
  const cards = page.locator('[data-linked-board]');
  await expect(cards).toHaveCount(6);
  await expect(cards.locator('[data-preview-state="ready"]')).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath('board-cards-mobile.png') });
  await page.getByRole('button', { name: 'Открыть доску «Механики»', exact: true }).click();
  await expect(page.getByLabel('Текущая доска')).toHaveText('Механики');
});

test('PNG включает миниатюры досок, даже когда их не было на экране', async ({
  page,
}, testInfo) => {
  await page.goto('/e2e/board-previews-fixture.html');
  await expect(page.locator('[data-linked-board]')).toHaveCount(6);
  await page.getByRole('button', { name: 'Экспорт', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить PNG…', exact: true }).click();
  const file = await download;
  await file.saveAs(testInfo.outputPath('linked-boards-export.png'));
  await expect(page.getByText('PNG сохранён.', { exact: true })).toBeVisible();
});

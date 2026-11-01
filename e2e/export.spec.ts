import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

async function exportedPng(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить PNG…' }).click();
  const result = await download;
  const path = await result.path();
  const bytes = await readFile(path);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    base64: bytes.toString('base64'),
  };
}

async function pixels(page: Page, base64: string) {
  return page.evaluate(async (encoded) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('Нет Canvas');
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    let ink = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] > 245 && data[index + 1] < 10 && data[index + 2] < 10) red++;
      if (
        data[index] < 150 &&
        data[index + 1] < 150 &&
        data[index + 2] < 150 &&
        data[index + 3] > 0
      )
        ink++;
    }
    return { corner: Array.from(data.slice(0, 4)), red, ink };
  }, base64);
}

test('PNG всех типов карточек: масштаб 1–3×, темы, изображение и прозрачность', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/e2e/export-fixture.html');
  await expect(page.getByRole('dialog', { name: 'Экспорт в PNG' })).toBeVisible();
  const one = await exportedPng(page);
  await writeFile(testInfo.outputPath('all-elements.png'), Buffer.from(one.base64, 'base64'));
  await page.screenshot({ path: testInfo.outputPath('export-dialog.png') });
  expect(one.width).toBeGreaterThan(1280);
  const light = await pixels(page, one.base64);
  expect(light.corner).toEqual([244, 243, 240, 255]);
  expect(light.red).toBeGreaterThan(5000);
  expect(light.ink).toBeGreaterThan(1000);
  await page.getByRole('radio', { name: '2×', exact: true }).check();
  const two = await exportedPng(page);
  expect(two.width).toBe(one.width * 2);
  expect(two.height).toBe(one.height * 2);
  await page.getByRole('radio', { name: '3×', exact: true }).check();
  const three = await exportedPng(page);
  expect(three.width).toBe(one.width * 3);
  expect(three.height).toBe(one.height * 3);
  await page.getByRole('radio', { name: 'Выделение', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Прозрачный фон' }).check();
  const selected = await exportedPng(page);
  expect(selected.width).toBeLessThan(one.width);
  expect((await pixels(page, selected.base64)).corner[3]).toBe(0);
  await page.goto('/e2e/export-fixture.html?theme=dark');
  const dark = await exportedPng(page);
  expect((await pixels(page, dark.base64)).corner).toEqual([27, 27, 29, 255]);
  expect(errors).toEqual([]);
});

test('экспорт в приложении и модальные окна блокируют команды фонового холста', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Пример/ }).click();
  await page.getByRole('button', { name: /Пример 48 карточек/ }).click();
  await page.getByRole('button', { name: 'Показать всё', exact: true }).waitFor();
  await page.getByTitle('Масштаб 100 %', { exact: true }).click();
  const cards = page.locator('[data-element-id]');
  await expect(cards.first()).toBeVisible();
  await page.getByRole('button', { name: 'Экспорт', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Экспорт в PNG' });
  await expect(modal).toBeVisible();
  const count = await cards.count();
  await page.getByRole('button', { name: 'Закрыть', exact: true }).focus();
  await page.keyboard.press('n');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+z');
  expect(await cards.count()).toBe(count);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await modal.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  const png = await exportedPng(page);
  expect(png.width).toBeGreaterThan(2000);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Экспорт', exact: true })).toBeFocused();
});

test.describe('телефон', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  test('PNG имеет выбранный масштаб независимо от DPR, диалог помещается на экране', async ({
    page,
  }, testInfo) => {
    await page.goto('/e2e/export-fixture.html?theme=dark');
    await page.getByRole('radio', { name: 'Выделение', exact: true }).check();
    await page.getByRole('radio', { name: '2×', exact: true }).check();
    const button = page.getByRole('button', { name: 'Сохранить PNG…' });
    await expect(button).toBeInViewport();
    const png = await exportedPng(page);
    expect(png.width).toBe(736);
    expect(png.height).toBe(576);
    await page.screenshot({ path: testInfo.outputPath('mobile-export.png') });
  });
});

test('замер холста на 1000 карточках завершается после изменений интерфейса', async ({
  page,
}, testInfo) => {
  await page.goto('/#benchmark');
  await page.getByRole('button', { name: 'Автозамер (6 секунд)' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4, { timeout: 15_000 });
  const rows = await page.locator('tbody tr').allTextContents();
  await testInfo.attach('benchmark.json', {
    body: JSON.stringify(rows),
    contentType: 'application/json',
  });
  await page.screenshot({ path: testInfo.outputPath('benchmark.png') });
});

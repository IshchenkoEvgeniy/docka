import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

interface Item {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
}
async function state(page: Page): Promise<Item[]> {
  // output формируется только из проверенных записей тестовой доски.
  return JSON.parse((await page.getByTestId('elements').textContent()) ?? '[]') as Item[];
}
const element = (page: Page, id: string) => page.locator(`[data-element-id="${id}"]`).first();

async function frameBorderPixels(page: Page, base64: string) {
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
    // Левая сторона каждой зоны; карточки и подписи не попадают в эти точки.
    return {
      neutral: Array.from(context.getImageData(24, 200, 1, 1).data),
      blue: Array.from(context.getImageData(864, 200, 1, 1).data),
    };
  }, base64);
}

test('рамка переносится с вложенной зоной и колонкой; один шаг отмены и повтор', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  await page.goto('/e2e/frames-fixture.html');
  const header = page.getByText('Персонажи и сюжет', { exact: true });
  await expect(header).toBeVisible();
  const before = await state(page);
  const box = await header.boundingBox();
  if (box === null) throw new Error('Нет заголовка');
  await page.mouse.move(box.x + 60, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 90, { steps: 12 });
  await page.mouse.up();
  const after = await state(page),
    dx = after[0].x - before[0].x,
    dy = after[0].y - before[0].y;
  expect(dx).toBeGreaterThan(60);
  expect(dy).toBeGreaterThan(40);
  for (const i of [1, 2, 3, 6])
    expect(after[i]).toMatchObject({ x: before[i].x + dx, y: before[i].y + dy });
  for (const i of [4, 5, 7, 8, 9])
    expect(after[i]).toMatchObject({
      x: before[i].x,
      y: before[i].y,
      parentId: before[i].parentId,
    });
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  expect(await state(page)).toEqual(before);
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  expect(await state(page)).toEqual(after);
  await page.getByRole('button', { name: 'Рамки', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Рамки' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('frames-dark.png') });
  expect(errors).toEqual([]);
});

test('список рамок, переход и обведение выделенного с редактируемым названием', async ({
  page,
}, info) => {
  await page.goto('/e2e/frames-fixture.html?theme=light');
  await page.getByRole('button', { name: 'Рамки', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Рамки' });
  await expect(panel.getByRole('listitem')).toHaveCount(3);
  await panel.getByRole('button', { name: 'Локации', exact: true }).click();
  await expect(panel).not.toBeVisible();
  const all = await state(page),
    target = element(page, all[7].id);
  const box = await target.boundingBox();
  if (box === null) throw new Error('Нет рамки');
  expect(box.x).toBeGreaterThan(76);
  expect(box.x + box.width).toBeLessThan(1280);
  await page.getByText('Северная гавань', { exact: true }).click();
  await page.getByRole('button', { name: 'Рамки', exact: true }).click();
  await panel.getByRole('button', { name: 'Обвести выделенное рамкой', exact: true }).click();
  const editor = page.locator('[contenteditable="true"]');
  await expect(editor).toBeVisible();
  await editor.fill('Порт и окрестности');
  await editor.press('Escape');
  await page.getByRole('button', { name: 'Рамки', exact: true }).click();
  await expect(
    panel.getByRole('button', { name: 'Порт и окрестности', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('frames-light.png') });
});

test('пустая середина рамки пропускает нажатия; создание, размер и удаление сохраняют карточки', async ({
  page,
}) => {
  await page.goto('/e2e/frames-fixture.html');
  await page.getByText('Персонажи и сюжет', { exact: true }).click();
  const before = await state(page),
    outer = element(page, before[0].id);
  const box = await outer.boundingBox();
  if (box === null) throw new Error('Нет рамки');
  // Пустое место внутри зоны снимает выделение — рамка не перехватывает всю площадь.
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.9);
  await expect(outer.locator('[data-resize-handle]')).toHaveCount(0);
  await page.mouse.click(box.x + 1, box.y + box.height / 2 + 40);
  const handle = outer.locator('[data-resize-handle="se"]');
  const grip = await handle.boundingBox();
  if (grip === null) throw new Error('Нет ручки');
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + 55, grip.y + 45, { steps: 8 });
  await page.mouse.up();
  const resized = await state(page);
  expect(resized[0].width).toBeGreaterThan(before[0].width);
  expect(resized[2]).toEqual(before[2]);
  await page.keyboard.press('Delete');
  await expect(page.getByText('Персонажи и сюжет', { exact: true })).not.toBeVisible();
  expect(await state(page)).toHaveLength(9);
  await expect(page.getByText('Смотритель маяка', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Рамка', exact: true }).click();
  const editor = page.locator('[contenteditable="true"]');
  await expect(editor).toBeVisible();
  await editor.press('Escape');
  await page.getByRole('button', { name: 'Рамки', exact: true }).click();
  await expect(
    page.getByRole('complementary', { name: 'Рамки' }).getByRole('button', { name: /^Рамка \d+$/ }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Рамки', exact: true })).toBeFocused();
});

test('рамки доступны на телефоне и их названия входят в PNG', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/e2e/frames-fixture.html');
  const frames = page.getByRole('button', { name: 'Рамки', exact: true });
  await frames.click();
  const panel = page.getByRole('complementary', { name: 'Рамки' });
  const box = await panel.boundingBox();
  if (box === null) throw new Error('Нет списка');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('frames-mobile.png') });
  await panel.getByRole('button', { name: 'Побочные квесты', exact: true }).click();
  await expect(page.getByText('Письмо домой', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Экспорт', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить PNG…', exact: true }).click();
  const file = await download;
  await file.saveAs(info.outputPath('frames.png'));
  const pixels = await frameBorderPixels(
    page,
    (await readFile(await file.path())).toString('base64'),
  );
  expect(pixels.neutral[0]).toBeGreaterThan(100);
  expect(pixels.blue[2]).toBeGreaterThan(100);
  await expect(page.getByRole('status')).toContainText('сохранён');
});

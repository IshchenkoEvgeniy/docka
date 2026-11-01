import { expect, test, type Locator, type Page } from '@playwright/test';

interface Item {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
async function state(page: Page): Promise<Item[]> {
  // Записи сформированы проверенной тестовой доской.
  return JSON.parse((await page.getByTestId('elements').textContent()) ?? '[]') as Item[];
}
const element = (page: Page, id: string) => page.locator(`[data-element-id="${id}"]`).first();
async function start(page: Page, grip: Locator) {
  const box = await grip.boundingBox();
  if (box === null) throw new Error('Нет ручки');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  return point;
}

test('восемь ручек, левый верхний угол, показ размера и одна отмена', async ({ page }, info) => {
  await page.goto('/e2e/resize-fixture.html');
  await page.getByText('Фигура', { exact: true }).click();
  const before = await state(page),
    frame = element(page, before[0].id);
  await expect(frame.locator('[data-resize-handle]')).toHaveCount(8);
  const point = await start(page, frame.locator('[data-resize-handle="nw"]'));
  await page.mouse.move(point.x - 60, point.y - 40, { steps: 8 });
  await expect(frame.locator('output')).toHaveText('360 × 240');
  expect(await state(page)).toEqual(before);
  await page.screenshot({ path: info.outputPath('resize-dark.png') });
  await page.mouse.up();
  expect((await state(page))[0]).toMatchObject({ x: 20, y: 60, width: 360, height: 240 });
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  expect(await state(page)).toEqual(before);
});

test('Shift сохраняет пропорции, Alt сохраняет центр, Escape отменяет жест', async ({ page }) => {
  await page.goto('/e2e/resize-fixture.html?theme=light');
  await page.getByText('Фигура', { exact: true }).click();
  const before = await state(page),
    frame = element(page, before[0].id);
  await page.keyboard.down('Shift');
  await page.keyboard.down('Alt');
  const point = await start(page, frame.locator('[data-resize-handle="se"]'));
  await page.mouse.move(point.x + 30, point.y, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  await page.keyboard.up('Shift');
  expect((await state(page))[0]).toMatchObject({ x: 50, y: 80, width: 360, height: 240 });
  const committed = await state(page);
  const corner = await start(page, frame.locator('[data-resize-handle="ne"]'));
  await page.mouse.move(corner.x + 60, corner.y - 40);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(await state(page)).toEqual(committed);
});

test('картинку можно тянуть вертикально, а текст — с обеих сторон', async ({ page }, info) => {
  await page.goto('/e2e/resize-fixture.html?theme=light');
  const before = await state(page),
    image = element(page, before[1].id);
  await image.click();
  await expect(image.locator('[data-resize-handle]')).toHaveCount(8);
  const point = await start(page, image.locator('[data-resize-handle="s"]'));
  await page.mouse.move(point.x, point.y + 40, { steps: 8 });
  await page.mouse.up();
  expect((await state(page))[1]).toMatchObject({ x: 470, y: 100, width: 360, height: 240 });
  await page.screenshot({ path: info.outputPath('resize-light.png') });
  const note = element(page, before[2].id);
  await note.click();
  await expect(note.locator('[data-resize-handle]')).toHaveCount(2);
  const edge = await start(page, note.locator('[data-resize-handle="w"]'));
  await page.mouse.move(edge.x - 40, edge.y + 25);
  await page.mouse.up();
  expect((await state(page))[2]).toMatchObject({ x: 40, y: 420, width: 340 });
});

test('на телефоне ручки имеют область захвата 44 px и работают пальцем', async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto('/e2e/resize-fixture.html');
  await page.getByText('Фигура', { exact: true }).tap();
  const before = await state(page),
    frame = element(page, before[0].id);
  const handle = frame.locator('[data-resize-handle="w"]');
  const frameBox = await frame.boundingBox();
  if (frameBox === null) throw new Error('Нет фигуры');
  const zoom = frameBox.width / before[0].width;
  const box = await handle.boundingBox();
  if (box === null) throw new Error('Нет ручки');
  expect(box.width).toBeCloseTo(44, 0);
  expect(box.height).toBeCloseTo(44, 0);
  const session = await context.newCDPSession(page);
  const x = box.x + 22,
    y = box.y + 22;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x - 40, y }],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const grown = (await state(page))[0];
  expect(grown.width).toBeCloseTo(300 + 40 / zoom, 0);
  expect(grown.x + grown.width).toBe(380);
  expect(grown).toMatchObject({ y: 100, height: 200 });
  await page.screenshot({ path: info.outputPath('resize-mobile.png') });
  await context.close();
});

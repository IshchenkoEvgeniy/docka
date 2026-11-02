import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

for (const bottomInset of [0, 48]) {
  test(`панель элементов компактная, нижний системный отступ ${String(bottomInset)} px учтён один раз`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await page.addStyleTag({ content: `:root { --safe-area-bottom: ${String(bottomInset)}px; }` });
    await page.getByRole('button', { name: /^Пример/ }).click();
    await page.getByRole('button', { name: /Пример 48 карточек/ }).click();
    const hide = page.getByRole('button', { name: 'Скрыть панель элементов', exact: true });
    const palette = page.locator('nav').filter({ has: hide });
    const status = page.getByText('Сохранено на устройстве', { exact: true }).locator('..');
    await expect(hide).toBeVisible();
    const [bar, footer] = [await palette.boundingBox(), await status.boundingBox()];
    if (bar === null || footer === null) throw new Error('Нет нижней панели');
    expect(bar.height).toBeLessThanOrEqual(64);
    expect(bar.y + bar.height).toBeCloseTo(footer.y, 0);
    expect(await status.evaluate((node) => parseFloat(getComputedStyle(node).paddingBottom))).toBe(
      4 + bottomInset,
    );
    const note = page.getByRole('button', { name: 'Заметка', exact: true });
    const target = await note.boundingBox();
    if (target === null) throw new Error('Нет кнопки');
    expect(target.height).toBeGreaterThanOrEqual(44);
    const label = await note.locator('span').last().boundingBox();
    if (label === null) throw new Error('Нет подписи');
    expect(label.y + label.height).toBeLessThanOrEqual(bar.y + bar.height);
    await page.screenshot({ path: info.outputPath(`compact-palette-${String(bottomInset)}.png`) });
    await hide.click();
    const canvas = await page.locator('[data-canvas-background]').first().boundingBox();
    if (canvas === null) throw new Error('Нет холста');
    expect(canvas.y + canvas.height).toBeCloseTo(footer.y, 0);
    await expect(
      page.getByRole('button', { name: 'Показать панель элементов', exact: true }),
    ).toBeInViewport();
  });
}

test('на компьютере одна кнопка «Ещё», меню остаётся рядом с указателем', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    hasTouch: false,
    isMobile: false,
  });
  const page = await context.newPage();
  await page.goto('/e2e/frames-fixture.html');
  await expect(page.getByRole('button', { name: 'Ещё', exact: true })).toHaveCount(1);
  await page.getByText('Смотритель маяка', { exact: true }).click({ button: 'right' });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  if (box === null) throw new Error('Нет меню');
  expect(box.width).toBeLessThan(400);
  expect(box.x + box.width).toBeLessThanOrEqual(1280);
  expect(box.y + box.height).toBeLessThanOrEqual(800);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await context.close();
});

test('длинное меню на телефоне ограничено по высоте, прокручивается и закрывается', async ({
  page,
}, info) => {
  await page.goto('/e2e/frames-fixture.html');
  await page.getByRole('button', { name: 'Ещё', exact: true }).click();
  const menu = page.getByRole('menu');
  const box = await menu.boundingBox();
  if (box === null) throw new Error('Нет меню');
  expect(box.height).toBeLessThan(780 * 0.65);
  const behavior = await menu.evaluate((node) => ({
    touch: getComputedStyle(node).touchAction,
    select: getComputedStyle(node).userSelect,
    overflow: node.scrollHeight > node.clientHeight,
  }));
  expect(behavior).toEqual({ touch: 'pan-y', select: 'none', overflow: true });
  await page.screenshot({ path: info.outputPath('menu-dark.png') });
  const session = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2,
    y = box.y + box.height - 30;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let step = 1; step <= 8; step += 1)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - step * 35 }],
    });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem').last()).toBeInViewport();
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ещё', exact: true })).toBeFocused();
});

test('панели управления и элементов можно свернуть, важные кнопки помещаются на 320 px', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/e2e/frames-fixture.html?theme=light');
  const controls = page.getByRole('button', { name: 'Управление', exact: true });
  await expect(controls).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Сетка', exact: true })).not.toBeVisible();
  await controls.click();
  await expect(page.getByRole('button', { name: 'Сетка', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('controls-expanded-320.png') });
  await controls.click();
  await page.getByRole('button', { name: 'Скрыть панель элементов', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Заметка', exact: true })).not.toBeVisible();
  await page.screenshot({ path: info.outputPath('controls-light-320.png') });
  const show = page.getByRole('button', { name: 'Показать панель элементов', exact: true });
  await expect(show).toBeInViewport();
  await show.click();
  await expect(page.getByRole('button', { name: 'Заметка', exact: true })).toBeVisible();
  const toolbar = page.getByRole('toolbar');
  expect(await toolbar.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
});

test('меню учитывает экранную клавиатуру и удерживает фокус', async ({ page }) => {
  await page.addInitScript(() => {
    if (window.visualViewport !== null) {
      Object.defineProperty(window.visualViewport, 'height', { value: 420, configurable: true });
      Object.defineProperty(window.visualViewport, 'offsetTop', { value: 20, configurable: true });
    }
  });
  await page.goto('/e2e/frames-fixture.html');
  await page.getByRole('button', { name: 'Ещё', exact: true }).tap();
  const modal = page.getByRole('dialog');
  const close = modal.getByRole('button', { name: 'Закрыть', exact: true });
  await expect(close).toBeInViewport();
  const box = await page.getByRole('menu').boundingBox();
  if (box === null) throw new Error('Нет меню');
  expect(box.y + box.height).toBeLessThanOrEqual(440);
  await close.focus();
  for (let i = 0; i < 18; i += 1) {
    await page.keyboard.press('Tab');
    expect(await modal.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
});

test('нижнее меню не пропускает нажатия и команды удаления на холст', async ({ page }, info) => {
  await page.goto('/e2e/frames-fixture.html?theme=light');
  const card = await page.getByText('Смотритель маяка', { exact: true }).boundingBox();
  if (card === null) throw new Error('Нет карточки');
  const before = await page.getByTestId('elements').textContent();
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: card.x + card.width / 2, y: card.y + card.height / 2 }],
  });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.keyboard.press('Delete');
  expect(await page.getByTestId('elements').textContent()).toBe(before);
  await menu.getByRole('menuitem', { name: 'Копировать', exact: true }).press('ArrowDown');
  await page.screenshot({ path: info.outputPath('actions-light.png') });
  await page.mouse.click(10, 100);
  await expect(menu).toHaveCount(0);
  expect(await page.getByTestId('elements').textContent()).toBe(before);
  await page.getByRole('button', { name: 'Действия', exact: true }).tap();
  await menu.getByRole('menuitem', { name: 'Копировать', exact: true }).tap();
  await expect(menu).toHaveCount(0);
});

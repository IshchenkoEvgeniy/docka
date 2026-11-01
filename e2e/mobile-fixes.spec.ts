import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('телефон: заметка и колонка редактируются в карточке, без полноэкранного окна', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  // Имитируем уменьшение visualViewport экранной клавиатурой при прежнем layout viewport.
  await page.addInitScript(() => {
    if (window.visualViewport !== null)
      Object.defineProperty(window.visualViewport, 'height', { value: 420, configurable: true });
  });
  await page.goto('/e2e/board-previews-fixture.html');
  await expect(page.locator('[data-linked-board]')).toHaveCount(6);
  for (const [tool, text] of [
    ['Заметка', 'Мысль на холсте'],
    ['Колонка', 'План главы'],
    ['Рамка', 'План локаций'],
  ]) {
    await page.getByRole('button', { name: tool, exact: true }).click();
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible();
    await expect(editor).toBeInViewport();
    const box = await editor.boundingBox();
    expect(box === null ? Infinity : box.y + box.height).toBeLessThan(420);
    await expect(page.locator('[aria-modal="true"], dialog[open]')).toHaveCount(0);
    await expect(editor.locator('xpath=ancestor::*[@data-element-id]')).toHaveCount(1);
    await editor.fill(text);
    await page.screenshot({ path: info.outputPath(`inline-${tool}.png`) });
    await page.getByRole('button', { name: 'Готово', exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('телефон: кнопка «Вставить» получает изображение через Android-мост', async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.set(window, 'DoskaAndroid', {
      readClipboard: (id: string) => {
        const svg =
          '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="red"/></svg>';
        window.dispatchEvent(
          new CustomEvent('doska-clipboard-result', {
            detail: {
              id,
              items: [
                { kind: 'file', name: 'clipboard.svg', mime: 'image/svg+xml', base64: btoa(svg) },
              ],
            },
          }),
        );
      },
    });
  });
  await page.goto('/e2e/board-previews-fixture.html');
  await page.getByRole('button', { name: 'Управление', exact: true }).click();
  await page.getByRole('button', { name: 'Вставить', exact: true }).click();
  const image = page.getByRole('img', { name: 'clipboard.svg', exact: true });
  await expect(image).toBeVisible();
  expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(240);
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  await expect(image).toHaveCount(0);
});

test('телефон: изображение из paste вставляется и при открытом текстовом редакторе', async ({
  page,
}) => {
  await page.goto('/e2e/board-previews-fixture.html');
  await page.getByRole('button', { name: 'Заметка', exact: true }).click();
  const editor = page.locator('[contenteditable="true"]');
  await editor.fill('Текст остаётся в заметке');
  await editor.evaluate((node) => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="blue"/></svg>';
    const transfer = new DataTransfer();
    transfer.items.add(new File([svg], 'pasted.svg', { type: 'image/svg+xml' }));
    node.dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }),
    );
  });
  await expect(page.getByRole('img', { name: 'pasted.svg', exact: true })).toBeVisible();
  await expect(page.getByText('Текст остаётся в заметке', { exact: true })).toBeVisible();
  await expect(editor).toHaveCount(0);
});

test('проект удаляется только после подтверждения названия; отмена сохраняет проект', async ({
  page,
}, info) => {
  await page.goto('/');
  const remove = page.getByRole('button', { name: 'Удалить проект «Пример»', exact: true });
  await expect(remove).toBeVisible();
  await remove.click();
  const dialog = page.getByRole('dialog', { name: 'Удалить проект «Пример»' });
  await expect(dialog.getByRole('button', { name: 'Удалить проект', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('delete-project-mobile.png') });
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(remove).toBeVisible();
  await remove.click();
  await dialog.getByRole('textbox').fill('Другой проект');
  await expect(dialog.getByRole('button', { name: 'Удалить проект', exact: true })).toBeDisabled();
  await dialog.getByRole('textbox').fill('Пример');
  await dialog.getByRole('button', { name: 'Удалить проект', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(remove).toHaveCount(0);
  // Повторная загрузка списка по фокусу не возвращает удалённую папку.
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
  });
  await expect(page.getByText('Проектов пока нет.', { exact: false })).toBeVisible();
});

test('внешний проект удаляется из своей папки и списка после закрытия', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Новый проект', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Новый проект', exact: true });
  await creation
    .getByRole('textbox', { name: 'Название проекта', exact: true })
    .fill('Внешний проект');
  page.once('dialog', (dialog) => {
    void dialog.accept('/Игры');
  });
  await creation.getByRole('button', { name: 'Другая папка…', exact: true }).click();
  await creation.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.getByRole('button', { name: '← Проекты', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить проект «Внешний проект»', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Удалить проект «Внешний проект»' });
  await expect(dialog).toContainText('/Игры/Внешний проект.doska');
  await dialog.getByRole('textbox').fill('Внешний проект');
  await dialog.getByRole('button', { name: 'Удалить проект', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Удалить проект «Внешний проект»', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Удалить проект «Пример»', exact: true }),
  ).toBeVisible();
});

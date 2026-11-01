const NOT_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'range',
  'color',
  'file',
]);

/** Модальное окно блокирует команды фонового экрана и его буфер обмена. */
export function isModalOpen(): boolean {
  return document.querySelector('dialog[open], [aria-modal="true"]') !== null;
}

/** Фокус в поле ввода текста: горячие клавиши и буфер обмена приложения не должны мешать печатать. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NOT_TEXT_INPUTS.has(target.type);
  return (
    target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

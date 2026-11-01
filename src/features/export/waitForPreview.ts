import { t } from '../../i18n';

/** В экспорт попадают также невидимые на холсте доски: ждём их миниатюры и локальные картинки. */
export function waitForPreviews(node: HTMLElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = (): void => {
      if (node.querySelector('[data-preview-state="loading"], [data-asset-loading]') !== null)
        return;
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(check);
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(t('export.failed')));
    }, 30_000);
    observer.observe(node, { childList: true, subtree: true, attributes: true });
    check();
  });
}

import { createPortal } from 'react-dom';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { t } from '../../i18n';
import { cx } from '../../ui';
import type { MentionPopup } from './mentions';
import styles from './Text.module.css';

/**
 * Список сущностей под набранным `@…`: стрелки, Enter, щелчок. В портале: внутри холста
 * (transform) position: fixed отсчитывался бы от холста, а не от окна.
 */
export function MentionPopupView({ popup }: { readonly popup: StoreApi<MentionPopup> }) {
  const { items, index, rect, select } = useStore(popup);
  if (rect === null || select === null) return null;
  return createPortal(
    <div
      className={styles.mentionPopup}
      role="listbox"
      aria-label={t('entities.mention.label')}
      style={{ left: rect.left, top: rect.bottom + 4 }}
    >
      {items.length === 0 && (
        <div className={styles.mentionEmpty}>{t('entities.mention.empty')}</div>
      )}
      {items.map((item, position) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={position === index}
          className={cx(styles.mentionItem, position === index && styles.mentionActive)}
          // Фокус остаётся в редакторе, иначе выбор закрыл бы правку.
          onPointerDown={(event) => {
            event.preventDefault();
            select(item);
          }}
        >
          <span>{item.label}</span>
          <span className={styles.mentionHint}>{item.hint}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

import { useEffect, useState } from 'react';
import type { BoardElement } from '../../core';
import { fragmentToRich, readElements, textOf } from '../../data';
import { definitionFor } from '../../elements';
import { formatDateTime, t } from '../../i18n';
import { Button, Dialog } from '../../ui';
import type { BoardModel } from './model';
import styles from './Palette.module.css';

const SHOWN = 100;
const SNIPPET = 80;

/** Удалённые с этой доски (карточки колонок — вместе с колонкой), свежие сверху. */
function deletedElements(model: BoardModel): BoardElement[] {
  const all = readElements(model.doc).items;
  const deleted = new Set(all.filter((item) => item.deletedAt !== null).map((item) => item.id));
  return all
    .filter(
      (item) => item.deletedAt !== null && (item.parentId === null || !deleted.has(item.parentId)),
    )
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
    .slice(0, SHOWN);
}

function describe(model: BoardModel, element: BoardElement): string {
  const definition = definitionFor(element.type);
  const fragment = textOf(model.doc, element.id);
  const text = definition
    .toPlainText(element, fragment === null ? null : fragmentToRich(fragment))
    .replace(/\s+/g, ' ')
    .trim();
  const label = definition.label();
  return text === '' ? label : `${label}: ${text.slice(0, SNIPPET)}`;
}

function useDeleted(model: BoardModel): BoardElement[] {
  const [items, setItems] = useState(() => deletedElements(model));
  useEffect(() => {
    const update = (): void => {
      setItems(deletedElements(model));
    };
    model.doc.on('update', update);
    return () => {
      model.doc.off('update', update);
    };
  }, [model]);
  return items;
}

/** Корзина доски: удалённое за последние 30 дней можно вернуть на место. */
export function TrashDialog({
  model,
  onClose,
}: {
  readonly model: BoardModel;
  readonly onClose: () => void;
}) {
  const items = useDeleted(model);
  return (
    <Dialog title={t('board.trash.title')} closeLabel={t('common.close')} onClose={onClose}>
      {items.length === 0 ? (
        <p className={styles.trashEmpty}>{t('board.trash.empty')}</p>
      ) : (
        <ul className={styles.trashList}>
          {items.map((element) => (
            <li key={element.id} className={styles.trashItem}>
              <span className={styles.trashText}>{describe(model, element)}</span>
              <span className={styles.trashDate}>{formatDateTime(element.deletedAt ?? 0)}</span>
              <Button
                variant="ghost"
                onClick={() => {
                  model.run({
                    kind: 'restoreElements',
                    elementIds: [element.id],
                  });
                }}
              >
                {t('board.trash.restore')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.trashHint}>{t('board.trash.hint')}</p>
    </Dialog>
  );
}

import { useState, type KeyboardEvent } from 'react';
import { z } from 'zod';
import { CONTROL_ATTRIBUTE } from '../../canvas';
import { richTextToPlain } from '../../core';
import { t } from '../../i18n';
import { cardColor, cx } from '../../ui';
import { defineElement } from '../defineElement';
import { newLocalId } from '../localId';
import { useElementRuntime } from '../runtime';
import { TextBlock, useMeasuredHeight } from '../text';
import type { ElementViewProps } from '../types';
import styles from './Checklist.module.css';

/**
 * Пункты — объект по id (в Yjs это вложенные карты): отметки и правки разных пунктов
 * с разных устройств не затирают друг друга. Удалённый пункт помечается removed.
 */
const ItemSchema = z.object({
  text: z.string().max(2000),
  done: z.boolean(),
  order: z.number(),
  removed: z.boolean().optional(),
});
const ChecklistDataSchema = z.object({ items: z.record(z.string(), ItemSchema).optional() });
type ChecklistData = z.infer<typeof ChecklistDataSchema>;
type Item = z.infer<typeof ItemSchema> & { readonly id: string };

const control = { [CONTROL_ATTRIBUTE]: '' };

function liveItems(data: ChecklistData): Item[] {
  return Object.entries(data.items ?? {})
    .filter(([, item]) => item.removed !== true)
    .map(([id, item]) => ({ ...item, id }))
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
}

function ItemRow({
  elementId,
  item,
  next,
  focus,
  onFocused,
}: {
  readonly elementId: string;
  readonly item: Item;
  readonly next: Item | undefined;
  readonly focus: boolean;
  readonly onFocused: (id: string | null) => void;
}) {
  const runtime = useElementRuntime();
  const [text, setText] = useState(item.text);
  const update = (changes: Partial<z.infer<typeof ItemSchema>>) => {
    runtime.updateData(elementId, { items: { [item.id]: changes } });
  };
  const commit = (): void => {
    if (text !== item.text) update({ text });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
      const id = newLocalId();
      const order = next === undefined ? item.order + 1 : (item.order + next.order) / 2;
      runtime.updateData(elementId, { items: { [id]: { text: '', done: false, order } } });
      onFocused(id);
    } else if (event.key === 'Backspace' && text === '') {
      event.preventDefault();
      update({ removed: true });
    } else if (event.key === 'Escape') {
      (event.target as HTMLInputElement).blur();
    }
  };
  return (
    <li className={styles.item}>
      <input
        {...control}
        type="checkbox"
        className={styles.check}
        checked={item.done}
        aria-label={t('elements.checklist.done')}
        onChange={(event) => {
          update({ done: event.target.checked });
        }}
      />
      <input
        {...control}
        className={cx(styles.text, item.done && styles.doneText)}
        value={text}
        autoFocus={focus}
        placeholder={t('elements.checklist.itemPlaceholder')}
        aria-label={t('elements.checklist.item')}
        onFocus={() => {
          onFocused(null);
        }}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </li>
  );
}

function ChecklistView({ element, data, editing }: ElementViewProps<ChecklistData>) {
  const runtime = useElementRuntime();
  const ref = useMeasuredHeight(element.id);
  const [focusId, setFocusId] = useState<string | null>(null);
  const items = liveItems(data);
  const done = items.filter((item) => item.done).length;
  const add = (): void => {
    const id = newLocalId();
    const order = (items.at(-1)?.order ?? 0) + 1;
    runtime.updateData(element.id, { items: { [id]: { text: '', done: false, order } } });
    setFocusId(id);
  };
  return (
    <div ref={ref} className={styles.checklist} style={{ background: cardColor(element.color) }}>
      <div className={styles.header}>
        <div className={styles.title}>
          <TextBlock
            element={element}
            legacyText=""
            editing={editing}
            placeholder={t('elements.checklist.title')}
          />
        </div>
        <span className={styles.progress}>{`${String(done)}/${String(items.length)}`}</span>
      </div>
      <ul className={styles.items}>
        {items.map((item, index) => (
          <ItemRow
            key={`${item.id}:${item.text}`}
            elementId={element.id}
            item={item}
            next={items[index + 1]}
            focus={item.id === focusId}
            onFocused={setFocusId}
          />
        ))}
      </ul>
      <button {...control} type="button" className={styles.add} onClick={add}>
        {t('elements.checklist.add')}
      </button>
    </div>
  );
}

export const checklist = defineElement<ChecklistData>({
  type: 'checklist',
  label: () => t('elementTypes.checklist'),
  dataSchema: ChecklistDataSchema,
  defaultSize: { width: 280, height: 140 },
  minSize: { width: 180, height: 80 },
  resize: 'width',
  richText: true,
  activate: 'edit',
  editOnCreate: false,
  createData: () => ({ items: { [newLocalId()]: { text: '', done: false, order: 1 } } }),
  View: ChecklistView,
  openTasks: (data) =>
    liveItems(data).filter((item) => !item.done && item.text.trim() !== '').length,
  toPlainText: (data, rich) => {
    const title = rich === null ? '' : richTextToPlain(rich);
    const lines = liveItems(data).map((item) => `${item.done ? '[x]' : '[ ]'} ${item.text}`);
    return [title, ...lines].filter((line) => line !== '').join('\n');
  },
  toRichText: (_data, rich) => rich ?? [],
});

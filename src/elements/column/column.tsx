import { useMemo, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { CONTROL_ATTRIBUTE } from '../../canvas';
import { richTextToPlain, type BoardElement } from '../../core';
import { t } from '../../i18n';
import { cardColor } from '../../ui';
import { defineElement } from '../defineElement';
import { useElementRuntime } from '../runtime';
import { TextBlock, useMeasuredHeight } from '../text';
import type { ElementViewProps } from '../types';
import styles from './Column.module.css';

/** Колонка: заголовок (форматированный текст) и список карточек, которые лежат в ней. */
const ColumnDataSchema = z.object({ collapsed: z.boolean().optional() });
type ColumnData = z.infer<typeof ColumnDataSchema>;

/** Порядок карточек в колонке — по y (внутри колонки y — просто ключ порядка). */
export function compareInColumn(a: BoardElement, b: BoardElement): number {
  if (a.y !== b.y) return a.y - b.y;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function useChildren(columnId: string): BoardElement[] {
  const { elements } = useElementRuntime();
  const snapshot = useSyncExternalStore(elements.subscribe, elements.getSnapshot);
  return useMemo(
    () => [...snapshot.values()].filter((item) => item.parentId === columnId).sort(compareInColumn),
    [snapshot, columnId],
  );
}

function ColumnView({ element, data, editing }: ElementViewProps<ColumnData>) {
  const runtime = useElementRuntime();
  const children = useChildren(element.id);
  const ref = useMeasuredHeight(element.id);
  const collapsed = data.collapsed === true;
  const { ChildView } = runtime;
  const control = { [CONTROL_ATTRIBUTE]: '' };
  return (
    <div ref={ref} className={styles.column} style={{ background: cardColor(element.color) }}>
      <div className={styles.header}>
        <button
          {...control}
          type="button"
          className={styles.toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('elements.column.expand') : t('elements.column.collapse')}
          onClick={() => {
            runtime.updateData(element.id, { collapsed: !collapsed });
          }}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <div className={styles.title}>
          <TextBlock
            element={element}
            legacyText=""
            editing={editing}
            placeholder={t('elements.column.title')}
          />
        </div>
        <span className={styles.count}>{children.length}</span>
      </div>
      {!collapsed && (
        <div className={styles.list}>
          {children.map((child) => (
            <ChildView key={child.id} element={child} />
          ))}
          {children.length === 0 && (
            <div className={styles.empty}>{t('elements.column.empty')}</div>
          )}
        </div>
      )}
    </div>
  );
}

export const column = defineElement<ColumnData>({
  type: 'column',
  label: () => t('elementTypes.column'),
  dataSchema: ColumnDataSchema,
  defaultSize: { width: 280, height: 120 },
  minSize: { width: 200, height: 60 },
  resize: 'width',
  richText: true,
  activate: 'edit',
  container: true,
  createData: () => ({}),
  View: ColumnView,
  toPlainText: (_data, rich) => (rich === null ? '' : richTextToPlain(rich)),
  toRichText: (_data, rich) => rich ?? [],
});

import { z } from 'zod';
import { richTextToPlain } from '../../core';
import { t } from '../../i18n';
import { cardColor, inkColor } from '../../ui';
import { defineElement } from '../defineElement';
import { TextBlock } from '../text';
import type { ElementViewProps } from '../types';
import { SHAPES, shapePath, textInset } from './outline';
import styles from './Shape.module.css';

/** Фигура блок-схемы с текстом внутри (ТЗ, раздел 5). */
const ShapeDataSchema = z.object({ shape: z.enum(SHAPES) });
type ShapeData = z.infer<typeof ShapeDataSchema>;

function ShapeView({ element, data, editing }: ElementViewProps<ShapeData>) {
  const { width, height } = element;
  const fill = element.color === 'default' ? 'var(--color-surface)' : cardColor(element.color);
  return (
    <div className={styles.shape}>
      <svg
        className={styles.outline}
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={shapePath(data.shape, width, height)}
          fill={fill}
          stroke={inkColor(element.color)}
        />
      </svg>
      <div className={styles.text} style={{ padding: textInset(data.shape) }}>
        <TextBlock
          element={element}
          legacyText=""
          editing={editing}
          placeholder={t('elements.shape.empty')}
        />
      </div>
    </div>
  );
}

export const shape = defineElement<ShapeData>({
  type: 'shape',
  label: () => t('elementTypes.shape'),
  dataSchema: ShapeDataSchema,
  defaultSize: { width: 180, height: 100 },
  minSize: { width: 48, height: 32 },
  resize: 'both',
  richText: true,
  activate: 'edit',
  createData: () => ({ shape: 'rectangle' }),
  View: ShapeView,
  toPlainText: (_data, rich) => (rich === null ? '' : richTextToPlain(rich)),
  toRichText: (_data, rich) => rich ?? [],
  menuActions: (data) =>
    SHAPES.map((kind) => ({
      id: `shape-${kind}`,
      label: t(`elements.shape.${kind}`),
      checked: data.shape === kind,
      changes: { shape: kind },
    })),
});

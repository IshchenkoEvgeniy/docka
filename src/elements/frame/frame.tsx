import { z } from 'zod';
import { richTextToPlain } from '../../core';
import { t } from '../../i18n';
import { inkColor } from '../../ui';
import { defineElement } from '../defineElement';
import { TextBlock } from '../text';
import type { ElementViewProps } from '../types';
import styles from './Frame.module.css';

const FrameDataSchema = z.object({});
type FrameData = z.infer<typeof FrameDataSchema>;

function FrameView({ element, editing }: ElementViewProps<FrameData>) {
  return (
    <div className={styles.region} style={{ color: inkColor(element.color) }}>
      <div className={styles.border} aria-hidden="true">
        <div className={styles.top} />
        <div className={styles.right} />
        <div className={styles.bottom} />
        <div className={styles.left} />
      </div>
      <div className={styles.heading} data-editing={editing} data-export-bounds="">
        <TextBlock
          element={element}
          legacyText=""
          editing={editing}
          placeholder={t('elementTypes.frame')}
        />
      </div>
    </div>
  );
}

export const frame = defineElement<FrameData>({
  type: 'frame',
  label: () => t('elementTypes.frame'),
  dataSchema: FrameDataSchema,
  defaultSize: { width: 800, height: 500 },
  minSize: { width: 160, height: 120 },
  resize: 'both',
  richText: true,
  activate: 'edit',
  region: true,
  createData: () => ({}),
  View: FrameView,
  toPlainText: (_data, rich) => (rich === null ? '' : richTextToPlain(rich)),
  toRichText: (_data, rich) => rich ?? [],
});

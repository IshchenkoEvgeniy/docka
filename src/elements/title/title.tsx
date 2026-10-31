import { z } from 'zod';
import { richTextToPlain } from '../../core';
import { t } from '../../i18n';
import { defineElement } from '../defineElement';
import { TextBlock, useMeasuredHeight } from '../text';
import type { ElementViewProps } from '../types';
import styles from './Title.module.css';

/** Заголовок: крупный текст прямо на доске, без карточки. */
const TitleDataSchema = z.object({});
type TitleData = z.infer<typeof TitleDataSchema>;

function TitleView({ element, editing }: ElementViewProps<TitleData>) {
  const ref = useMeasuredHeight(element.id);
  return (
    <div ref={ref} className={styles.title}>
      <TextBlock
        element={element}
        legacyText=""
        editing={editing}
        placeholder={t('elements.title.empty')}
      />
    </div>
  );
}

export const title = defineElement<TitleData>({
  type: 'title',
  dataSchema: TitleDataSchema,
  defaultSize: { width: 420, height: 56 },
  minSize: { width: 80, height: 32 },
  resize: 'width',
  richText: true,
  activate: 'edit',
  createData: () => ({}),
  View: TitleView,
  toPlainText: (_data, rich) => (rich === null ? '' : richTextToPlain(rich)),
  toRichText: (_data, rich) => rich ?? [],
});

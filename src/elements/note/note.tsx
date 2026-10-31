import { z } from 'zod';
import { plainToRichText, richTextToPlain } from '../../core';
import { t } from '../../i18n';
import { cardColor } from '../../ui';
import { defineElement } from '../defineElement';
import { TextBlock, useMeasuredHeight } from '../text';
import type { ElementViewProps } from '../types';
import styles from './Note.module.css';

/** Текст заметки — в Yjs (поле text записи); data.text остался у заметок этапа 2. */
const NoteDataSchema = z.object({ text: z.string().max(200_000).optional() });
type NoteData = z.infer<typeof NoteDataSchema>;

function NoteView({ element, data, editing }: ElementViewProps<NoteData>) {
  const ref = useMeasuredHeight(element.id);
  return (
    <div ref={ref} className={styles.note} style={{ background: cardColor(element.color) }}>
      <TextBlock
        element={element}
        legacyText={data.text ?? ''}
        editing={editing}
        placeholder={t('elements.note.empty')}
      />
    </div>
  );
}

export const note = defineElement<NoteData>({
  type: 'note',
  dataSchema: NoteDataSchema,
  defaultSize: { width: 240, height: 48 },
  minSize: { width: 80, height: 40 },
  resize: 'width',
  richText: true,
  activate: 'edit',
  createData: () => ({}),
  View: NoteView,
  toPlainText: (data, rich) => (rich === null ? (data.text ?? '') : richTextToPlain(rich)),
  toRichText: (data, rich) => rich ?? plainToRichText(data.text ?? ''),
});

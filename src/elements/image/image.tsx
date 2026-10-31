import { z } from 'zod';
import { t } from '../../i18n';
import { defineElement } from '../defineElement';
import type { ElementViewProps } from '../types';
import { useAsset } from './useAsset';
import styles from './Image.module.css';

/** Картинка: файл в assets/ проекта по имени-хэшу и её исходный размер. */
const ImageDataSchema = z.object({
  asset: z.string().max(80),
  naturalWidth: z.number().positive().max(100_000),
  naturalHeight: z.number().positive().max(100_000),
  name: z.string().max(260).optional(),
});
type ImageData = z.infer<typeof ImageDataSchema>;

function ImageView({ data }: ElementViewProps<ImageData>) {
  const asset = useAsset(data.asset);
  if (asset.status === 'ready')
    return <img className={styles.image} src={asset.url} alt={data.name ?? ''} draggable={false} />;
  return (
    <div className={styles.placeholder}>
      {asset.status === 'missing' ? t('elements.image.syncing') : ''}
    </div>
  );
}

/** На весь экран: картинка целиком по центру. */
function ImageFullView({ data }: ElementViewProps<ImageData>) {
  const asset = useAsset(data.asset);
  if (asset.status !== 'ready')
    return <p className={styles.viewerMessage}>{t('elements.image.syncing')}</p>;
  return (
    <img
      className={styles.viewerImage}
      src={asset.url}
      alt={data.name ?? t('elements.image.alt')}
    />
  );
}

export const image = defineElement<ImageData>({
  type: 'image',
  label: () => t('elementTypes.image'),
  dataSchema: ImageDataSchema,
  defaultSize: { width: 320, height: 240 },
  minSize: { width: 32, height: 32 },
  resize: 'aspect',
  richText: false,
  activate: 'view',
  createData: () => ({ asset: '', naturalWidth: 1, naturalHeight: 1 }),
  View: ImageView,
  Viewer: ImageFullView,
  toPlainText: (data) => data.name ?? '',
});

import { z } from 'zod';
import { CONTROL_ATTRIBUTE } from '../../canvas';
import { t } from '../../i18n';
import { defineElement } from '../defineElement';
import { useAsset } from '../image';
import { useElementRuntime } from '../runtime';
import { useMeasuredHeight } from '../text';
import type { ElementViewProps, StoredFile } from '../types';
import styles from './Media.module.css';

/** Видео и звук из assets/ проекта со встроенным плеером (ТЗ, раздел 5). */
const MediaDataSchema = z.object({
  asset: z.string().max(80),
  name: z.string().max(260),
  mime: z.string().max(100),
});
type MediaData = z.infer<typeof MediaDataSchema>;

const control = { [CONTROL_ATTRIBUTE]: '' };

function Player({ data, kind }: { readonly data: MediaData; readonly kind: 'video' | 'audio' }) {
  const asset = useAsset(data.asset);
  const runtime = useElementRuntime();
  if (runtime.exporting === true)
    return <div className={styles.placeholder}>{t(`elements.media.export.${kind}`)}</div>;
  if (asset.status !== 'ready')
    return (
      <div className={styles.placeholder}>
        {asset.status === 'missing' ? t('elements.image.syncing') : ''}
      </div>
    );
  // Плеер — элемент управления: щелчки по нему не двигают карточку (её берут за полосу с именем).
  return kind === 'video' ? (
    <video {...control} className={styles.video} src={asset.url} controls preload="metadata" />
  ) : (
    <audio {...control} className={styles.audio} src={asset.url} controls preload="metadata" />
  );
}

function VideoView({ data }: ElementViewProps<MediaData>) {
  return (
    <div className={styles.media}>
      <div className={styles.bar}>{data.name}</div>
      <Player data={data} kind="video" />
    </div>
  );
}

function AudioView({ element, data }: ElementViewProps<MediaData>) {
  const ref = useMeasuredHeight(element.id);
  return (
    <div ref={ref} className={styles.media}>
      <div className={styles.bar}>{data.name}</div>
      <Player data={data} kind="audio" />
    </div>
  );
}

/** Видео на весь экран. */
function VideoFullView({ data }: ElementViewProps<MediaData>) {
  const asset = useAsset(data.asset);
  if (asset.status !== 'ready') return null;
  return <video className={styles.full} src={asset.url} controls autoPlay />;
}

const stored = (file: StoredFile): MediaData => ({
  asset: file.asset,
  name: file.name,
  mime: file.mime,
});

export const video = defineElement<MediaData>({
  type: 'video',
  label: () => t('elementTypes.video'),
  dataSchema: MediaDataSchema,
  defaultSize: { width: 480, height: 300 },
  minSize: { width: 200, height: 140 },
  resize: 'both',
  richText: false,
  activate: 'view',
  createData: () => ({ asset: '', name: '', mime: 'video/mp4' }),
  View: VideoView,
  Viewer: VideoFullView,
  toPlainText: (data) => data.name,
  fromFile: {
    accepts: (mime) => mime.startsWith('video/'),
    create: (file) => ({ data: stored(file), width: 480, height: 300 }),
  },
});

export const audio = defineElement<MediaData>({
  type: 'audio',
  label: () => t('elementTypes.audio'),
  dataSchema: MediaDataSchema,
  defaultSize: { width: 320, height: 96 },
  minSize: { width: 220, height: 80 },
  resize: 'width',
  richText: false,
  activate: null,
  createData: () => ({ asset: '', name: '', mime: 'audio/mpeg' }),
  View: AudioView,
  toPlainText: (data) => data.name,
  fromFile: {
    accepts: (mime) => mime.startsWith('audio/'),
    create: (file) => ({ data: stored(file), width: 320, height: 96 }),
  },
});

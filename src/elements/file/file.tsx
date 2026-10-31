import { z } from 'zod';
import { CONTROL_ATTRIBUTE } from '../../canvas';
import { formatFileSize, t } from '../../i18n';
import { defineElement } from '../defineElement';
import { useAsset } from '../image';
import { useElementRuntime } from '../runtime';
import type { ElementViewProps } from '../types';
import { fileIcon, isPdf } from './kind';
import styles from './File.module.css';

/** Любой файл: значок, имя, размер; PDF — просмотр, остальное — в системной программе. */
const FileDataSchema = z.object({
  asset: z.string().max(80),
  name: z.string().max(260),
  mime: z.string().max(100),
  size: z.number().int().nonnegative(),
});
type FileData = z.infer<typeof FileDataSchema>;

const control = { [CONTROL_ATTRIBUTE]: '' };

function OpenButton({ data }: { readonly data: FileData }) {
  const { openAsset } = useElementRuntime();
  if (openAsset === null) return null;
  return (
    <button
      {...control}
      type="button"
      className={styles.open}
      onClick={() => {
        openAsset(data.asset, data.mime);
      }}
    >
      {t('elements.file.open')}
    </button>
  );
}

function FileView({ data }: ElementViewProps<FileData>) {
  const state = useAsset(data.asset);
  return (
    <div className={styles.file}>
      <span className={styles.icon} aria-hidden="true">
        {fileIcon(data.name)}
      </span>
      <div className={styles.info}>
        <span className={styles.name} title={data.name}>
          {data.name}
        </span>
        <span className={styles.size}>
          {state.status === 'missing' ? t('elements.image.syncing') : formatFileSize(data.size)}
        </span>
      </div>
      <OpenButton data={data} />
    </div>
  );
}

/** На весь экран: PDF — встроенным просмотром WebView; остальное — кнопкой «Открыть». */
function FileFullView({ data }: ElementViewProps<FileData>) {
  const state = useAsset(data.asset);
  if (state.status === 'ready' && isPdf(data.mime, data.name))
    return <iframe className={styles.pdf} src={state.url} title={data.name} />;
  return (
    <div className={styles.fullInfo}>
      <span className={styles.bigIcon} aria-hidden="true">
        {fileIcon(data.name)}
      </span>
      <span>{data.name}</span>
      <OpenButton data={data} />
    </div>
  );
}

export const file = defineElement<FileData>({
  type: 'file',
  label: () => t('elementTypes.file'),
  dataSchema: FileDataSchema,
  defaultSize: { width: 280, height: 72 },
  minSize: { width: 180, height: 72 },
  resize: 'width',
  richText: false,
  activate: 'view',
  createData: () => ({ asset: '', name: '', mime: 'application/octet-stream', size: 0 }),
  View: FileView,
  Viewer: FileFullView,
  toPlainText: (data) => data.name,
  fromFile: {
    accepts: () => true,
    create: (stored) => ({
      data: { asset: stored.asset, name: stored.name, mime: stored.mime, size: stored.size },
      width: 280,
      height: 72,
    }),
  },
});

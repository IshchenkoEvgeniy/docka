import { z } from 'zod';
import { CONTROL_ATTRIBUTE } from '../../canvas';
import { t } from '../../i18n';
import { defineElement } from '../defineElement';
import { useAsset } from '../image';
import { useElementRuntime } from '../runtime';
import { useMeasuredHeight } from '../text';
import type { ElementViewProps } from '../types';
import { fetchPreview } from './preview';
import { embedUrl, hostOf, normalizeUrl } from './url';
import styles from './Link.module.css';

/** Ссылка с превью (ТЗ, раздел 5); превью и встраивание — ADR 0005. */
const LinkDataSchema = z.object({
  url: z.string().max(2000),
  title: z.string().max(300).optional(),
  description: z.string().max(600).optional(),
  siteName: z.string().max(100).optional(),
  /** Картинка превью и значок сайта — файлы в assets/. */
  image: z.string().max(80).optional(),
  icon: z.string().max(80).optional(),
  /** Пользователь включил встроенный плеер (до этого сторонний сайт ничего не загружает). */
  embed: z.boolean().optional(),
});
type LinkData = z.infer<typeof LinkDataSchema>;

const control = { [CONTROL_ATTRIBUTE]: '' };
/** Картинка превью — оформление карточки: подпись (заголовок) уже рядом. */
const DECORATIVE = '';

function Picture({
  asset,
  className,
}: {
  readonly asset: string;
  readonly className: string | undefined;
}) {
  const state = useAsset(asset);
  if (state.status !== 'ready') return null;
  return <img className={className} src={state.url} alt={DECORATIVE} draggable={false} />;
}

function Actions({ element, data }: ElementViewProps<LinkData>) {
  const runtime = useElementRuntime();
  const embeddable = embedUrl(data.url) !== null;
  const button = (label: string, onClick: () => void) => (
    <button {...control} type="button" className={styles.action} onClick={onClick}>
      {label}
    </button>
  );
  return (
    <div className={styles.actions}>
      {button(t('elements.link.open'), () => {
        runtime.openUrl(data.url);
      })}
      {embeddable &&
        button(data.embed === true ? t('elements.link.collapse') : t('elements.link.embed'), () => {
          runtime.updateData(element.id, { embed: data.embed !== true });
        })}
      {button(t('elements.link.refresh'), () => {
        runtime.refresh(element.id);
      })}
    </div>
  );
}

function LinkView({ element, data, editing }: ElementViewProps<LinkData>) {
  const ref = useMeasuredHeight(element.id);
  const embed = data.embed === true ? embedUrl(data.url) : null;
  const site = data.siteName ?? hostOf(data.url);
  return (
    <div ref={ref} className={styles.link}>
      {embed !== null ? (
        <div className={styles.frame}>
          <iframe
            {...control}
            className={styles.iframe}
            src={embed}
            title={data.title ?? site}
            allow="encrypted-media; fullscreen; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        data.image !== undefined && <Picture asset={data.image} className={styles.cover} />
      )}
      <div className={styles.body}>
        <div className={styles.site}>
          {data.icon !== undefined && <Picture asset={data.icon} className={styles.icon} />}
          <span>{site}</span>
        </div>
        <div className={styles.title}>{data.title ?? data.url}</div>
        {data.description !== undefined && embed === null && (
          <div className={styles.description}>{data.description}</div>
        )}
        <Actions element={element} data={data} editing={editing} />
      </div>
    </div>
  );
}

export const link = defineElement<LinkData>({
  type: 'link',
  label: () => t('elementTypes.link'),
  dataSchema: LinkDataSchema,
  defaultSize: { width: 320, height: 120 },
  minSize: { width: 200, height: 60 },
  resize: 'width',
  richText: false,
  activate: null,
  createData: () => ({ url: 'https://example.com/' }),
  View: LinkView,
  toPlainText: (data) => (data.title === undefined ? data.url : `${data.title}\n${data.url}`),
  fromPastedText: (text) => {
    const url = normalizeUrl(text);
    return url === null ? null : { data: { url }, width: 320, height: 120 };
  },
  enrich: (data, { network, assets }) => fetchPreview(data.url, network, assets),
});

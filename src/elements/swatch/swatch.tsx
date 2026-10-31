import { useEffect, useState } from 'react';
import { CONTROL_ATTRIBUTE } from '../../canvas';
import { t } from '../../i18n';
import { cx } from '../../ui';
import { defineElement } from '../defineElement';
import { useElementRuntime } from '../runtime';
import type { ElementViewProps } from '../types';
import { isDark, normalizeHex, rgbText } from './color';
import { DEFAULT_SWATCH, SwatchDataSchema, type SwatchData } from './schema';
import styles from './Swatch.module.css';

const control = { [CONTROL_ATTRIBUTE]: '' };
const COPIED_MS = 1500;

/** Код цвета: щелчок копирует его в буфер обмена. */
function CopyCode({ code }: { readonly code: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => {
      setCopied(false);
    }, COPIED_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);
  return (
    <button
      {...control}
      type="button"
      className={styles.code}
      title={t('elements.swatch.copy')}
      onClick={() => {
        navigator.clipboard.writeText(code).then(
          () => {
            setCopied(true);
          },
          (error: unknown) => {
            console.error('Код цвета не скопирован', error);
          },
        );
      }}
    >
      {copied ? t('elements.swatch.copied') : code}
    </button>
  );
}

function SwatchEditor({
  elementId,
  data,
}: {
  readonly elementId: string;
  readonly data: SwatchData;
}) {
  const runtime = useElementRuntime();
  const [hex, setHex] = useState(data.hex);
  const [name, setName] = useState(data.name ?? '');
  const commit = (): void => {
    const normalized = normalizeHex(hex) ?? data.hex;
    setHex(normalized);
    if (normalized !== data.hex || name !== (data.name ?? ''))
      runtime.updateData(elementId, { hex: normalized, name: name.trim() });
  };
  const keys = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      commit();
      runtime.stopEditing();
    }
  };
  return (
    <div className={styles.editor}>
      <input
        {...control}
        type="color"
        className={styles.picker}
        aria-label={t('elements.swatch.pick')}
        value={normalizeHex(hex) ?? data.hex}
        onChange={(event) => {
          setHex(event.target.value.toUpperCase());
          runtime.updateData(elementId, { hex: event.target.value.toUpperCase() });
        }}
      />
      <input
        {...control}
        className={styles.input}
        aria-label={t('elements.swatch.hex')}
        value={hex}
        maxLength={7}
        autoFocus
        onChange={(event) => {
          setHex(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={keys}
      />
      <input
        {...control}
        className={styles.input}
        aria-label={t('elements.swatch.name')}
        placeholder={t('elements.swatch.name')}
        value={name}
        maxLength={100}
        onChange={(event) => {
          setName(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={keys}
      />
    </div>
  );
}

function SwatchView({ element, data, editing }: ElementViewProps<SwatchData>) {
  return (
    <div className={styles.swatch}>
      {/* Цвет образца — данные пользователя, а не оформление интерфейса: токены здесь неприменимы. */}
      <div
        className={cx(styles.sample, isDark(data.hex) && styles.dark)}
        style={{ background: data.hex }}
      >
        {data.name !== undefined && data.name !== '' && <span>{data.name}</span>}
      </div>
      {editing ? (
        <SwatchEditor elementId={element.id} data={data} />
      ) : (
        <div className={styles.codes}>
          <CopyCode code={data.hex} />
          <CopyCode code={rgbText(data.hex)} />
        </div>
      )}
    </div>
  );
}

export const swatch = defineElement<SwatchData>({
  type: 'swatch',
  dataSchema: SwatchDataSchema,
  defaultSize: { width: 180, height: 200 },
  minSize: { width: 120, height: 140 },
  resize: 'both',
  richText: false,
  activate: 'edit',
  createData: () => ({ hex: DEFAULT_SWATCH }),
  View: SwatchView,
  toPlainText: (data) => [data.name, data.hex, rgbText(data.hex)].filter(Boolean).join(' '),
});

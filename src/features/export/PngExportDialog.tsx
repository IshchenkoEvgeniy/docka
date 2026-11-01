import type { FileSaver } from '../../core';
import { EntityContext, useEntityLinks, type ElementRuntime } from '../../elements';
import { t } from '../../i18n';
import { Button, Dialog, Segmented } from '../../ui';
import { ExportScene } from './ExportScene';
import type { ExportSource, ExportScope } from './plan';
import { usePngExport } from './usePngExport';
import styles from './Export.module.css';

export function PngExportDialog({
  source,
  runtime,
  save,
  title,
  onClose,
}: {
  readonly source: ExportSource;
  readonly runtime: ElementRuntime;
  readonly save: FileSaver;
  readonly title: string;
  readonly onClose: () => void;
}) {
  const state = usePngExport(source, runtime, save, title);
  const entities = useEntityLinks();
  const hasSelection = source.selection.size > 0 || source.connectionSelection.size > 0;
  return (
    <Dialog title={t('export.title')} closeLabel={t('common.close')} onClose={onClose}>
      <div className={styles.form} aria-busy={state.busy}>
        <fieldset className={styles.form} disabled={state.busy}>
          <Segmented<ExportScope>
            label={t('export.scope')}
            value={state.scope}
            onChange={state.setScope}
            options={[
              { value: 'board', label: t('export.board') },
              ...(hasSelection
                ? [{ value: 'selection' as const, label: t('export.selection') }]
                : []),
            ]}
          />
          <Segmented
            label={t('export.scale')}
            value={String(state.scale)}
            onChange={(value) => {
              state.setScale(Number(value));
            }}
            options={['1', '2', '3'].map((value) => ({ value, label: `${value}×` }))}
          />
          <label>
            <input
              type="checkbox"
              checked={state.transparent}
              onChange={(event) => {
                state.setTransparent(event.target.checked);
              }}
            />{' '}
            {t('export.transparent')}
          </label>
        </fieldset>
        <p className={styles.hint}>{t('export.hint')}</p>
        {state.plan !== null && (
          <p className={styles.hint}>
            {t('export.dimensions', {
              width: Math.ceil(state.plan.bounds.width * state.scale),
              height: Math.ceil(state.plan.bounds.height * state.scale),
            })}
          </p>
        )}
        {!state.valid && (
          <p className={styles.error} role="alert">
            {state.plan === null ? t('export.empty') : t('export.tooLarge')}
          </p>
        )}
        {state.error !== null && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
        {state.saved && <p role="status">{t('export.saved')}</p>}
        <Button
          variant="primary"
          disabled={!state.valid || state.busy}
          onClick={() => void state.run()}
        >
          {state.busy ? t('export.busy') : t('export.save')}
        </Button>
      </div>
      {state.job !== null && (
        <EntityContext.Provider
          value={entities === null ? null : { ...entities, assets: state.job.tracker.assets }}
        >
          <ExportScene
            plan={state.job.plan}
            runtime={state.job.runtime}
            transparent={state.transparent}
            sceneRef={state.sceneRef}
          />
        </EntityContext.Provider>
      )}
    </Dialog>
  );
}

import { useMemo, useState } from 'react';
import type { CameraControls } from '../../canvas';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { PngExportDialog, type ExportSource } from '../export';
import type { BoardModel } from './model';
import { createElementRuntime } from './runtime';
import { measureElement } from './view';

export function BoardExport({
  model,
  controls,
}: {
  readonly model: BoardModel;
  readonly controls: CameraControls;
}) {
  const [source, setSource] = useState<ExportSource | null>(null);
  const runtime = useMemo(() => createElementRuntime(model), [model]);
  const save = model.host.saveFile;
  if (save === null) return null;
  return (
    <>
      <Button
        onClick={() => {
          const selection = model.interaction.getState();
          setSource({
            elements: model.elements.getSnapshot(),
            connections: model.connections.getSnapshot(),
            selection: new Set(selection.selection),
            connectionSelection: new Set(selection.connectionSelection),
            measure: (id) => measureElement(controls, id),
          });
        }}
      >
        {t('export.button')}
      </Button>
      {source !== null && (
        <PngExportDialog
          source={source}
          runtime={runtime}
          save={save}
          title={model.host.boards?.get(model.boardId)?.title ?? t('app.title')}
          onClose={() => {
            setSource(null);
          }}
        />
      )}
    </>
  );
}

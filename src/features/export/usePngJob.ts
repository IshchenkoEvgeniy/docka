import { useEffect, useRef, useState, type RefObject } from 'react';
import type { FileSaver } from '../../core';
import type { ElementRuntime } from '../../elements';
import { t } from '../../i18n';
import { trackExportAssets } from './assets';
import { capturePng, nextFrame } from './capture';
import { exportFileName, type ExportPlan } from './plan';

function useMounted() {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (): boolean => active.current;
}

function makeJob(plan: ExportPlan, runtime: ElementRuntime) {
  const tracker = trackExportAssets(runtime.assets);
  return { plan, tracker, runtime: { ...runtime, assets: tracker.assets } };
}
type ExportJob = ReturnType<typeof makeJob>;
interface JobState {
  readonly busy: boolean;
  readonly error: string | null;
  readonly saved: boolean;
  readonly job: ExportJob | null;
}

/** Отмена при закрытии окна не должна открыть системное сохранение после завершения рендера. */
async function performExport(
  work: ExportJob,
  nodeRef: RefObject<HTMLDivElement | null>,
  scale: number,
  save: FileSaver,
  title: string,
  isActive: () => boolean,
): Promise<boolean> {
  await nextFrame();
  await nextFrame();
  await work.tracker.wait();
  await nextFrame();
  await work.tracker.wait();
  await nextFrame();
  const node = nodeRef.current;
  if (!isActive() || node === null) return false;
  const bytes = await capturePng(node, work.plan, scale);
  if (!isActive()) return false;
  return save({ name: exportFileName(title), mime: 'image/png', bytes });
}

export function usePngJob(runtime: ElementRuntime, save: FileSaver, title: string) {
  const [state, setState] = useState<JobState>({
    busy: false,
    error: null,
    saved: false,
    job: null,
  });
  const sceneRef = useRef<HTMLDivElement>(null);
  const running = useRef(false);
  const isActive = useMounted();
  const run = async (plan: ExportPlan, scale: number): Promise<void> => {
    if (running.current) return;
    running.current = true;
    const work = makeJob(plan, runtime);
    setState({ busy: true, error: null, saved: false, job: work });
    try {
      const saved = await performExport(work, sceneRef, scale, save, title, isActive);
      if (isActive()) setState({ busy: false, error: null, saved, job: null });
    } catch (failure: unknown) {
      console.error('Экспорт PNG не выполнен', failure);
      if (isActive())
        setState({
          busy: false,
          saved: false,
          job: null,
          error: failure instanceof Error ? failure.message : t('export.failed'),
        });
    } finally {
      running.current = false;
    }
  };
  return { ...state, sceneRef, run };
}

import { useState } from 'react';
import type { FileSaver } from '../../core';
import type { ElementRuntime } from '../../elements';
import { createExportPlan, exportFits, type ExportSource, type ExportScope } from './plan';
import { usePngJob } from './usePngJob';

export function usePngExport(
  source: ExportSource,
  runtime: ElementRuntime,
  save: FileSaver,
  title: string,
) {
  const [scope, setScope] = useState<ExportScope>('board');
  const [scale, setScale] = useState(1);
  const [transparent, setTransparent] = useState(false);
  const { run, ...job } = usePngJob(runtime, save, title);
  const plan = createExportPlan(source, scope);
  const valid = plan !== null && exportFits(plan.bounds, scale);
  return {
    ...job,
    scope,
    setScope,
    scale,
    setScale,
    transparent,
    setTransparent,
    plan,
    valid,
    run: () => (valid ? run(plan, scale) : Promise.resolve()),
  };
}

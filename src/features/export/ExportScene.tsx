import { useMemo, type Ref } from 'react';
import type { BoardElement } from '../../core';
import { ElementRuntimeContext, definitionFor, type ElementRuntime } from '../../elements';
import { TagChips } from '../tags';
import { ExportConnections } from './ExportConnections';
import type { ExportPlan } from './plan';
import styles from './Export.module.css';

function ExportTags({ element }: { readonly element: BoardElement }) {
  return (
    <div data-export-bounds="" className={styles.tags}>
      <TagChips tags={element.tags} />
    </div>
  );
}

function ExportChild({ element }: { readonly element: BoardElement }) {
  const { Render } = definitionFor(element.type);
  return (
    <div className={styles.child}>
      <Render element={element} editing={false} />
      <ExportTags element={element} />
    </div>
  );
}

/** У экспортного представления нет команд: измерение и показ карточек не меняют документ. */
function readonlyRuntime(runtime: ElementRuntime, plan: ExportPlan): ElementRuntime {
  const ignore = (): void => undefined;
  return {
    ...runtime,
    exporting: true,
    elements: { subscribe: () => ignore, getSnapshot: () => plan.elements },
    ChildView: ExportChild,
    updateData: ignore,
    ensureText: () => null,
    reportHeight: ignore,
    openAsset: null,
    openBoard: ignore,
    openUrl: ignore,
    refresh: ignore,
    undo: ignore,
    redo: ignore,
    stopEditing: ignore,
  };
}

export function ExportScene({
  plan,
  runtime,
  transparent,
  sceneRef,
}: {
  readonly plan: ExportPlan;
  readonly runtime: ElementRuntime;
  readonly transparent: boolean;
  readonly sceneRef: Ref<HTMLDivElement>;
}) {
  const read = useMemo(() => readonlyRuntime(runtime, plan), [runtime, plan]);
  return (
    <div className={styles.staging} aria-hidden="true" inert>
      <div
        ref={sceneRef}
        className={styles.scene}
        style={{
          width: plan.bounds.width,
          height: plan.bounds.height,
          background: transparent ? 'transparent' : 'var(--color-canvas)',
        }}
      >
        <ElementRuntimeContext.Provider value={read}>
          <div
            data-export-world=""
            className={styles.world}
            style={{
              transform: `translate(${String(-plan.bounds.x)}px, ${String(-plan.bounds.y)}px)`,
            }}
          >
            <ExportConnections plan={plan} />
            {plan.roots.map((element) => {
              const { Render, resize } = definitionFor(element.type);
              return (
                <div
                  key={element.id}
                  data-export-bounds=""
                  className={styles.item}
                  style={{
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    ...(resize === 'width'
                      ? { minHeight: element.height }
                      : { height: element.height }),
                  }}
                >
                  <Render element={element} editing={false} />
                  <ExportTags element={element} />
                </div>
              );
            })}
          </div>
        </ElementRuntimeContext.Provider>
      </div>
    </div>
  );
}

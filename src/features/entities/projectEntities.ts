import type * as Y from 'yjs';
import type { CommandEnvironment, CommandResult, ProjectCommand, Result } from '../../core';
import {
  ENTITIES_MAP,
  ENTITY_TYPES_MAP,
  createEntityStores,
  createUndoHistory,
  ensureEntityText,
  entityTextOf,
  executeProjectCommand,
  type EntityStores,
  type UndoHistory,
} from '../../data';
import { TEXT_EDIT_ORIGIN, type EntityDirectory } from '../../elements';

/** Сущности открытого проекта: живые снимки, команды, своя история отмены, тексты полей. */
export interface ProjectEntities {
  readonly stores: EntityStores;
  readonly directory: EntityDirectory;
  readonly history: UndoHistory;
  readonly run: (command: ProjectCommand) => Result<CommandResult>;
  /** Текст поля для правки (создаётся, если его ещё нет). */
  readonly editableText: (entityId: string, fieldId: string) => Y.XmlFragment | null;
  readonly destroy: () => void;
}

export function createProjectEntities(
  projectDoc: Y.Doc,
  environment: CommandEnvironment,
): ProjectEntities {
  const stores = createEntityStores(projectDoc);
  const history = createUndoHistory(projectDoc, [ENTITY_TYPES_MAP, ENTITIES_MAP], {
    mergeOrigins: [TEXT_EDIT_ORIGIN],
  });
  return {
    stores,
    directory: {
      entities: stores.entities,
      types: stores.types,
      textOf: (entityId, fieldId) => entityTextOf(projectDoc, entityId, fieldId),
    },
    history,
    run: (command) => executeProjectCommand(projectDoc, command, environment),
    editableText: (entityId, fieldId) => ensureEntityText(projectDoc, entityId, fieldId),
    destroy: () => {
      history.destroy();
      stores.destroy();
    },
  };
}

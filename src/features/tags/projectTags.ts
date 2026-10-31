import type * as Y from 'yjs';
import {
  type ColorName,
  type CommandEnvironment,
  type CommandResult,
  type ProjectCommand,
  type Result,
  type Tag,
  type TagId,
} from '../../core';
import { executeProjectCommand, readTags } from '../../data';
import type { Live } from '../../elements';

/** Теги проекта: живой снимок (перечитывается при правке тегов) и команды. */
export interface ProjectTags {
  readonly live: Live<Tag>;
  readonly run: (command: ProjectCommand) => Result<CommandResult>;
  /** Тег по имени: существующий (без учёта регистра) или новый; null — имя пустое. */
  readonly ensure: (name: string, color?: ColorName) => TagId | null;
  readonly destroy: () => void;
}

const TAGS_MAP = 'tags';

export function createProjectTags(projectDoc: Y.Doc, environment: CommandEnvironment): ProjectTags {
  const read = () => new Map(readTags(projectDoc).items.map((tag) => [tag.id as string, tag]));
  let snapshot = read();
  const listeners = new Set<() => void>();
  const tags = projectDoc.getMap<unknown>(TAGS_MAP);
  const observer = (): void => {
    snapshot = read();
    listeners.forEach((listener) => {
      listener();
    });
  };
  tags.observeDeep(observer);
  const run = (command: ProjectCommand) => executeProjectCommand(projectDoc, command, environment);
  return {
    live: {
      getSnapshot: () => snapshot,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    run,
    ensure: (name, color = 'default') => {
      const lower = name.trim().toLocaleLowerCase();
      const existing = [...snapshot.values()].find(
        (tag) => tag.name.toLocaleLowerCase() === lower && (tag.mergedInto ?? null) === null,
      );
      if (existing !== undefined) return existing.id;
      const created = run({ kind: 'createTag', name, color });
      return created.ok ? (snapshot.get(created.value.createdId ?? '')?.id ?? null) : null;
    },
    destroy: () => {
      tags.unobserveDeep(observer);
      listeners.clear();
    },
  };
}

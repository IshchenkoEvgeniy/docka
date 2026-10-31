import { useStore } from 'zustand';
import type { Board } from '../../core';
import { t } from '../../i18n';
import { TagManager, TagPicker, type ProjectTags } from '../tags';
import { SearchPalette } from '../search';
import type { ProjectActions } from './projectActions';
import type { ProjectSearch } from './useProjectSearch';
import { SaveTemplateDialog, TemplatePicker } from '../templates';
import type { BoardId, CommandEnvironment } from '../../core';
import type { OpenProject } from '../../data';

/** Что нужно окнам шаблонов: проект, текущая доска и что сделать с новой доской. */
export interface TemplateContext {
  readonly project: OpenProject;
  readonly environment: CommandEnvironment;
  readonly currentId: BoardId;
  readonly onCreated: (boardId: BoardId) => void;
}

function TemplateWindows({
  ui,
  mode,
  context,
  boards,
}: {
  readonly ui: ProjectUi;
  readonly mode: 'pick' | 'save' | null;
  readonly context: TemplateContext;
  readonly boards: readonly Board[];
}) {
  const close = (): void => {
    ui.setState({ templates: null });
  };
  if (mode === 'pick')
    return (
      <TemplatePicker
        project={context.project}
        environment={context.environment}
        parentId={context.currentId}
        onApplied={(boardId) => {
          close();
          context.onCreated(boardId);
        }}
        onClose={close}
      />
    );
  if (mode === 'save')
    return (
      <SaveTemplateDialog
        project={context.project}
        environment={context.environment}
        boardId={context.currentId}
        title={boards.find((board) => board.id === context.currentId)?.title ?? ''}
        onClose={close}
      />
    );
  return null;
}
import type { ProjectUi } from './projectUi';

/** Окна проекта поверх доски: управление тегами и теги доски. */
export function ProjectOverlays({
  ui,
  tags,
  actions,
  boards,
  search,
  now,
  templates,
}: {
  readonly ui: ProjectUi;
  readonly tags: ProjectTags;
  readonly actions: ProjectActions;
  readonly boards: readonly Board[];
  readonly search: ProjectSearch;
  readonly now: () => number;
  readonly templates: TemplateContext;
}) {
  const state = useStore(ui);
  const tagged = boards.find((board) => board.id === state.boardTags);
  return (
    <>
      {state.tagManager && (
        <TagManager
          tags={tags}
          onClose={() => {
            ui.setState({ tagManager: false });
          }}
        />
      )}
      <TemplateWindows ui={ui} mode={state.templates} context={templates} boards={boards} />
      {state.search && (
        <SearchPalette
          index={search.index}
          commands={search.commands}
          boards={boards}
          now={now()}
          onOpen={search.openDoc}
          onClose={() => {
            ui.setState({ search: false });
          }}
        />
      )}
      {tagged !== undefined && (
        <TagPicker
          title={t('project.boardTags', { title: tagged.title })}
          tags={tags}
          sets={[tagged.tags]}
          onToggle={(tagId, on) => {
            actions.run({
              kind: 'updateBoard',
              boardId: tagged.id,
              changes: { tags: { [tagId]: on } },
            });
          }}
          onClose={() => {
            ui.setState({ boardTags: null });
          }}
        />
      )}
    </>
  );
}

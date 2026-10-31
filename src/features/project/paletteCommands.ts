import type { BoardId } from '../../core';
import { t } from '../../i18n';
import type { PaletteCommand } from '../search';
import type { Workspace } from '../workspace';
import type { ProjectUi } from './projectUi';

interface CommandContext {
  readonly workspace: Workspace;
  readonly ui: ProjectUi;
  readonly currentId: BoardId;
  readonly createBoard: () => void;
  readonly openLibrary: () => void;
}

/** Команды окна Ctrl+K (ТЗ, раздел 7): то же, что в меню и на панелях. */
export function paletteCommands(context: CommandContext): PaletteCommand[] {
  const { workspace, ui, currentId } = context;
  const command = (id: string, label: string, run: () => void): PaletteCommand => ({
    id,
    label,
    run,
  });
  const theme = (value: 'light' | 'dark' | 'system') => () => {
    workspace.updateSettings({ theme: value });
  };
  return [
    command('new-board', t('commands.newBoard'), context.createBoard),
    command('board-from-template', t('commands.boardFromTemplate'), () => {
      ui.setState({ templates: 'pick' });
    }),
    command('save-template', t('commands.saveTemplate'), () => {
      ui.setState({ templates: 'save' });
    }),
    command('library', t('commands.library'), context.openLibrary),
    command('tags', t('commands.tags'), () => {
      ui.setState({ tagManager: true });
    }),
    command('board-tags', t('commands.boardTags'), () => {
      ui.setState({ boardTags: currentId });
    }),
    command('theme-dark', t('commands.themeDark'), theme('dark')),
    command('theme-light', t('commands.themeLight'), theme('light')),
    command('theme-system', t('commands.themeSystem'), theme('system')),
    command('settings', t('commands.settings'), workspace.openSettings),
    command('home', t('commands.home'), workspace.goHome),
  ];
}

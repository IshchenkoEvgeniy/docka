import type { Board, BoardId } from '../../core';
import type { OpenProject } from '../../data';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { Breadcrumbs } from './Breadcrumbs';
import { BoardsButton, FavoriteButton, SearchButtons, pathTo } from './ProjectParts';
import { SyncStatus } from './SyncStatus';
import styles from './Project.module.css';

/** Шапка открытой доски: дерево, «← Доски», крошки, поиск, сущности, синхронизация. */
export function BoardHeader(props: {
  readonly board: Board;
  readonly boards: readonly Board[];
  readonly folder: string;
  readonly project: OpenProject;
  readonly treeOpen: boolean;
  readonly onToggleTree: () => void;
  readonly onOpen: (id: BoardId) => void;
  readonly onRename: (id: BoardId) => void;
  readonly onSearch: () => void;
  readonly onLibrary: () => void;
}) {
  const { board, boards, folder, project } = props;
  return (
    <header className={styles.header}>
      <Button
        variant="ghost"
        pressed={props.treeOpen}
        aria-label={t('project.tree.title')}
        title={t('project.tree.title')}
        onClick={props.onToggleTree}
      >
        {'☰'}
      </Button>
      <BoardsButton />
      <Breadcrumbs
        path={pathTo(board, boards)}
        onOpen={props.onOpen}
        onRename={() => {
          props.onRename(board.id);
        }}
      />
      <SearchButtons onSearch={props.onSearch} onLibrary={props.onLibrary} />
      <SyncStatus folder={folder} />
      <FavoriteButton project={project} folder={folder} board={board} />
    </header>
  );
}

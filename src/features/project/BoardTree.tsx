import { useState } from 'react';
import type { BoardId } from '../../core';
import { t } from '../../i18n';
import { Button, cx } from '../../ui';
import type { TreeNode } from './treeModel';
import styles from './Project.module.css';

interface BoardTreeProps {
  readonly tree: TreeNode;
  readonly currentId: BoardId;
  readonly onOpen: (boardId: BoardId) => void;
  readonly onCreate: () => void;
}

function TreeItem({
  node,
  depth,
  currentId,
  collapsed,
  onToggle,
  onOpen,
}: {
  readonly node: TreeNode;
  readonly depth: number;
  readonly currentId: BoardId;
  readonly collapsed: ReadonlySet<BoardId>;
  readonly onToggle: (boardId: BoardId) => void;
  readonly onOpen: (boardId: BoardId) => void;
}) {
  const { board, children } = node;
  const open = !collapsed.has(board.id);
  return (
    <li>
      <div className={styles.treeRow} style={{ paddingLeft: depth * 14 }}>
        {children.length > 0 ? (
          <button
            type="button"
            className={styles.treeToggle}
            aria-expanded={open}
            aria-label={open ? t('project.tree.collapse') : t('project.tree.expand')}
            onClick={() => {
              onToggle(board.id);
            }}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className={styles.treeToggle} />
        )}
        <button
          type="button"
          className={cx(styles.treeItem, board.id === currentId && styles.treeCurrent)}
          aria-current={board.id === currentId ? 'page' : undefined}
          onClick={() => {
            onOpen(board.id);
          }}
        >
          {board.title}
        </button>
      </div>
      {open && children.length > 0 && (
        <ul className={styles.treeList}>
          {children.map((child) => (
            <TreeItem
              key={child.board.id}
              node={child}
              depth={depth + 1}
              currentId={currentId}
              collapsed={collapsed}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Боковая панель: все доски проекта деревом и кнопка новой доски внутри текущей. */
export function BoardTree({ tree, currentId, onOpen, onCreate }: BoardTreeProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<BoardId>>(new Set());
  const toggle = (boardId: BoardId): void => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(boardId)) next.add(boardId);
      return next;
    });
  };
  return (
    <nav className={styles.tree} aria-label={t('project.tree.title')}>
      <ul className={styles.treeList}>
        <TreeItem
          node={tree}
          depth={0}
          currentId={currentId}
          collapsed={collapsed}
          onToggle={toggle}
          onOpen={onOpen}
        />
      </ul>
      <Button className={styles.treeCreate} onClick={onCreate}>
        {t('project.tree.newBoard')}
      </Button>
    </nav>
  );
}

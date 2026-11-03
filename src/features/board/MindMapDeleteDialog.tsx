import { t } from '../../i18n';
import { Button, Dialog } from '../../ui';
import { deleteWithMindMaps, mindMapNode } from './mindMapActions';
import type { BoardModel } from './model';
import styles from './Board.module.css';

/** «Удалить с ветками или только узел» — у корня: «всю карту или только корень». */
export function MindMapDeleteDialog({
  model,
  elementIds,
  onClose,
}: {
  readonly model: BoardModel;
  readonly elementIds: readonly string[];
  readonly onClose: () => void;
}) {
  const hasRoot = elementIds.some((id) => mindMapNode(model, id)?.parentId === null);
  const choose = (mode: 'branch' | 'node') => () => {
    onClose();
    deleteWithMindMaps(model, elementIds, mode);
  };
  return (
    <Dialog title={t('mindMap.deleteTitle')} closeLabel={t('common.cancel')} onClose={onClose}>
      <div className={styles.form}>
        <p className={styles.hint}>
          {t(hasRoot ? 'mindMap.deleteRootText' : 'mindMap.deleteNodeText')}
        </p>
        <Button variant="primary" autoFocus onClick={choose('branch')}>
          {t(hasRoot ? 'mindMap.deleteWholeMap' : 'mindMap.deleteBranch')}
        </Button>
        <Button onClick={choose('node')}>
          {t(hasRoot ? 'mindMap.deleteRootOnly' : 'mindMap.deleteOnlyNode')}
        </Button>
      </div>
    </Dialog>
  );
}

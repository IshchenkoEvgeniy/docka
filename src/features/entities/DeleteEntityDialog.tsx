import { useEffect, useState } from 'react';
import type { EntityId } from '../../core';
import type { OpenProject } from '../../data';
import { entityName, useEntity } from '../../elements';
import { t } from '../../i18n';
import { Button, Dialog } from '../../ui';
import type { ProjectEntities } from './projectEntities';
import { findEntityUsage } from './usage';
import styles from './Entities.module.css';

/** Удаление сущности из проекта — только из библиотеки и с предупреждением (ТЗ, раздел 6). */
export function DeleteEntityDialog({
  project,
  entities,
  entityId,
  onClose,
}: {
  readonly project: OpenProject;
  readonly entities: ProjectEntities;
  readonly entityId: EntityId;
  readonly onClose: () => void;
}) {
  const found = useEntity(entityId);
  const [boards, setBoards] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    findEntityUsage(project, entityId).then(
      (usage) => {
        if (!cancelled) setBoards(usage.boards.filter((board) => board.placements > 0).length);
      },
      (error: unknown) => {
        console.error('Не удалось посчитать доски с сущностью', error);
        if (!cancelled) setBoards(0);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [project, entityId]);
  const name = entityName(found?.entity.name ?? '');
  return (
    <Dialog
      title={t('entities.delete.title', { name })}
      closeLabel={t('common.cancel')}
      onClose={onClose}
    >
      <div className={styles.form}>
        <p className={styles.muted}>
          {boards === null
            ? t('entities.usage.loading')
            : boards === 0
              ? t('entities.delete.unused')
              : t('entities.delete.used', { count: boards })}
        </p>
        <p className={styles.muted}>{t('entities.delete.hint')}</p>
        <Button
          variant="primary"
          className={styles.dangerButton}
          disabled={boards === null}
          onClick={() => {
            entities.run({ kind: 'deleteEntity', entityId });
            onClose();
          }}
        >
          {t('entities.delete.confirm')}
        </Button>
      </div>
    </Dialog>
  );
}

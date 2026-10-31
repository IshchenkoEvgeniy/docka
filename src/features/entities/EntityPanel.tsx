import { useMemo, useState } from 'react';
import { backLinks, fieldsOf, type BoardId, type EntityId } from '../../core';
import type { OpenProject } from '../../data';
import {
  EntityChips,
  backLinkName,
  entityName,
  nameLabel,
  typeName,
  useEntities,
  useEntity,
  useEntityTypes,
} from '../../elements';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { EntityFields } from './EntityFields';
import { MentionsBlock } from './MentionsBlock';
import type { ProjectEntities } from './projectEntities';
import styles from './Entities.module.css';

export interface EntityPanelProps {
  readonly project: OpenProject;
  readonly entities: ProjectEntities;
  readonly entityId: string;
  readonly storeImage: (file: File) => Promise<string | null>;
  readonly onClose: () => void;
  readonly onOpenBoard: (boardId: BoardId) => void;
  /** Положить карточку сущности на открытую доску. */
  readonly onPlace: (entityId: string) => void;
  readonly onOpenEntity: (entityId: string) => void;
}

function NameField({
  entities,
  entityId,
  name,
  label,
}: {
  readonly entities: ProjectEntities;
  readonly entityId: EntityId;
  readonly name: string;
  readonly label: string;
}) {
  const [text, setText] = useState(name);
  return (
    <input
      className={styles.nameInput}
      aria-label={label}
      placeholder={label}
      value={text}
      maxLength={200}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onBlur={() => {
        if (text.trim() !== name)
          entities.run({
            kind: 'updateEntity',
            entityId,
            changes: { name: text },
          });
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

function BackLinks({ entityId }: { readonly entityId: string }) {
  const entities = useEntities();
  const types = useEntityTypes();
  const links = useMemo(
    () => backLinks(entityId, entities.values(), types),
    [entityId, entities, types],
  );
  return links.map((link) => (
    <div key={`${link.typeId}/${link.fieldId}`} className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{backLinkName(link, types)}</span>
      <EntityChips ids={link.entityIds} />
    </div>
  ));
}

/** Сущность целиком: поля, обратные связи, упоминания. На телефоне — на весь экран. */
export function EntityPanel(props: EntityPanelProps) {
  const { entities, entityId, onClose } = props;
  const found = useEntity(entityId);
  return (
    <aside className={styles.panel} aria-label={t('entities.panel.title')}>
      <header className={styles.panelHeader}>
        <span className={styles.panelIcon} aria-hidden="true">
          {found?.type.icon}
        </span>
        <span className={styles.panelTitle}>
          {found === null
            ? t('entities.missing')
            : `${typeName(found.type)} · ${entityName(found.entity.name)}`}
        </span>
        <Button variant="ghost" onClick={onClose}>
          {t('common.close')}
        </Button>
      </header>
      {found !== null && (
        <div className={styles.panelBody}>
          <NameField
            key={found.entity.name}
            entities={entities}
            entityId={found.entity.id}
            name={found.entity.name}
            label={nameLabel(found.type)}
          />
          <EntityFields
            entity={found.entity}
            fields={fieldsOf(found.type)}
            entities={entities}
            storeImage={props.storeImage}
          />
          <BackLinks entityId={entityId} />
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('entities.usage.title')}</h3>
            <MentionsBlock
              project={props.project}
              entityId={entityId}
              onOpenBoard={props.onOpenBoard}
            />
          </section>
          <div className={styles.actions}>
            <Button
              variant="primary"
              onClick={() => {
                props.onPlace(entityId);
              }}
            >
              {t('entities.panel.place')}
            </Button>
            <Button
              onClick={() => {
                const copy = entities.run({ kind: 'duplicateEntity', entityId: found.entity.id });
                if (copy.ok && copy.value.createdId !== undefined)
                  props.onOpenEntity(copy.value.createdId);
              }}
            >
              {t('entities.panel.duplicate')}
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}

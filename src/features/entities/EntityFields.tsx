import { useMemo, useState } from 'react';
import type { Entity, FieldWithId } from '../../core';
import { fragmentToRich } from '../../data';
import { RichTextView, TextEditor, fieldName, useEntityLinks } from '../../elements';
import { t } from '../../i18n';
import {
  BooleanField,
  ImageField,
  InputField,
  OptionsField,
  RelationField,
  type FieldEditorProps,
} from './FieldEditors';
import type { ProjectEntities } from './projectEntities';
import styles from './Entities.module.css';

interface FieldsProps {
  readonly entity: Entity;
  readonly fields: readonly FieldWithId[];
  readonly entities: ProjectEntities;
  readonly storeImage: (file: File) => Promise<string | null>;
}

/** Длинный текст: показ с упоминаниями; щелчок — правка (редактор у одного поля за раз). */
function LongTextField({
  entity,
  field,
  entities,
  editing,
  onEdit,
}: {
  readonly entity: Entity;
  readonly field: FieldWithId;
  readonly entities: ProjectEntities;
  readonly editing: boolean;
  readonly onEdit: (fieldId: string | null) => void;
}) {
  const links = useEntityLinks();
  const fragment = links?.directory.textOf(entity.id, field.id) ?? null;
  const nodes = useMemo(
    () => (fragment === null ? [] : fragmentToRich(fragment)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entity — признак изменения текста
    [fragment, entity],
  );
  const host = useMemo(
    () => ({
      undo: () => void entities.history.undo(),
      redo: () => void entities.history.redo(),
      stopEditing: () => {
        onEdit(null);
      },
    }),
    [entities, onEdit],
  );
  const editable = editing ? entities.editableText(entity.id, field.id) : null;
  if (editable !== null)
    return (
      <div
        className={styles.longText}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) onEdit(null);
        }}
      >
        <TextEditor fragment={editable} runtime={host} />
      </div>
    );
  return (
    <div
      className={styles.longText}
      role="button"
      tabIndex={0}
      aria-label={t('entities.panel.editText', { field: fieldName(field) })}
      onClick={() => {
        onEdit(field.id);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onEdit(field.id);
      }}
    >
      {nodes.length === 0 ? (
        <span className={styles.placeholder}>{t('entities.panel.textPlaceholder')}</span>
      ) : (
        <RichTextView nodes={nodes} />
      )}
    </div>
  );
}

function FieldEditor(props: FieldEditorProps & Omit<FieldsProps, 'fields' | 'entity'>) {
  const { field } = props;
  switch (field.kind) {
    case 'boolean':
      return <BooleanField {...props} />;
    case 'select':
    case 'multiSelect':
      return <OptionsField {...props} />;
    case 'relation':
      return <RelationField {...props} />;
    case 'image':
      return <ImageField {...props} />;
    default:
      return <InputField key={JSON.stringify(props.entity.values[field.id])} {...props} />;
  }
}

/** Все поля сущности с правкой по виду поля. */
export function EntityFields({ entity, fields, entities, storeImage }: FieldsProps) {
  const [editingText, setEditingText] = useState<string | null>(null);
  const update = (values: Readonly<Record<string, unknown>>): void => {
    entities.run({ kind: 'updateEntity', entityId: entity.id, changes: { values } });
  };
  return (
    <div className={styles.fieldList}>
      {fields.map((field) => (
        <div key={field.id} className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{fieldName(field)}</span>
          {field.kind === 'longText' ? (
            <LongTextField
              entity={entity}
              field={field}
              entities={entities}
              editing={editingText === field.id}
              onEdit={setEditingText}
            />
          ) : (
            <FieldEditor
              entity={entity}
              field={field}
              label={fieldName(field)}
              update={update}
              entities={entities}
              storeImage={storeImage}
            />
          )}
        </div>
      ))}
    </div>
  );
}

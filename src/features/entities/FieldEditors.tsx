import { useRef, useState, type ChangeEvent } from 'react';
import {
  fieldValue,
  type FieldKind,
  optionsOf,
  selectedIds,
  type Entity,
  type FieldWithId,
} from '../../core';
import { EntityChips, FieldImage, entityName, optionName, useEntities } from '../../elements';
import { t } from '../../i18n';
import { Button } from '../../ui';
import styles from './Entities.module.css';

export interface FieldEditorProps {
  readonly entity: Entity;
  readonly field: FieldWithId;
  readonly label: string;
  /** Записать значения полей (одна команда — один шаг отмены). */
  readonly update: (values: Readonly<Record<string, unknown>>) => void;
}

const INPUT_TYPES: Partial<Record<FieldKind, string>> = {
  number: 'number',
  date: 'date',
  url: 'url',
};

/** Строка, число, дата, ссылка: запись при уходе из поля, а не на каждую букву. */
export function InputField({ entity, field, label, update }: FieldEditorProps) {
  const stored = fieldValue(field, entity.values);
  const initial = typeof stored === 'string' || typeof stored === 'number' ? String(stored) : '';
  const [text, setText] = useState(initial);
  const type = INPUT_TYPES[field.kind] ?? 'text';
  const commit = (): void => {
    if (text === initial) return;
    if (text.trim() === '') update({ [field.id]: null });
    else if (field.kind === 'number' && Number.isFinite(Number(text)))
      update({ [field.id]: Number(text) });
    else if (field.kind !== 'number') update({ [field.id]: text });
  };
  return (
    <input
      className={styles.input}
      type={type}
      aria-label={label}
      value={text}
      maxLength={2000}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

export function BooleanField({ entity, field, label, update }: FieldEditorProps) {
  return (
    <input
      type="checkbox"
      className={styles.check}
      aria-label={label}
      checked={fieldValue(field, entity.values) === true}
      onChange={(event) => {
        update({ [field.id]: event.target.checked });
      }}
    />
  );
}

/** «Список вариантов» — выпадающий список, «несколько вариантов» — галочки. */
export function OptionsField({ entity, field, label, update }: FieldEditorProps) {
  const chosen = new Set(selectedIds(field, entity.values));
  const options = optionsOf(field);
  if (field.kind === 'select')
    return (
      <select
        className={styles.input}
        aria-label={label}
        value={[...chosen][0] ?? ''}
        onChange={(event) => {
          update({ [field.id]: event.target.value === '' ? null : event.target.value });
        }}
      >
        <option value="">{t('entities.panel.none')}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {optionName(option)}
          </option>
        ))}
      </select>
    );
  return (
    <div className={styles.options} role="group" aria-label={label}>
      {options.map((option) => (
        <label key={option.id} className={styles.optionLabel}>
          <input
            type="checkbox"
            className={styles.check}
            checked={chosen.has(option.id)}
            onChange={(event) => {
              update({ [field.id]: { [option.id]: event.target.checked } });
            }}
          />
          {optionName(option)}
        </label>
      ))}
    </div>
  );
}

/** Связь: одна — выбор из списка, много — чипы и «Добавить…». Цели — сущности типа поля. */
export function RelationField({ entity, field, label, update }: FieldEditorProps) {
  const entities = useEntities();
  const chosen = selectedIds(field, entity.values);
  const candidates = [...entities.values()]
    .filter((item) => item.id !== entity.id && (field.target ?? item.typeId) === item.typeId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const multiple = field.multiple === true;
  const onChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const id = event.target.value;
    if (multiple && id !== '') update({ [field.id]: { [id]: true } });
    else if (!multiple) update({ [field.id]: id === '' ? null : id });
  };
  return (
    <div className={styles.relation}>
      {multiple && chosen.length > 0 && (
        <div className={styles.chosen}>
          <EntityChips ids={chosen} />
          {chosen.map((id) => (
            <Button
              key={id}
              variant="ghost"
              aria-label={t('entities.panel.unlink', {
                name: entityName(entities.get(id)?.name ?? ''),
              })}
              onClick={() => {
                update({ [field.id]: { [id]: false } });
              }}
            >
              {t('entities.panel.unlinkIcon')}
            </Button>
          ))}
        </div>
      )}
      <select
        className={styles.input}
        aria-label={label}
        value={multiple ? '' : (chosen[0] ?? '')}
        onChange={onChange}
      >
        <option value="">
          {multiple ? t('entities.panel.addLink') : t('entities.panel.none')}
        </option>
        {candidates
          .filter((item) => !multiple || !chosen.includes(item.id))
          .map((item) => (
            <option key={item.id} value={item.id}>
              {entityName(item.name)}
            </option>
          ))}
      </select>
    </div>
  );
}

/** Изображение: файл кладётся в assets/ проекта, в поле — его имя. */
export function ImageField({
  entity,
  field,
  label,
  update,
  storeImage,
}: FieldEditorProps & { readonly storeImage: (file: File) => Promise<string | null> }) {
  const input = useRef<HTMLInputElement>(null);
  const asset = fieldValue(field, entity.values);
  return (
    <div className={styles.imageField}>
      {typeof asset === 'string' && <FieldImage asset={asset} />}
      <Button
        aria-label={label}
        onClick={() => {
          input.current?.click();
        }}
      >
        {typeof asset === 'string'
          ? t('entities.panel.replaceImage')
          : t('entities.panel.pickImage')}
      </Button>
      {typeof asset === 'string' && (
        <Button
          variant="ghost"
          onClick={() => {
            update({ [field.id]: null });
          }}
        >
          {t('entities.panel.removeImage')}
        </Button>
      )}
      <input
        ref={input}
        className={styles.fileInput}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file === undefined) return;
          void storeImage(file).then((name) => {
            if (name !== null) update({ [field.id]: name });
          });
        }}
      />
    </div>
  );
}

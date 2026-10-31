import { t } from '../../i18n';
import { cardColor } from '../../ui';
import { defineElement } from '../defineElement';
import { useMeasuredHeight } from '../text';
import type { ElementViewProps } from '../types';
import { useEntity } from '../entityLinks';
import { EntityCard, EntityChip, EntityFull, EntityMissing } from './EntityView';
import {
  ENTITY_ELEMENT_TYPE,
  ENTITY_VIEWS,
  ENTITY_VIEW_WIDTH,
  EntityElementDataSchema,
  type EntityElementData,
} from './schema';
import styles from './Entity.module.css';

const VIEWS = { chip: EntityChip, card: EntityCard, full: EntityFull } as const;

function EntityElementView({ element, data }: ElementViewProps<EntityElementData>) {
  const ref = useMeasuredHeight(element.id);
  const found = useEntity(data.entityId);
  const View = VIEWS[data.view];
  return (
    <div ref={ref} className={styles.frame} style={{ background: cardColor(element.color) }}>
      {found === null ? <EntityMissing /> : <View entity={found.entity} type={found.type} />}
    </div>
  );
}

/** Карточка сущности проекта: данные общие, размер, место и вид — у размещения (ADR 0004). */
export const entity = defineElement<EntityElementData>({
  type: ENTITY_ELEMENT_TYPE,
  dataSchema: EntityElementDataSchema,
  defaultSize: { width: ENTITY_VIEW_WIDTH.card, height: 120 },
  minSize: { width: 120, height: 32 },
  resize: 'width',
  richText: false,
  activate: 'open',
  createData: () => EntityElementDataSchema.parse({ entityId: '00000000', view: 'card' }),
  View: EntityElementView,
  // Название живёт в документе проекта; в простой текст его подставит экспорт (этап 7).
  toPlainText: () => '',
  target: (data) => ({ kind: 'entity', id: data.entityId }),
  reference: {
    entityId: (data) => data.entityId,
    withEntity: (data, entityId) => EntityElementDataSchema.parse({ ...data, entityId }),
  },
  menuActions: (data) =>
    ENTITY_VIEWS.map((view) => ({
      id: `view-${view}`,
      label: t(`entities.view.${view}`),
      checked: data.view === view,
      changes: { view },
    })),
});

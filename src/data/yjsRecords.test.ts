import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { TagSchema } from '../core';
import { createRecord, readCollection, updateRecord } from './yjsRecords';

function collection() {
  return new Y.Doc().getMap<unknown>('items');
}

describe('записи в Yjs', () => {
  it('вложенные объекты хранятся как Y.Map, массивы — как значения', () => {
    const items = collection();
    const record = createRecord({
      id: 'a',
      data: { text: 'привет', size: { w: 1 } },
      tagIds: ['t1'],
    });
    items.set('a', record);
    expect(record.get('data')).toBeInstanceOf(Y.Map);
    expect(record.get('tagIds')).toEqual(['t1']);
    expect(record.toJSON()).toEqual({
      id: 'a',
      data: { text: 'привет', size: { w: 1 } },
      tagIds: ['t1'],
    });
  });

  it('правки разных полей data с двух устройств сливаются', () => {
    const pc = new Y.Doc();
    const phone = new Y.Doc();
    pc.getMap<unknown>('items').set(
      'a',
      createRecord({ id: 'a', data: { title: 'Таверна', hp: 10 } }),
    );
    Y.applyUpdate(phone, Y.encodeStateAsUpdate(pc));

    const recordOn = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>('items').get('a');
    const pcRecord = recordOn(pc);
    const phoneRecord = recordOn(phone);
    if (pcRecord === undefined || phoneRecord === undefined) throw new Error('нет записи');
    updateRecord(pcRecord, { data: { title: 'Старая таверна' } });
    updateRecord(phoneRecord, { data: { hp: 25 } });
    Y.applyUpdate(pc, Y.encodeStateAsUpdate(phone));
    Y.applyUpdate(phone, Y.encodeStateAsUpdate(pc));

    expect(pcRecord.toJSON()).toEqual({ id: 'a', data: { title: 'Старая таверна', hp: 25 } });
    expect(phoneRecord.toJSON()).toEqual(pcRecord.toJSON());
  });

  it('чтение коллекции пропускает битые записи и сообщает о них', () => {
    const items = collection();
    items.set('tag-ok-0001', createRecord({ id: 'tag-ok-0001', name: 'нпс', color: 'blue' }));
    items.set('tag-bad-001', createRecord({ id: 'tag-bad-001', name: 'x', color: 'неон' }));
    items.set('garbage', 42);
    const { items: tags, invalid } = readCollection(items, TagSchema);
    expect(tags.map((tag) => tag.name)).toEqual(['нпс']);
    expect(invalid.map((entry) => entry.key).sort()).toEqual(['garbage', 'tag-bad-001']);
  });
});

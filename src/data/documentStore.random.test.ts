import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createMemoryFileSystem, type MemoryFileSystem } from '../core';
import { openDocument, type StoredDocument } from './documentStore';

/** Детерминированный генератор, чтобы упавший прогон можно было воспроизвести по seed. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

interface Device {
  readonly id: string;
  readonly fs: MemoryFileSystem;
  readonly store: StoredDocument;
}

function syncFolder(from: Device, to: Device): void {
  for (const [path, data] of from.fs.snapshot()) {
    if (path.startsWith(`data/${from.id}/`)) to.fs.putExternal(path, data);
  }
}

function randomEdit(doc: Y.Doc, random: () => number, step: number): void {
  const cards = doc.getMap<Y.Map<unknown>>('cards');
  const ids = [...cards.keys()];
  const roll = random();
  if (roll < 0.35 || ids.length === 0) {
    const card = new Y.Map<unknown>();
    card.set('title', new Y.Text(`карточка ${String(step)}`));
    card.set('x', Math.floor(random() * 1000));
    cards.set(`c${String(step)}-${String(Math.floor(random() * 1e6))}`, card);
    return;
  }
  const id = ids[Math.floor(random() * ids.length)];
  const card = id === undefined ? undefined : cards.get(id);
  if (id === undefined || card === undefined) return;
  if (roll < 0.45) {
    cards.delete(id);
  } else if (roll < 0.7) {
    card.set('x', Math.floor(random() * 1000));
  } else {
    const title = card.get('title');
    if (title instanceof Y.Text) title.insert(Math.floor(random() * (title.length + 1)), 'ж');
  }
}

async function randomAction(devices: readonly Device[], random: () => number, step: number) {
  const device = devices[Math.floor(random() * devices.length)];
  const other = devices[Math.floor(random() * devices.length)];
  if (device === undefined || other === undefined) return;
  const roll = random();
  if (roll < 0.6) randomEdit(device.store.doc, random, step);
  else if (roll < 0.75) await device.store.flush();
  else if (roll < 0.85) syncFolder(device, other);
  else if (roll < 0.95) await device.store.refresh();
  else await device.store.compact();
}

describe('случайные правки трёх устройств', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`сходятся к одному состоянию (seed ${String(seed)})`, async () => {
      const random = createRandom(seed);
      const devices: Device[] = [];
      for (const id of ['pc', 'phone', 'laptop']) {
        const fs = createMemoryFileSystem();
        devices.push({
          id,
          fs,
          store: await openDocument({ fs, deviceId: id, compactThresholdBytes: 2000 }, 'b'),
        });
      }

      for (let step = 0; step < 400; step += 1) await randomAction(devices, random, step);

      // Связь появилась у всех: записать, обменяться всем, прочитать.
      for (const device of devices) await device.store.flush();
      for (const from of devices) for (const to of devices) if (from !== to) syncFolder(from, to);
      for (const device of devices) await device.store.refresh();

      const [first, ...rest] = devices.map((device) => device.store.doc.getMap('cards').toJSON());
      for (const state of rest) expect(state).toEqual(first);

      // И то же самое состояние читается с диска заново, с нуля.
      const pc = devices[0];
      if (pc === undefined) throw new Error('нет устройств');
      const reopened = await openDocument({ fs: pc.fs, deviceId: 'pc' }, 'b');
      expect(reopened.doc.getMap('cards').toJSON()).toEqual(first);
    });
  }
});

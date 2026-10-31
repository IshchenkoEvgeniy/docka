import { describe, expect, it } from 'vitest';
import { createManualClock, createMemoryFileSystem } from '../core';
import { CAMERAS_FILE, CAMERAS_KEEP, loadCameraMemory } from './cameraMemory';

describe('камеры досок на устройстве', () => {
  it('запоминает и читает после перезапуска; битый файл не мешает', async () => {
    const fs = createMemoryFileSystem();
    const clock = createManualClock(1);
    const memory = await loadCameraMemory(fs, clock);
    expect(memory.get('p', 'b')).toBeNull();
    memory.set('p', 'b', { offsetX: 10, offsetY: -5, zoom: 0.5 });
    await memory.flush();
    const again = await loadCameraMemory(fs, clock);
    expect(again.get('p', 'b')).toEqual({ offsetX: 10, offsetY: -5, zoom: 0.5 });

    await fs.writeFileAtomic(CAMERAS_FILE, new TextEncoder().encode('{broken'));
    expect((await loadCameraMemory(fs, clock)).get('p', 'b')).toBeNull();
  });

  it('помнит не больше заданного числа досок, забывает самые давние', async () => {
    const fs = createMemoryFileSystem();
    const clock = createManualClock(1);
    const memory = await loadCameraMemory(fs, clock);
    for (let index = 0; index <= CAMERAS_KEEP; index += 1) {
      clock.advance(1);
      memory.set('p', `b${String(index)}`, { offsetX: 0, offsetY: 0, zoom: 1 });
    }
    await memory.flush();
    const again = await loadCameraMemory(fs, clock);
    expect(again.get('p', 'b0')).toBeNull();
    expect(again.get('p', `b${String(CAMERAS_KEEP)}`)).not.toBeNull();
  });
});

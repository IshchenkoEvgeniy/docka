import { describe, expect, it } from 'vitest';
import { createManualClock, createMemoryFileSystem } from '../core';
import { listProjectDevices, recordDeviceName } from './devices';

describe('устройства проекта', () => {
  it('имя пишется один раз и видно вместе со временем последней правки', async () => {
    const clock = createManualClock(100);
    const fs = createMemoryFileSystem(clock);
    await recordDeviceName(fs, 'pc-000001', 'Компьютер');
    await recordDeviceName(fs, 'pc-000001', 'Компьютер');
    expect(fs.writtenPaths()).toHaveLength(1);
    clock.advance(50);
    await fs.writeFileAtomic('data/phone-0001/project.log', new Uint8Array([1]));
    expect(await listProjectDevices(fs)).toEqual([
      { deviceId: 'phone-0001', name: null, lastChange: 150 },
      { deviceId: 'pc-000001', name: 'Компьютер', lastChange: 100 },
    ]);
  });
});

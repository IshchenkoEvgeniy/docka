import { describe, expect, it } from 'vitest';
import { crc32, decodeFrames, encodeFrame } from './logFormat';

const bytes = (...values: number[]) => new Uint8Array(values);

function join(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

describe('crc32', () => {
  it('совпадает с эталонным значением', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('кадры журнала', () => {
  it('читает записанные кадры по порядку', () => {
    const log = join(encodeFrame(bytes(1, 2, 3)), encodeFrame(bytes()), encodeFrame(bytes(9)));
    const decoded = decodeFrames(log);
    expect(decoded.frames).toEqual([bytes(1, 2, 3), bytes(), bytes(9)]);
    expect(decoded.corruptTail).toBe(false);
    expect(decoded.validBytes).toBe(log.length);
  });

  it('пустой файл — пустой журнал', () => {
    expect(decodeFrames(bytes())).toEqual({ frames: [], validBytes: 0, corruptTail: false });
  });

  it('недописанный последний кадр отбрасывается, предыдущие целы', () => {
    const first = encodeFrame(bytes(1, 2, 3));
    const second = encodeFrame(bytes(4, 5, 6, 7));
    const decoded = decodeFrames(join(first, second.subarray(0, 10)));
    expect(decoded.frames).toEqual([bytes(1, 2, 3)]);
    expect(decoded.validBytes).toBe(first.length);
    expect(decoded.corruptTail).toBe(true);
  });

  it('кадр с испорченными данными отбрасывается вместе со всем, что после него', () => {
    const first = encodeFrame(bytes(1));
    const broken = encodeFrame(bytes(2, 2));
    broken[broken.length - 1] = 99;
    const decoded = decodeFrames(join(first, broken, encodeFrame(bytes(3))));
    expect(decoded.frames).toEqual([bytes(1)]);
    expect(decoded.corruptTail).toBe(true);
  });

  it('мусор в поле длины не приводит к попытке прочитать гигабайты', () => {
    const garbage = bytes(0xff, 0xff, 0xff, 0xff, 0, 0, 0, 0, 1, 2);
    expect(decodeFrames(garbage).frames).toEqual([]);
  });
});

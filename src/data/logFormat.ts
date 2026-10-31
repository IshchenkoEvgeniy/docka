/**
 * Формат журнала правок `<docId>.log`: последовательность кадров
 *   [длина: uint32 LE][CRC-32 данных: uint32 LE][данные: update Yjs]
 * Файл только дописывается. Оборванный или испорченный хвост (выключили питание посреди
 * записи, файл синхронизирован не до конца) отбрасывается: читаются все целые кадры до него.
 */

const HEADER_BYTES = 8;
/** Защита от мусора в поле длины: один кадр не бывает больше 64 МБ. */
const MAX_FRAME_BYTES = 64 * 1024 * 1024;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (IEEE 802.3), как в zip и png. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function encodeFrame(payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(HEADER_BYTES + payload.length);
  const view = new DataView(frame.buffer);
  view.setUint32(0, payload.length, true);
  view.setUint32(4, crc32(payload), true);
  frame.set(payload, HEADER_BYTES);
  return frame;
}

export interface DecodedLog {
  /** Данные целых кадров по порядку. */
  readonly frames: Uint8Array[];
  /** Сколько байт с начала файла прочитано без ошибок. */
  readonly validBytes: number;
  /** В конце файла были повреждённые или недописанные данные. */
  readonly corruptTail: boolean;
}

export function decodeFrames(data: Uint8Array): DecodedLog {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const frames: Uint8Array[] = [];
  let offset = 0;
  while (offset + HEADER_BYTES <= data.length) {
    const length = view.getUint32(offset, true);
    const checksum = view.getUint32(offset + 4, true);
    const end = offset + HEADER_BYTES + length;
    if (length > MAX_FRAME_BYTES || end > data.length) break;
    const payload = data.subarray(offset + HEADER_BYTES, end);
    if (crc32(payload) !== checksum) break;
    frames.push(payload.slice());
    offset = end;
  }
  return { frames, validBytes: offset, corruptTail: offset !== data.length };
}

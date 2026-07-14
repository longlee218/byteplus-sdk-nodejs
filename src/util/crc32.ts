// Util.crc32 của Python (zlib.crc32 trên file). Tự cài đặt vì zlib.crc32
// của Node chỉ có từ 20.15 mà SDK hỗ trợ từ 18.19.
import { readFileSync } from 'node:fs';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Buffer, prev = 0): number {
  let c = ~prev >>> 0;
  for (const byte of data) {
    c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  }
  return ~c >>> 0;
}

export function crc32File(filePath: string): number {
  return crc32(readFileSync(filePath));
}

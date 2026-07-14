import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { crc32, crc32File } from '../../src/util/crc32';
import { vectors } from '../helpers/vectors';

describe('crc32', () => {
  const content = Buffer.from(vectors.crc32.contentBase64, 'base64');

  it('khớp vector Python trên buffer', () => {
    expect(crc32(content)).toBe(vectors.crc32.value);
  });

  it('khớp vector Python khi đọc từ file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crc32-'));
    const filePath = join(dir, 'crc-test.bin');
    writeFileSync(filePath, content);
    expect(crc32File(filePath)).toBe(vectors.crc32.value);
  });

  it('hỗ trợ tính dồn qua tham số prev như zlib.crc32', () => {
    const half = Math.floor(content.length / 2);
    const first = crc32(content.subarray(0, half));
    expect(crc32(content.subarray(half), first)).toBe(vectors.crc32.value);
  });
});

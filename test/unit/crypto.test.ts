import { describe, expect, it } from 'vitest';

import { LETTER_RUNES } from '../../src/const';
import {
  aesEncryptCbcWithBase64,
  generateAccessKeyId,
  generateSecretKey,
  hmacSha1,
  hmacSha256,
  pad,
  randStringRunes,
  sha256,
  toHex,
} from '../../src/util/crypto';
import { vectors } from '../helpers/vectors';

describe('hmacSha256', () => {
  for (const { keyUtf8, content, digestHex } of vectors.hmacSha256) {
    it(`khớp vector Python với key=${JSON.stringify(keyUtf8)}`, () => {
      expect(toHex(hmacSha256(Buffer.from(keyUtf8, 'utf-8'), content))).toBe(
        digestHex,
      );
    });
  }
});

describe('hmacSha1', () => {
  for (const { keyUtf8, content, digestHex } of vectors.hmacSha1) {
    it(`khớp vector Python với key=${JSON.stringify(keyUtf8)}`, () => {
      expect(toHex(hmacSha1(Buffer.from(keyUtf8, 'utf-8'), content))).toBe(
        digestHex,
      );
    });
  }
});

describe('sha256', () => {
  for (const { content, hex } of vectors.sha256) {
    it(`khớp vector Python cho ${JSON.stringify(content)}`, () => {
      expect(sha256(content)).toBe(hex);
    });
  }
});

describe('pad', () => {
  it('pad NUL tới bội số 16 theo số ký tự', () => {
    expect(pad('short')).toBe('short' + '\0'.repeat(11));
  });

  it('chuỗi đúng 16 ký tự vẫn thêm nguyên một block', () => {
    expect(pad('16bytes-exactly!')).toBe('16bytes-exactly!' + '\0'.repeat(16));
  });
});

describe('aesEncryptCbcWithBase64', () => {
  for (const { data, keyUtf8, base64 } of vectors.aesCbc) {
    it(`khớp vector Python cho ${JSON.stringify(data)}`, () => {
      expect(
        aesEncryptCbcWithBase64(data, Buffer.from(keyUtf8, 'utf-8')),
      ).toBe(base64);
    });
  }
});

describe('generateAccessKeyId', () => {
  it('khớp vector Python với uuid cố định', () => {
    const { uuid, prefix, out } = vectors.generateAccessKeyId;
    expect(generateAccessKeyId(prefix, uuid)).toBe(out);
  });

  it('sinh key ngẫu nhiên đúng prefix và không chứa ký tự cấm', () => {
    const key = generateAccessKeyId('AKTP');
    expect(key.startsWith('AKTP')).toBe(true);
    expect(key.slice(4)).toMatch(/^[A-Za-z0-9]+$/);
  });
});

describe('randStringRunes', () => {
  it('đúng độ dài, đúng bảng chữ cái, không lặp ký tự (random.sample)', () => {
    const s = randStringRunes(32);
    expect(s).toHaveLength(32);
    expect(new Set(s).size).toBe(32);
    for (const ch of s) {
      expect(LETTER_RUNES).toContain(ch);
    }
  });
});

describe('generateSecretKey', () => {
  it('trả về base64 giải mã được thành 32 byte + padding NUL', () => {
    const out = generateSecretKey();
    const decrypted = Buffer.from(out, 'base64');
    expect(decrypted.length % 16).toBe(0);
    expect(decrypted.length).toBeGreaterThanOrEqual(32);
  });
});

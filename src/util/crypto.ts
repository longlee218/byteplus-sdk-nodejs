// Port từ byteplus_sdk/util/Util.py (master) — phần crypto/random.
import {
  createCipheriv,
  createHash,
  createHmac,
  randomUUID,
} from 'node:crypto';

import { LETTER_RUNES } from '../const';

const AES_BLOCK_SIZE = 16;

export function hmacSha256(key: Buffer | string, content: string): Buffer {
  return createHmac('sha256', key).update(content, 'utf-8').digest();
}

export function hmacSha1(key: Buffer | string, content: string): Buffer {
  return createHmac('sha1', key).update(content, 'utf-8').digest();
}

export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function md5(content: Buffer | string): Buffer {
  return createHash('md5').update(content).digest();
}

export function toHex(content: Buffer): string {
  return content.toString('hex');
}

/**
 * Util.pad của Python: pad NUL theo SỐ KÝ TỰ (không phải số byte) tới bội số
 * 16 — giữ nguyên hành vi này để khớp bản gốc.
 */
export function pad(plainText: string): string {
  const numberOfBytesToPad =
    AES_BLOCK_SIZE - (plainText.length % AES_BLOCK_SIZE);
  return plainText + '\0'.repeat(numberOfBytesToPad);
}

/** AES-128-CBC với IV = key, pad NUL, kết quả base64 (khớp Python). */
export function aesEncryptCbcWithBase64(
  origData: string,
  key: Buffer,
): string {
  const cipher = createCipheriv('aes-128-cbc', key, key);
  cipher.setAutoPadding(false);
  const padded = Buffer.from(pad(origData), 'utf-8');
  return Buffer.concat([cipher.update(padded), cipher.final()]).toString(
    'base64',
  );
}

/** Tham số `uuid` chỉ dùng cho test để cố định kết quả. */
export function generateAccessKeyId(
  prefix: string,
  uuid: string = randomUUID(),
): string {
  const uidBase64 = Buffer.from(uuid.replace(/-/g, ''), 'utf-8').toString(
    'base64',
  );
  const s = uidBase64
    .replace(/=/g, '')
    .replace(/\//g, '')
    .replace(/\+/g, '')
    .replace(/-/g, '');
  return prefix + s;
}

/** random.sample của Python: lấy mẫu KHÔNG lặp lại từ LETTER_RUNES. */
export function randStringRunes(length: number): string {
  const pool = LETTER_RUNES.split('');
  let out = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out += pool.splice(idx, 1)[0];
  }
  return out;
}

export function generateSecretKey(): string {
  return aesEncryptCbcWithBase64(
    randStringRunes(32),
    Buffer.from('bytedance-isgood', 'utf-8'),
  );
}

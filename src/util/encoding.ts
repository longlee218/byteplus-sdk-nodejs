// Tái tạo các hàm encode của Python (urllib.parse.quote/quote_plus/urlencode,
// json.dumps) để chữ ký khớp từng byte với byteplus-sdk-python (master).

const ALWAYS_SAFE =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.-~';

/** urllib.parse.quote: percent-encode UTF-8, giữ chữ-số + `_.-~` + `safe`. */
export function pyQuote(value: string, safe = '/'): string {
  const safeCodes = new Set<number>();
  for (const ch of ALWAYS_SAFE + safe) safeCodes.add(ch.charCodeAt(0));
  let out = '';
  for (const byte of Buffer.from(value, 'utf-8')) {
    if (safeCodes.has(byte)) {
      out += String.fromCharCode(byte);
    } else {
      out += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return out;
}

/** urllib.parse.quote_plus: như pyQuote(safe='') nhưng space thành '+'. */
export function pyQuotePlus(value: string): string {
  if (!value.includes(' ')) return pyQuote(value, '');
  return pyQuote(value, ' ').replace(/ /g, '+');
}

/** urllib.parse.urlencode: giữ thứ tự chèn key, doseq expand list. */
export function pyUrlencode(
  query: Record<string, unknown>,
  doseq = false,
): string {
  const parts: string[] = [];
  for (const key of Object.keys(query)) {
    const value = query[key];
    if (doseq && Array.isArray(value)) {
      for (const item of value) {
        parts.push(pyQuotePlus(String(key)) + '=' + pyQuotePlus(String(item)));
      }
    } else {
      parts.push(pyQuotePlus(String(key)) + '=' + pyQuotePlus(String(value)));
    }
  }
  return parts.join('&');
}

/** Util.norm_uri của Python. */
export function normUri(path: string): string {
  return pyQuote(path).replace(/%2F/g, '/').replace(/\+/g, '%20');
}

/** Util.norm_query của Python: sort key, encode với safe='-_.~'. */
export function normQuery(params: Record<string, unknown>): string {
  const safe = '-_.~';
  let query = '';
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        query += pyQuote(String(key), safe) + '=' + pyQuote(String(item), safe) + '&';
      }
    } else {
      query += pyQuote(String(key), safe) + '=' + pyQuote(String(value), safe) + '&';
    }
  }
  query = query.slice(0, -1);
  return query.replace(/\+/g, '%20');
}

function encodePyJsonString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const ch = s.charAt(i);
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (code === 0x08) out += '\\b';
    else if (code === 0x09) out += '\\t';
    else if (code === 0x0a) out += '\\n';
    else if (code === 0x0c) out += '\\f';
    else if (code === 0x0d) out += '\\r';
    else if (code < 0x20 || code > 0x7e)
      out += '\\u' + code.toString(16).padStart(4, '0');
    else out += ch;
  }
  return out + '"';
}

/**
 * json.dumps của Python với tham số mặc định: separator `', '` và `': '`,
 * ensure_ascii=True. Chữ ký hash đúng chuỗi này nên KHÔNG thay bằng
 * JSON.stringify (không có space, không escape non-ASCII).
 */
export function pyJsonDumps(
  value: unknown,
  options: { sortKeys?: boolean } = {},
): string {
  if (value === null || value === undefined) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return String(value);
    case 'string':
      return encodePyJsonString(value);
    case 'object': {
      if (Array.isArray(value)) {
        return '[' + value.map((v) => pyJsonDumps(v, options)).join(', ') + ']';
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record);
      if (options.sortKeys) keys.sort();
      const entries = keys.map(
        (k) => encodePyJsonString(k) + ': ' + pyJsonDumps(record[k], options),
      );
      return '{' + entries.join(', ') + '}';
    }
    default:
      throw new TypeError(`pyJsonDumps: không serialize được kiểu ${typeof value}`);
  }
}

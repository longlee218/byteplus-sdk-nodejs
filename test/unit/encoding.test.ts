import { describe, expect, it } from 'vitest';

import {
  normQuery,
  normUri,
  pyJsonDumps,
  pyQuote,
  pyQuotePlus,
  pyUrlencode,
} from '../../src/util/encoding';
import { BODY_FIXTURE, vectors } from '../helpers/vectors';

describe('normUri', () => {
  for (const { path, out } of vectors.normUri) {
    it(`khớp vector Python cho path ${JSON.stringify(path)}`, () => {
      expect(normUri(path)).toBe(out);
    });
  }
});

describe('normQuery', () => {
  for (const { params, out } of vectors.normQuery) {
    it(`khớp vector Python cho ${JSON.stringify(params)}`, () => {
      expect(normQuery(params)).toBe(out);
    });
  }

  it('ép số sang chuỗi như str() của Python', () => {
    expect(normQuery({ a: 1, b: 2.5 })).toBe('a=1&b=2.5');
  });
});

describe('pyQuote / pyQuotePlus / pyUrlencode', () => {
  it('pyQuote giữ ký tự safe mặc định là /', () => {
    expect(pyQuote('/a b/c')).toBe('/a%20b/c');
  });

  it('pyQuotePlus encode space thành + và / thành %2F', () => {
    expect(pyQuotePlus('a b/c')).toBe('a+b%2Fc');
  });

  it('pyUrlencode giữ thứ tự chèn key', () => {
    expect(pyUrlencode({ b: '2', a: '1' })).toBe('b=2&a=1');
  });

  it('pyUrlencode doseq expand list theo từng phần tử', () => {
    expect(pyUrlencode({ k: ['x y', 'z'] }, true)).toBe('k=x+y&k=z');
  });
});

describe('pyJsonDumps', () => {
  it('khớp json.dumps mặc định của Python (có space, escape unicode)', () => {
    expect(pyJsonDumps(BODY_FIXTURE)).toBe(vectors.pyJsonDumps.output);
  });

  it('khớp json.dumps sort_keys=True', () => {
    expect(pyJsonDumps(BODY_FIXTURE, { sortKeys: true })).toBe(
      vectors.pyJsonDumps.outputSorted,
    );
  });

  it('escape ký tự điều khiển và dấu nháy', () => {
    expect(pyJsonDumps({ a: 'x"y\\z\n\t' })).toBe(
      '{"a": "x\\"y\\\\z\\n\\t"}',
    );
  });

  it('throw với kiểu không serialize được', () => {
    expect(() => pyJsonDumps({ fn: () => 1 })).toThrow(TypeError);
  });
});

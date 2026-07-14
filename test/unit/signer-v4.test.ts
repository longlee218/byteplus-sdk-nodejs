import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Credentials } from '../../src/credentials';
import { Request } from '../../src/base/request';
import { SignerV4 } from '../../src/auth/signer-v4';
import {
  BODY_FIXTURE,
  FIXED_DATE_MS,
  SignCase,
  VECTOR_CREDENTIALS,
  vectors,
} from '../helpers/vectors';

function makeCredentials(): Credentials {
  const { ak, sk, service, region } = VECTOR_CREDENTIALS;
  return new Credentials(ak, sk, service, region);
}

function makeRequest(c: SignCase): Request {
  const r = new Request();
  r.setSchema('https');
  r.setMethod(c.method);
  r.setHost(c.host);
  r.setPath(c.path);
  r.setQuery({ ...c.query });
  r.setHeaders({ ...c.headersIn });
  r.setBody(c.bodyIsPyJsonDumpsOfBodyFixture ? { ...BODY_FIXTURE } : (c.body ?? ''));
  return r;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_DATE_MS);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SignerV4.getCurrentFormatDate', () => {
  it('format UTC YYYYMMDDTHHMMSSZ khớp bản Python', () => {
    expect(SignerV4.getCurrentFormatDate()).toBe(vectors.sign.xDate);
  });
});

describe('SignerV4.sign', () => {
  for (const signCase of vectors.sign.cases as SignCase[]) {
    it(`khớp toàn bộ header với vector Python — case ${signCase.name}`, () => {
      const r = makeRequest(signCase);
      SignerV4.sign(r, makeCredentials());
      expect(r.headers).toEqual(signCase.headersOut);
      expect(r.build()).toBe(signCase.builtUrl);
    });
  }

  it('path rỗng được chuẩn hoá thành /', () => {
    const r = new Request();
    r.setSchema('https');
    r.setMethod('GET');
    r.setHost('open.byteplusapi.com');
    r.setHeaders({ Host: 'open.byteplusapi.com' });
    SignerV4.sign(r, makeCredentials());
    expect(r.path).toBe('/');
  });
});

describe('SignerV4.signUrl', () => {
  it('khớp query string đã ký với vector Python', () => {
    const r = new Request();
    r.setSchema('https');
    r.setMethod(vectors.signUrl.method);
    r.setHost('open.byteplusapi.com');
    r.setPath(vectors.signUrl.path);
    r.setQuery({ ...vectors.signUrl.query });
    expect(SignerV4.signUrl(r, makeCredentials())).toBe(vectors.signUrl.out);
  });
});

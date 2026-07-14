import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiInfo } from '../../src/api-info';
import { Credentials } from '../../src/credentials';
import { Service } from '../../src/base/service';
import { ServiceInfo } from '../../src/service-info';
import {
  FIXED_DATE_MS,
  VECTOR_CREDENTIALS,
  vectors,
} from '../helpers/vectors';

function makeService(apiInfo: Record<string, ApiInfo> = {}): Service {
  const { ak, sk, service, region } = VECTOR_CREDENTIALS;
  return new Service(
    new ServiceInfo(
      'open.byteplusapi.com',
      { Accept: 'application/json' },
      new Credentials(ak, sk, service, region),
      5,
      5,
      'https',
    ),
    apiInfo,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('Service.init — nạp credential', () => {
  it('ưu tiên biến môi trường BYTEPLUS_ACCESSKEY/BYTEPLUS_SECRETKEY', () => {
    vi.stubEnv('BYTEPLUS_ACCESSKEY', 'env-ak');
    vi.stubEnv('BYTEPLUS_SECRETKEY', 'env-sk');
    const svc = makeService();
    expect(svc.serviceInfo.credentials.ak).toBe('env-ak');
    expect(svc.serviceInfo.credentials.sk).toBe('env-sk');
  });

  it('đọc ~/.byteplus/config khi không có biến môi trường', () => {
    vi.stubEnv('BYTEPLUS_ACCESSKEY', undefined);
    vi.stubEnv('BYTEPLUS_SECRETKEY', undefined);
    const home = mkdtempSync(join(tmpdir(), 'byteplus-home-'));
    mkdirSync(join(home, '.byteplus'));
    writeFileSync(
      join(home, '.byteplus/config'),
      JSON.stringify({ ak: 'file-ak', sk: 'file-sk' }),
    );
    vi.stubEnv('HOME', home);

    const svc = makeService();
    expect(svc.serviceInfo.credentials.ak).toBe('file-ak');
    expect(svc.serviceInfo.credentials.sk).toBe('file-sk');
  });

  it('giữ nguyên credential khi không có env lẫn file config', () => {
    vi.stubEnv('BYTEPLUS_ACCESSKEY', undefined);
    vi.stubEnv('BYTEPLUS_SECRETKEY', undefined);
    vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'byteplus-empty-')));
    const svc = makeService();
    expect(svc.serviceInfo.credentials.ak).toBe(VECTOR_CREDENTIALS.ak);
  });
});

describe('Service setters', () => {
  it('setAk/setSk/setHost/setScheme cập nhật serviceInfo', () => {
    const svc = makeService();
    svc.setAk('new-ak');
    svc.setSk('new-sk');
    svc.setHost('new-host');
    svc.setScheme('http');
    expect(svc.serviceInfo.credentials.ak).toBe('new-ak');
    expect(svc.serviceInfo.credentials.sk).toBe('new-sk');
    expect(svc.serviceInfo.host).toBe('new-host');
    expect(svc.serviceInfo.scheme).toBe('http');
  });
});

describe('Service.prepareRequest', () => {
  const apiInfo = new ApiInfo(
    'GET',
    '/',
    { Action: 'X', Version: '1' },
    {},
    { 'X-Extra': 'h' },
  );

  it('ép số thành chuỗi và join list bằng dấu phẩy khi doseq=false', () => {
    const svc = makeService();
    const r = svc.prepareRequest(apiInfo, {
      Limit: 10,
      Ratio: 1.5,
      Ids: ['a', 'b'],
    });
    expect(r.query['Limit']).toBe('10');
    expect(r.query['Ratio']).toBe('1.5');
    expect(r.query['Ids']).toBe('a,b');
  });

  it('giữ nguyên list khi doseq=true', () => {
    const svc = makeService();
    const r = svc.prepareRequest(apiInfo, { Ids: ['a', 'b'] }, true);
    expect(r.query['Ids']).toEqual(['a', 'b']);
  });

  it('merge header của api và service, gắn Host + User-Agent', () => {
    const svc = makeService();
    const r = svc.prepareRequest(apiInfo, {});
    expect(r.headers['X-Extra']).toBe('h');
    expect(r.headers['Accept']).toBe('application/json');
    expect(r.headers['Host']).toBe('open.byteplusapi.com');
    expect(r.headers['User-Agent']).toMatch(/^byteplus-sdk-nodejs\//);
  });

  it('không mutate params đầu vào', () => {
    const svc = makeService();
    const params = { Limit: 10 };
    svc.prepareRequest(apiInfo, params);
    expect(params.Limit).toBe(10);
  });
});

describe('Service.merge', () => {
  it('param2 ghi đè param1, giữ thứ tự chèn', () => {
    const svc = makeService();
    const merged = svc.merge({ a: '1', b: '2' }, { b: '3', c: '4' });
    expect(merged).toEqual({ a: '1', b: '3', c: '4' });
    expect(Object.keys(merged)).toEqual(['a', 'b', 'c']);
  });
});

describe('Service API không tồn tại', () => {
  it('get/post/json/getSignUrl throw "no such api"', async () => {
    const svc = makeService();
    await expect(svc.get('nope', {})).rejects.toThrow('no such api');
    await expect(svc.post('nope', {}, {})).rejects.toThrow('no such api');
    await expect(svc.json('nope', {}, {})).rejects.toThrow('no such api');
    expect(() => svc.getSignUrl('nope', {})).toThrow('no such api');
  });
});

describe('Service.getSignUrl', () => {
  it('khớp vector signUrl của Python', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE_MS);
    const svc = makeService({
      ListUsers: new ApiInfo('GET', '/', {}, {}, {}),
    });
    expect(svc.getSignUrl('ListUsers', { ...vectors.signUrl.query })).toBe(
      vectors.signUrl.out,
    );
  });
});

describe('Service.toRfc3339', () => {
  it('format local time với offset dạng ±HH:MM', () => {
    expect(Service.toRfc3339(vectors.sts2.nowEpoch)).toBe(
      vectors.sts2.currentTime,
    );
  });
});

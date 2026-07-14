import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IamService } from '../../src/iam/iam-service';

beforeEach(() => {
  // Chặn Service.init đọc env/HOME thật của máy dev
  vi.stubEnv('BYTEPLUS_ACCESSKEY', undefined);
  vi.stubEnv('BYTEPLUS_SECRETKEY', undefined);
  vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'iam-home-')));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('IamService — cấu hình mặc định (khớp Python)', () => {
  it('serviceInfo mặc định đúng host, header, credentials, timeout, scheme', () => {
    const info = IamService.getServiceInfo();
    expect(info.host).toBe('open.byteplusapi.com');
    expect(info.header).toEqual({ Accept: 'application/json' });
    expect(info.credentials.service).toBe('iam');
    expect(info.credentials.region).toBe('ap-singapore-1');
    expect(info.credentials.ak).toBe('');
    expect(info.connectionTimeout).toBe(5);
    expect(info.socketTimeout).toBe(5);
    expect(info.scheme).toBe('http');
  });

  it('apiInfo map ListUsers GET / với Action + Version', () => {
    const api = IamService.getApiInfo();
    expect(Object.keys(api)).toEqual(['ListUsers']);
    expect(api['ListUsers']?.method).toBe('GET');
    expect(api['ListUsers']?.path).toBe('/');
    expect(api['ListUsers']?.query).toEqual({
      Action: 'ListUsers',
      Version: '2018-01-01',
    });
  });
});

describe('IamService — singleton kiểu Python', () => {
  it('hai lần khởi tạo trả về cùng một instance', () => {
    expect(new IamService()).toBe(new IamService());
  });

  it('khởi tạo lại reset serviceInfo như __init__ của Python', () => {
    const first = new IamService();
    first.setAk('manually-set-ak');
    first.setHost('changed-host');

    const second = new IamService();
    expect(second).toBe(first);
    expect(first.serviceInfo.credentials.ak).toBe('');
    expect(first.serviceInfo.host).toBe('open.byteplusapi.com');
  });

  it('khởi tạo lại nạp credential mới từ biến môi trường', () => {
    vi.stubEnv('BYTEPLUS_ACCESSKEY', 'env-ak-2');
    vi.stubEnv('BYTEPLUS_SECRETKEY', 'env-sk-2');
    const svc = new IamService();
    expect(svc.serviceInfo.credentials.ak).toBe('env-ak-2');
    expect(svc.serviceInfo.credentials.sk).toBe('env-sk-2');
  });
});

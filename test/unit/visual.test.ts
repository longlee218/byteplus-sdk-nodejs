import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VisualService } from '../../src/visual/visual-service';

beforeEach(() => {
  vi.stubEnv('BYTEPLUS_ACCESSKEY', undefined);
  vi.stubEnv('BYTEPLUS_SECRETKEY', undefined);
  vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'visual-home-')));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('VisualService — cấu hình mặc định (khớp Python)', () => {
  it('serviceInfo mặc định: host cv, service cv, timeout 30/30, https', () => {
    const info = VisualService.getServiceInfo();
    expect(info.host).toBe('cv.byteplusapi.com');
    expect(info.header).toEqual({ Accept: 'application/json' });
    expect(info.credentials.service).toBe('cv');
    expect(info.credentials.region).toBe('ap-singapore-1');
    expect(info.connectionTimeout).toBe(30);
    expect(info.socketTimeout).toBe(30);
    expect(info.scheme).toBe('https');
  });

  it('apiInfo đủ 8 action POST với đúng version', () => {
    const api = VisualService.getApiInfo();
    const versions: Record<string, string> = {
      ComicPortrait: '2022-08-24',
      PortraitFusion: '2022-08-24',
      CVProcess: '2024-06-06',
      CVSubmitTask: '2024-06-06',
      CVGetResult: '2024-06-06',
      CVSync2AsyncSubmitTask: '2024-06-06',
      CVSync2AsyncGetResult: '2024-06-06',
      CVCancelTask: '2024-06-06',
    };
    expect(Object.keys(api).sort()).toEqual(Object.keys(versions).sort());
    for (const [action, version] of Object.entries(versions)) {
      expect(api[action]?.method).toBe('POST');
      expect(api[action]?.path).toBe('/');
      expect(api[action]?.query).toEqual({ Action: action, Version: version });
    }
  });
});

describe('VisualService — singleton kiểu Python', () => {
  it('hai lần khởi tạo trả về cùng instance, lần sau reset serviceInfo', () => {
    const first = new VisualService();
    first.setAk('manually-set-ak');
    first.setHost('changed-host');

    const second = new VisualService();
    expect(second).toBe(first);
    expect(first.serviceInfo.credentials.ak).toBe('');
    expect(first.serviceInfo.host).toBe('cv.byteplusapi.com');
  });
});

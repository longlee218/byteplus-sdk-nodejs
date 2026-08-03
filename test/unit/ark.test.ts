import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ArkService } from '../../src/ark/ark-service';

beforeEach(() => {
  vi.stubEnv('BYTEPLUS_ACCESSKEY', undefined);
  vi.stubEnv('BYTEPLUS_SECRETKEY', undefined);
  vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'ark-home-')));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const ARK_ACTIONS = [
  'CreateAsset',
  'CreateAssetGroup',
  'CreateBatchInferenceJob',
  'CreateEndpoint',
  'CreateEvaluationJob',
  'CreateModelCustomizationJob',
  'DeleteAsset',
  'DeleteAssetGroup',
  'DeleteEndpoint',
  'GetApiKey',
  'GetAsset',
  'GetAssetGroup',
  'GetEndpoint',
  'GetEndpointCertificate',
  'GetModelCustomizationJob',
  'ListAssetGroups',
  'ListAssets',
  'ListBatchInferenceJobs',
  'ListModelCustomizationJobs',
  'UpdateAsset',
  'UpdateAssetGroup',
];

describe('ArkService — cấu hình mặc định (khớp Python v2)', () => {
  it('serviceInfo: host open.byteplusapi.com, service ark, timeout 30/30, https', () => {
    const info = ArkService.getServiceInfo('ap-singapore-1');
    expect(info.host).toBe('open.byteplusapi.com');
    expect(info.header).toEqual({ Accept: 'application/json' });
    expect(info.credentials.service).toBe('ark');
    expect(info.credentials.region).toBe('ap-singapore-1');
    expect(info.connectionTimeout).toBe(30);
    expect(info.socketTimeout).toBe(30);
    expect(info.scheme).toBe('https');
  });

  it('region mặc định là ap-singapore-1', () => {
    const svc = new ArkService();
    expect(svc.serviceInfo.credentials.region).toBe('ap-singapore-1');
  });

  it('nhận region tuỳ chỉnh', () => {
    const svc = new ArkService('cn-beijing');
    expect(svc.serviceInfo.credentials.region).toBe('cn-beijing');
    expect(svc.serviceInfo.host).toBe('open.byteplusapi.com');
  });

  it('apiInfo đủ 21 action POST với path swagger và version 2024-01-01', () => {
    const api = ArkService.getApiInfo();
    expect(Object.keys(api).sort()).toEqual([...ARK_ACTIONS].sort());
    for (const action of ARK_ACTIONS) {
      expect(api[action]?.method).toBe('POST');
      expect(api[action]?.path).toBe(
        `/${action}/2024-01-01/ark/post/application_json/`,
      );
      expect(api[action]?.query).toEqual({
        Action: action,
        Version: '2024-01-01',
      });
    }
  });
});

describe('ArkService — singleton kiểu Python', () => {
  it('hai lần khởi tạo trả về cùng instance, lần sau reset serviceInfo', () => {
    const first = new ArkService();
    first.setAk('manually-set-ak');
    first.setHost('changed-host');

    const second = new ArkService('cn-beijing');
    expect(second).toBe(first);
    expect(first.serviceInfo.credentials.ak).toBe('');
    expect(first.serviceInfo.host).toBe('open.byteplusapi.com');
    expect(first.serviceInfo.credentials.region).toBe('cn-beijing');
  });
});

describe('ArkService — method mapping', () => {
  it('mỗi method gọi json() với đúng action và parse JSON', async () => {
    const svc = new ArkService();
    const spy = vi
      .spyOn(svc, 'json')
      .mockResolvedValue('{"ResponseMetadata": {}, "Result": {}}');

    const cases: Array<[string, (body: Record<string, unknown>) => Promise<unknown>]> = [
      ['CreateAsset', (b) => svc.createAsset(b)],
      ['CreateAssetGroup', (b) => svc.createAssetGroup(b)],
      ['CreateBatchInferenceJob', (b) => svc.createBatchInferenceJob(b)],
      ['CreateEndpoint', (b) => svc.createEndpoint(b)],
      ['CreateEvaluationJob', (b) => svc.createEvaluationJob(b)],
      ['CreateModelCustomizationJob', (b) => svc.createModelCustomizationJob(b)],
      ['DeleteAsset', (b) => svc.deleteAsset(b)],
      ['DeleteAssetGroup', (b) => svc.deleteAssetGroup(b)],
      ['DeleteEndpoint', (b) => svc.deleteEndpoint(b)],
      ['GetApiKey', (b) => svc.getApiKey(b)],
      ['GetAsset', (b) => svc.getAsset(b)],
      ['GetAssetGroup', (b) => svc.getAssetGroup(b)],
      ['GetEndpoint', (b) => svc.getEndpoint(b)],
      ['GetEndpointCertificate', (b) => svc.getEndpointCertificate(b)],
      ['GetModelCustomizationJob', (b) => svc.getModelCustomizationJob(b)],
      ['ListAssetGroups', (b) => svc.listAssetGroups(b)],
      ['ListAssets', (b) => svc.listAssets(b)],
      ['ListBatchInferenceJobs', (b) => svc.listBatchInferenceJobs(b)],
      ['ListModelCustomizationJobs', (b) => svc.listModelCustomizationJobs(b)],
      ['UpdateAsset', (b) => svc.updateAsset(b)],
      ['UpdateAssetGroup', (b) => svc.updateAssetGroup(b)],
    ];

    for (const [action, call] of cases) {
      spy.mockClear();
      const body = { Marker: action };
      await expect(call(body)).resolves.toEqual({
        ResponseMetadata: {},
        Result: {},
      });
      expect(spy).toHaveBeenCalledWith(action, {}, body);
    }
  });

  it('response rỗng thì throw empty response', async () => {
    const svc = new ArkService();
    vi.spyOn(svc, 'json').mockResolvedValue('');
    await expect(svc.getApiKey({})).rejects.toThrow('empty response');
  });
});

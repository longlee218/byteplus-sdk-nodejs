import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ARK_BASE_URL, ArkRuntimeClient } from '../../src/ark/ark-runtime-client';
import { ArkService } from '../../src/ark/ark-service';
import {
  RESOURCE_TYPE_ENDPOINT,
  RESOURCE_TYPE_PRESET_ENDPOINT,
  StsTokenManager,
} from '../../src/ark/sts-token-manager';

beforeEach(() => {
  vi.stubEnv('BYTEPLUS_ACCESSKEY', undefined);
  vi.stubEnv('BYTEPLUS_SECRETKEY', undefined);
  vi.stubEnv('ARK_API_KEY', undefined);
  vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'ark-rt-home-')));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('ArkRuntimeClient — khởi tạo', () => {
  it('thiếu cả api_key lẫn ak/sk thì throw (khớp assert của Python)', () => {
    expect(() => new ArkRuntimeClient()).toThrow(
      'you need to support api_key or ak&sk',
    );
  });

  it('mặc định: baseUrl ark.ap-southeast, region ap-singapore-1', () => {
    const client = new ArkRuntimeClient({ apiKey: 'k' });
    expect(client.baseUrl).toBe(ARK_BASE_URL);
    expect(client.baseUrl).toBe('https://ark.ap-southeast.bytepluses.com/api/v3');
    expect(client.region).toBe('ap-singapore-1');
  });

  it('đọc ARK_API_KEY và BYTEPLUS_ACCESSKEY/SECRETKEY từ env', () => {
    vi.stubEnv('ARK_API_KEY', 'env-api-key');
    const withApiKey = new ArkRuntimeClient();
    expect(withApiKey.apiKey).toBe('env-api-key');

    vi.stubEnv('ARK_API_KEY', undefined);
    vi.stubEnv('BYTEPLUS_ACCESSKEY', 'env-ak');
    vi.stubEnv('BYTEPLUS_SECRETKEY', 'env-sk');
    const withAkSk = new ArkRuntimeClient();
    expect(withAkSk.ak).toBe('env-ak');
    expect(withAkSk.sk).toBe('env-sk');
  });

  it('chỉ có ak/sk (không api_key) vẫn khởi tạo được', () => {
    const client = new ArkRuntimeClient({ ak: 'a', sk: 's' });
    expect(client.apiKey).toBeUndefined();
  });
});

describe('ArkRuntimeClient — resource type theo endpoint id', () => {
  it('ep-m- là presetendpoint, ep- là endpoint, model id là presetendpoint', () => {
    expect(ArkRuntimeClient.getResourceTypeByEndpointId('ep-m-abc')).toBe(
      RESOURCE_TYPE_PRESET_ENDPOINT,
    );
    expect(ArkRuntimeClient.getResourceTypeByEndpointId('ep-abc')).toBe(
      RESOURCE_TYPE_ENDPOINT,
    );
    expect(ArkRuntimeClient.getResourceTypeByEndpointId('seed-1-6')).toBe(
      RESOURCE_TYPE_PRESET_ENDPOINT,
    );
  });
});

describe('ArkRuntimeClient — @apikey_required (khớp Python)', () => {
  const akSkClient = (): ArkRuntimeClient =>
    new ArkRuntimeClient({ ak: 'a', sk: 's' });
  const expected =
    'ak&sk authentication is currently not supported for this method, please use api key instead';

  it('generateImages với ak/sk throw', async () => {
    await expect(
      akSkClient().generateImages({ model: 'ep-1', prompt: 'a cat' }),
    ).rejects.toThrow(expected);
  });

  it('content generation tasks với ak/sk throw', async () => {
    const client = akSkClient();
    await expect(
      client.createContentGenerationTask({ model: 'ep-1', content: [] }),
    ).rejects.toThrow(expected);
    await expect(client.getContentGenerationTask('t1')).rejects.toThrow(
      expected,
    );
    await expect(client.listContentGenerationTasks()).rejects.toThrow(expected);
    await expect(client.deleteContentGenerationTask('t1')).rejects.toThrow(
      expected,
    );
  });
});

describe('ArkRuntimeClient — auth AK/SK cho chat/embeddings', () => {
  it('model không phải ep- thì throw hướng dẫn dùng api_key', async () => {
    const client = new ArkRuntimeClient({ ak: 'a', sk: 's' });
    await expect(
      client.createChatCompletion({ model: 'seed-1-6', messages: [] }),
    ).rejects.toThrow('must set api_key');
  });

  it('model ep-m- (preset endpoint) throw vì thiếu project_name', async () => {
    const client = new ArkRuntimeClient({ ak: 'a', sk: 's' });
    await expect(
      client.createChatCompletion({ model: 'ep-m-abc', messages: [] }),
    ).rejects.toThrow('must set project_name when get preset endpoint token.');
  });
});

describe('StsTokenManager — cache và refresh', () => {
  const envelope = (apiKey: string, expiresInSeconds: number) => ({
    ResponseMetadata: {},
    Result: {
      ApiKey: apiKey,
      ExpiredTime: Math.floor(Date.now() / 1000) + expiresInSeconds,
    },
  });

  it('lấy token qua GetApiKey với body PascalCase đúng wire format', async () => {
    const spy = vi
      .spyOn(ArkService.prototype, 'getApiKey')
      .mockResolvedValue(envelope('sts-token-1', 7 * 24 * 3600));

    const manager = new StsTokenManager('ak', 'sk', 'cn-beijing');
    await expect(manager.get('ep-1')).resolves.toBe('sts-token-1');
    expect(spy).toHaveBeenCalledWith({
      DurationSeconds: 7 * 24 * 3600,
      ResourceType: 'endpoint',
      ResourceIds: ['ep-1'],
    });
  });

  it('token còn hạn (>30 phút) thì không refetch', async () => {
    const spy = vi
      .spyOn(ArkService.prototype, 'getApiKey')
      .mockResolvedValue(envelope('sts-token-1', 7 * 24 * 3600));

    const manager = new StsTokenManager('ak', 'sk', 'cn-beijing');
    await manager.get('ep-1');
    await manager.get('ep-1');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('token sắp hết hạn (<30 phút) thì refetch', async () => {
    const spy = vi
      .spyOn(ArkService.prototype, 'getApiKey')
      .mockResolvedValueOnce(envelope('old-token', 20 * 60))
      .mockResolvedValueOnce(envelope('new-token', 7 * 24 * 3600));

    const manager = new StsTokenManager('ak', 'sk', 'cn-beijing');
    await expect(manager.get('ep-1')).resolves.toBe('old-token');
    await expect(manager.get('ep-1')).resolves.toBe('new-token');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('refresh advisory lỗi thì giữ token cũ, mandatory lỗi thì throw', async () => {
    const spy = vi
      .spyOn(ArkService.prototype, 'getApiKey')
      .mockResolvedValueOnce(envelope('old-token', 20 * 60))
      .mockRejectedValueOnce(new Error('boom'));

    const manager = new StsTokenManager('ak', 'sk', 'cn-beijing');
    // Lần 1: nạp token còn 20 phút (advisory window nhưng > mandatory).
    await expect(manager.get('ep-1')).resolves.toBe('old-token');
    // Lần 2: advisory refresh lỗi → dùng token cũ.
    await expect(manager.get('ep-1')).resolves.toBe('old-token');

    // Token đã hết hạn (mandatory) mà GetApiKey lỗi → throw.
    spy.mockRejectedValueOnce(new Error('boom'));
    const expired = new StsTokenManager('ak', 'sk', 'cn-beijing');
    await expect(expired.get('ep-2')).rejects.toThrow(
      'load api key cause error',
    );
  });

  it('ResponseMetadata.Error → throw (HTTP 200 nhưng lỗi nghiệp vụ)', async () => {
    vi.spyOn(ArkService.prototype, 'getApiKey').mockResolvedValue({
      ResponseMetadata: {
        Error: { Code: 'AccessDenied', Message: 'no permission' },
      },
    });
    const manager = new StsTokenManager('ak', 'sk', 'cn-beijing');
    await expect(manager.get('ep-1')).rejects.toThrow('AccessDenied');
  });
});

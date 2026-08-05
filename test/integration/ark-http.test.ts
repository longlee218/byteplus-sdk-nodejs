import { createServer, IncomingMessage, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ArkService } from '../../src/ark/ark-service';

let server: Server;
let host: string;
let capturedUrl = '';
let capturedMethod = '';
let capturedHeaders: IncomingMessage['headers'] = {};
let capturedBody = '';
let responseStatus = 200;
let responseBody = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      capturedUrl = req.url ?? '';
      capturedMethod = req.method ?? '';
      capturedHeaders = req.headers;
      capturedBody = Buffer.concat(chunks).toString('utf-8');
      res.statusCode = responseStatus;
      res.end(responseBody);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

beforeEach(() => {
  vi.stubEnv('BYTEPLUS_ACCESSKEY', undefined);
  vi.stubEnv('BYTEPLUS_SECRETKEY', undefined);
  vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'ark-int-home-')));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeArkService(): ArkService {
  const svc = new ArkService();
  svc.setHost(host);
  svc.setScheme('http');
  svc.setAk('AKTPtestak');
  svc.setSk('testsk-fixed-secret');
  return svc;
}

describe('ArkService — management API qua HTTP thật', () => {
  it('getApiKey POST đúng path swagger, body JSON kiểu Python, ký service ark', async () => {
    responseStatus = 200;
    responseBody =
      '{"ResponseMetadata":{"Action":"GetApiKey"},"Result":{"ApiKey":"k","ExpiredTime":1}}';

    const resp = await makeArkService().getApiKey({
      DurationSeconds: 604800,
      ResourceType: 'endpoint',
      ResourceIds: ['ep-1'],
    });

    expect(resp).toEqual({
      ResponseMetadata: { Action: 'GetApiKey' },
      Result: { ApiKey: 'k', ExpiredTime: 1 },
    });
    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(
      '/GetApiKey/2024-01-01/ark/post/application_json/?Action=GetApiKey&Version=2024-01-01',
    );
    expect(capturedHeaders['content-type']).toBe('application/json');
    // Body theo json.dumps của Python (có space sau : và ,)
    expect(capturedBody).toBe(
      '{"DurationSeconds": 604800, "ResourceType": "endpoint", "ResourceIds": ["ep-1"]}',
    );
    expect(capturedHeaders['authorization']).toMatch(
      /^HMAC-SHA256 Credential=AKTPtestak\/\d{8}\/ap-singapore-1\/ark\/request, /,
    );
  });

  it('createEndpoint và listBatchInferenceJobs trỏ đúng Action', async () => {
    responseStatus = 200;
    responseBody = '{"ResponseMetadata":{},"Result":{}}';
    const svc = makeArkService();

    await svc.createEndpoint({ Name: 'ep' });
    expect(capturedUrl).toBe(
      '/CreateEndpoint/2024-01-01/ark/post/application_json/?Action=CreateEndpoint&Version=2024-01-01',
    );

    await svc.listBatchInferenceJobs({ PageNumber: 1 });
    expect(capturedUrl).toBe(
      '/ListBatchInferenceJobs/2024-01-01/ark/post/application_json/?Action=ListBatchInferenceJobs&Version=2024-01-01',
    );
  });

  it('createAssetGroup và listAssets trỏ đúng Action (private trusted asset library)', async () => {
    responseStatus = 200;
    responseBody = '{"ResponseMetadata":{},"Result":{}}';
    const svc = makeArkService();

    await svc.createAssetGroup({ Name: 'g', ProjectName: 'default' });
    expect(capturedUrl).toBe(
      '/CreateAssetGroup/2024-01-01/ark/post/application_json/?Action=CreateAssetGroup&Version=2024-01-01',
    );

    await svc.listAssets({ Filter: { GroupIds: ['group-1'] } });
    expect(capturedUrl).toBe(
      '/ListAssets/2024-01-01/ark/post/application_json/?Action=ListAssets&Version=2024-01-01',
    );
  });

  it('createVisualValidateSession và getVisualValidateResult trỏ đúng Action (real-human portrait library)', async () => {
    responseStatus = 200;
    responseBody = '{"ResponseMetadata":{},"Result":{}}';
    const svc = makeArkService();

    await svc.createVisualValidateSession({
      CallbackURL: 'https://www.example.com/callback',
      ProjectName: 'default',
    });
    expect(capturedUrl).toBe(
      '/CreateVisualValidateSession/2024-01-01/ark/post/application_json/?Action=CreateVisualValidateSession&Version=2024-01-01',
    );

    await svc.getVisualValidateResult({
      BytedToken: 'token-1',
      ProjectName: 'default',
    });
    expect(capturedUrl).toBe(
      '/GetVisualValidateResult/2024-01-01/ark/post/application_json/?Action=GetVisualValidateResult&Version=2024-01-01',
    );
  });

  it('non-200 throw với body lỗi', async () => {
    responseStatus = 403;
    responseBody =
      '{"ResponseMetadata":{"Error":{"Code":"AccessDenied"}}}';
    await expect(makeArkService().getEndpoint({ Id: 'ep-1' })).rejects.toThrow(
      'AccessDenied',
    );
  });
});

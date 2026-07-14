import { createServer, IncomingMessage, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  afterAll,
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { IamService } from '../../src/iam/iam-service';

let server: Server;
let host: string;
let capturedUrl = '';
let capturedHeaders: IncomingMessage['headers'] = {};
let responseStatus = 200;
let responseBody = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    capturedUrl = req.url ?? '';
    capturedHeaders = req.headers;
    res.statusCode = responseStatus;
    res.end(responseBody);
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
  vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'iam-int-home-')));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeIamService(): IamService {
  const svc = new IamService();
  svc.setHost(host);
  svc.setAk('AKTPtestak');
  svc.setSk('testsk-fixed-secret');
  return svc;
}

describe('IamService.listUsers qua HTTP thật', () => {
  it('gửi GET đã ký với params và parse JSON response', async () => {
    responseStatus = 200;
    responseBody = '{"ResponseMetadata":{"Action":"ListUsers"},"Result":{"UserMetadata":[]}}';

    const resp = await makeIamService().listUsers({ Limit: 5, Offset: 0 });

    expect(resp).toEqual({
      ResponseMetadata: { Action: 'ListUsers' },
      Result: { UserMetadata: [] },
    });
    expect(capturedUrl).toBe(
      '/?Action=ListUsers&Version=2018-01-01&Limit=5&Offset=0',
    );
    expect(capturedHeaders['accept']).toBe('application/json');
    expect(capturedHeaders['authorization']).toMatch(
      /^HMAC-SHA256 Credential=AKTPtestak\/\d{8}\/ap-singapore-1\/iam\/request, /,
    );
  });

  it('throw "empty response" khi server trả body rỗng', async () => {
    responseStatus = 200;
    responseBody = '';
    await expect(makeIamService().listUsers({})).rejects.toThrow(
      'empty response',
    );
  });

  it('propagate body lỗi khi status khác 200', async () => {
    responseStatus = 403;
    responseBody = '{"Error": "AccessDenied"}';
    await expect(makeIamService().listUsers({})).rejects.toThrow(
      '{"Error": "AccessDenied"}',
    );
  });
});

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

import { CdnService } from '../../src/cdn/cdn-service';

let server: Server;
let host: string;
let capturedUrl = '';
let capturedMethod = '';
let capturedBody = '';
let capturedHeaders: IncomingMessage['headers'] = {};
let requestCount = 0;
let responseStatus = 200;
let responseBody = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    requestCount += 1;
    capturedUrl = req.url ?? '';
    capturedMethod = req.method ?? '';
    capturedHeaders = req.headers;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
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
  vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'cdn-int-home-')));
  requestCount = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeCdnService(): CdnService {
  const svc = new CdnService();
  svc.setHost(host);
  svc.setScheme('http');
  svc.setAk('AKTPtestak');
  svc.setSk('testsk-fixed-secret');
  return svc;
}

describe('CdnService qua HTTP thật — POST', () => {
  it('listCdnDomains gửi POST đã ký với body JSON và parse response', async () => {
    responseStatus = 200;
    responseBody =
      '{"ResponseMetadata":{"Action":"ListCdnDomains"},"Result":{"Data":[]}}';

    const resp = await makeCdnService().listCdnDomains({ PageNum: 1 });

    expect(resp).toEqual({
      ResponseMetadata: { Action: 'ListCdnDomains' },
      Result: { Data: [] },
    });
    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe('/?Action=ListCdnDomains&Version=2021-03-01');
    expect(JSON.parse(capturedBody)).toEqual({ PageNum: 1 });
    expect(capturedHeaders['content-type']).toBe('application/json');
    expect(capturedHeaders['authorization']).toMatch(
      /^HMAC-SHA256 Credential=AKTPtestak\/\d{8}\/ap-singapore-1\/CDN\/request, /,
    );
    expect(requestCount).toBe(1);
  });

  it('response rỗng → Service.json throw lỗi parse (khớp Python)', async () => {
    responseStatus = 200;
    responseBody = '';

    await expect(
      makeCdnService().describeCdnConfig({ Domain: 'example.com' }),
    ).rejects.toThrow();
  });

  it('non-200 propagate body lỗi', async () => {
    responseStatus = 400;
    responseBody = '{"ResponseMetadata":{"Error":{"Code":"InvalidDomain"}}}';

    await expect(
      makeCdnService().addCdnDomain({ Domain: 'bad' }),
    ).rejects.toThrow('InvalidDomain');
    expect(requestCount).toBe(1);
  });
});

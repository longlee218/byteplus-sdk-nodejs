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

import { VisualService } from '../../src/visual/visual-service';

let server: Server;
let host: string;
let capturedUrl = '';
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
  vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'visual-int-home-')));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeVisualService(): VisualService {
  const svc = new VisualService();
  svc.setHost(host);
  svc.setScheme('http');
  svc.setAk('AKTPtestak');
  svc.setSk('testsk-fixed-secret');
  return svc;
}

describe('VisualService — API JSON qua HTTP thật', () => {
  it('cvProcess gửi body JSON kiểu Python và parse response', async () => {
    responseStatus = 200;
    responseBody = '{"code":10000,"data":{"binary_data_base64":[]}}';

    const resp = await makeVisualService().cvProcess({
      req_key: 'face_swap',
      binary_data_base64: ['abc'],
    });

    expect(resp).toEqual({ code: 10000, data: { binary_data_base64: [] } });
    expect(capturedUrl).toBe('/?Action=CVProcess&Version=2024-06-06');
    expect(capturedHeaders['content-type']).toBe('application/json');
    // Body theo json.dumps của Python (có space sau : và ,)
    expect(capturedBody).toBe(
      '{"req_key": "face_swap", "binary_data_base64": ["abc"]}',
    );
    expect(capturedHeaders['authorization']).toMatch(
      /^HMAC-SHA256 Credential=AKTPtestak\/\d{8}\/ap-singapore-1\/cv\/request, /,
    );
  });

  it('cvSubmitTask và cvGetResult trỏ đúng Action', async () => {
    responseStatus = 200;
    responseBody = '{"code":10000}';
    const svc = makeVisualService();

    await svc.cvSubmitTask({ req_key: 'k' });
    expect(capturedUrl).toBe('/?Action=CVSubmitTask&Version=2024-06-06');

    await svc.cvGetResult({ task_id: 't' });
    expect(capturedUrl).toBe('/?Action=CVGetResult&Version=2024-06-06');

    await svc.cvCancelTask({ task_id: 't' });
    expect(capturedUrl).toBe('/?Action=CVCancelTask&Version=2024-06-06');

    await svc.cvSync2AsyncSubmitTask({ req_key: 'k' });
    expect(capturedUrl).toBe(
      '/?Action=CVSync2AsyncSubmitTask&Version=2024-06-06',
    );

    await svc.cvSync2AsyncGetResult({ task_id: 't' });
    expect(capturedUrl).toBe(
      '/?Action=CVSync2AsyncGetResult&Version=2024-06-06',
    );
  });

  it('comicPortrait gửi form urlencoded', async () => {
    responseStatus = 200;
    responseBody = '{"code":10000}';

    const resp = await makeVisualService().comicPortrait({
      image_base64: 'aGVsbG8=',
    });

    expect(resp).toEqual({ code: 10000 });
    expect(capturedUrl).toBe('/?Action=ComicPortrait&Version=2022-08-24');
    expect(capturedHeaders['content-type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(capturedBody).toBe('image_base64=aGVsbG8%3D');
  });

  it('lỗi non-200 với body JSON được RETURN thay vì throw (khớp Python)', async () => {
    responseStatus = 400;
    responseBody =
      '{"code":50411,"message":"Pre Img Risk Not Pass","request_id":"x"}';

    const resp = await makeVisualService().cvProcess({ req_key: 'k' });
    expect(resp).toEqual({
      code: 50411,
      message: 'Pre Img Risk Not Pass',
      request_id: 'x',
    });
  });

  it('lỗi non-200 với body không phải JSON thì throw', async () => {
    responseStatus = 500;
    responseBody = 'Internal Server Error';
    await expect(
      makeVisualService().cvProcess({ req_key: 'k' }),
    ).rejects.toThrow('Internal Server Error');
  });

  it('commonGetHandler gửi GET với params', async () => {
    responseStatus = 200;
    responseBody = '{"ok":true}';
    const resp = await makeVisualService().commonGetHandler('CVGetResult', {
      task_id: 't1',
    });
    expect(resp).toEqual({ ok: true });
    expect(capturedUrl).toBe(
      '/?Action=CVGetResult&Version=2024-06-06&task_id=t1',
    );
  });
});

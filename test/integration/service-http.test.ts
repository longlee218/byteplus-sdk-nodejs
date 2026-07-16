import { createServer, IncomingMessage, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiInfo } from '../../src/api-info';
import { Credentials } from '../../src/credentials';
import { Service } from '../../src/base/service';
import { ServiceInfo } from '../../src/service-info';
import { VECTOR_CREDENTIALS } from '../helpers/vectors';

interface Captured {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

let server: Server;
let host: string;
let captured: Captured;
let responseStatus = 200;
let responseBody = 'ok';

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      captured = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf-8'),
      };
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

function makeService(): Service {
  const { ak, sk, service, region } = VECTOR_CREDENTIALS;
  return new Service(
    new ServiceInfo(host, {}, new Credentials(ak, sk, service, region), 5, 5),
    {
      ListUsers: new ApiInfo(
        'GET',
        '/',
        { Action: 'ListUsers', Version: '2018-01-01' },
        {},
        {},
      ),
      CreateUser: new ApiInfo(
        'POST',
        '/',
        { Action: 'CreateUser', Version: '2018-01-01' },
        {},
        {},
      ),
      OCRNormal: new ApiInfo(
        'POST',
        '/',
        { Action: 'OCRNormal', Version: '2020-08-26' },
        {},
        {},
      ),
    },
  );
}

describe('Service.get qua HTTP thật', () => {
  it('gửi request đã ký và trả về body khi 200', async () => {
    responseStatus = 200;
    responseBody = '{"Result": "ok"}';
    const out = await makeService().get('ListUsers', { Limit: 10 });

    expect(out).toBe('{"Result": "ok"}');
    expect(captured.method).toBe('GET');
    expect(captured.url).toBe('/?Action=ListUsers&Version=2018-01-01&Limit=10');
    expect(captured.headers['x-date']).toMatch(/^\d{8}T\d{6}Z$/);
    expect(captured.headers['x-content-sha256']).toMatch(/^[0-9a-f]{64}$/);
    expect(captured.headers['authorization']).toMatch(
      /^HMAC-SHA256 Credential=AKTPtestak\/\d{8}\/ap-singapore-1\/iam\/request, SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/,
    );
    expect(captured.headers['user-agent']).toBe('byteplus-sdk-nodejs/0.1.1');
  });

  it('throw Error mang body text khi status khác 200', async () => {
    responseStatus = 403;
    responseBody = '{"Error": "AccessDenied"}';
    await expect(makeService().get('ListUsers', {})).rejects.toThrow(
      '{"Error": "AccessDenied"}',
    );
  });
});

describe('Service.post qua HTTP thật', () => {
  it('gửi form urlencoded (quote_plus) đúng bytes đã ký', async () => {
    responseStatus = 200;
    responseBody = 'created';
    const out = await makeService().post(
      'CreateUser',
      {},
      { UserName: 'test user', Description: 'x' },
    );

    expect(out).toBe('created');
    expect(captured.method).toBe('POST');
    expect(captured.headers['content-type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(captured.body).toBe('UserName=test+user&Description=x');
    expect(captured.headers['authorization']).toContain(
      'SignedHeaders=content-type;host;x-content-sha256;x-date',
    );
  });
});

describe('Service.json qua HTTP thật', () => {
  it('gửi body theo json.dumps của Python và re-serialize response', async () => {
    responseStatus = 200;
    responseBody = '{"b":1,"a":"x"}';
    const out = await makeService().json(
      'OCRNormal',
      {},
      { ImageBase64: 'abc', Nested: { A: 1 } },
    );

    // pyJsonDumps giữ thứ tự key của response và thêm space như Python
    expect(out).toBe('{"b": 1, "a": "x"}');
    expect(captured.headers['content-type']).toBe('application/json');
    expect(captured.body).toBe('{"ImageBase64": "abc", "Nested": {"A": 1}}');
  });

  it('throw khi status khác 200', async () => {
    responseStatus = 500;
    responseBody = 'boom';
    await expect(
      makeService().json('OCRNormal', {}, { A: 1 }),
    ).rejects.toThrow('boom');
  });
});

describe('Service.put / putData', () => {
  it('putData trả [true, body] khi 200 và [false, body] khi lỗi', async () => {
    responseStatus = 200;
    responseBody = 'uploaded';
    const svc = makeService();
    const [ok, body] = await svc.putData(
      `http://${host}/upload`,
      Buffer.from('data-bytes'),
      { 'Content-CRC32': 'abc' },
    );
    expect(ok).toBe(true);
    expect(body).toBe('uploaded');
    expect(captured.body).toBe('data-bytes');
    expect(captured.headers['content-crc32']).toBe('abc');

    responseStatus = 500;
    responseBody = 'denied';
    const [ok2, body2] = await svc.putData(`http://${host}/upload`, 'x', {});
    expect(ok2).toBe(false);
    expect(body2).toBe('denied');
  });

  it('put đọc file từ đĩa và upload nội dung', async () => {
    responseStatus = 200;
    responseBody = 'file-ok';
    const dir = mkdtempSync(join(tmpdir(), 'put-'));
    const filePath = join(dir, 'upload.bin');
    writeFileSync(filePath, 'file-content');

    const [ok, body] = await makeService().put(
      `http://${host}/upload`,
      filePath,
      {},
    );
    expect(ok).toBe(true);
    expect(body).toBe('file-ok');
    expect(captured.body).toBe('file-content');
  });
});

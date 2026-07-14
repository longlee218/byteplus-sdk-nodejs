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

import { SmsService } from '../../src/sms/sms-service';

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
  vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'sms-int-home-')));
  requestCount = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeSmsService(): SmsService {
  const svc = new SmsService();
  svc.setHost(host);
  svc.setScheme('http');
  svc.setAk('AKTPtestak');
  svc.setSk('testsk-fixed-secret');
  return svc;
}

describe('SmsService qua HTTP thật — POST', () => {
  it('sendSms gửi POST đã ký với body JSON và parse response', async () => {
    responseStatus = 200;
    responseBody =
      '{"ResponseMetadata":{"Action":"SendSms"},"Result":{"MessageID":["abc"]}}';

    const resp = await makeSmsService().sendSms({
      SmsAccount: 'acc1',
      Sign: 'BytePlus',
      TemplateID: 'ST_01',
      PhoneNumbers: '84900000000',
    });

    expect(resp).toEqual({
      ResponseMetadata: { Action: 'SendSms' },
      Result: { MessageID: ['abc'] },
    });
    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe('/?Action=SendSms&Version=2020-01-01');
    expect(JSON.parse(capturedBody)).toEqual({
      SmsAccount: 'acc1',
      Sign: 'BytePlus',
      TemplateID: 'ST_01',
      PhoneNumbers: '84900000000',
    });
    expect(capturedHeaders['content-type']).toBe('application/json');
    expect(capturedHeaders['authorization']).toMatch(
      /^HMAC-SHA256 Credential=AKTPtestak\/\d{8}\/cn-north-1\/volcSMS\/request, /,
    );
    expect(requestCount).toBe(1);
  });

  it('non-200 cả 2 lần: retry rồi propagate body lỗi', async () => {
    responseStatus = 400;
    responseBody = '{"ResponseMetadata":{"Error":{"Code":"InvalidTemplate"}}}';

    await expect(
      makeSmsService().applySmsTemplate({ TemplateName: 'x' }),
    ).rejects.toThrow('InvalidTemplate');
    expect(requestCount).toBe(2);
  });
});

describe('SmsService qua HTTP thật — GET có body (wire format Python, quyết định 0010)', () => {
  it('getSubAccountList gửi GET đã ký: params vào query, body "{}"', async () => {
    responseStatus = 200;
    responseBody = '{"Result":{"List":[],"Total":0}}';

    const resp = await makeSmsService().getSubAccountList({
      PageIndex: 1,
      PageSize: 10,
    });

    expect(resp).toEqual({ Result: { List: [], Total: 0 } });
    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(
      '/?Action=GetSubAccountList&Version=2021-01-11&PageIndex=1&PageSize=10',
    );
    expect(capturedBody).toBe('{}');
    expect(capturedHeaders['content-type']).toBe('application/json');
    expect(capturedHeaders['authorization']).toMatch(
      /\/cn-north-1\/volcSMS\/request, /,
    );
  });

  it('getSmsTemplateAndOrderList gửi GET với dữ liệu trong body theo json.dumps Python', async () => {
    responseStatus = 200;
    responseBody = '{"Result":{"Total":1}}';

    const resp = await makeSmsService().getSmsTemplateAndOrderList({
      subAccount: 'sa1',
      pageIndex: 1,
      pageSize: 10,
    });

    expect(resp).toEqual({ Result: { Total: 1 } });
    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(
      '/?Action=GetSmsTemplateAndOrderList&Version=2021-01-11',
    );
    // Giữ nguyên format json.dumps của Python (space sau : và ,)
    expect(capturedBody).toBe(
      '{"subAccount": "sa1", "pageIndex": 1, "pageSize": 10}',
    );
  });

  it('response rỗng: retry rồi propagate lỗi parse (khớp JSONDecodeError của Python)', async () => {
    responseStatus = 200;
    responseBody = '';

    await expect(
      makeSmsService().getSubAccountDetail({ SubAccount: 'sa' }),
    ).rejects.toThrow();
    expect(requestCount).toBe(2);
  });

  it('non-200 trên đường GET có body: retry rồi propagate body lỗi', async () => {
    responseStatus = 403;
    responseBody = '{"ResponseMetadata":{"Error":{"Code":"AccessDenied"}}}';

    await expect(
      makeSmsService().getSubAccountList({ PageIndex: 1 }),
    ).rejects.toThrow('AccessDenied');
    expect(requestCount).toBe(2);
  });
});

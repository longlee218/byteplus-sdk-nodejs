import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SmsService } from '../../src/sms/sms-service';

beforeEach(() => {
  // Chặn Service.init đọc env/HOME thật của máy dev
  vi.stubEnv('BYTEPLUS_ACCESSKEY', undefined);
  vi.stubEnv('BYTEPLUS_SECRETKEY', undefined);
  vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'sms-home-')));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('SmsService — cấu hình mặc định (khớp Python)', () => {
  it('region mặc định cn-north-1 → host sms.volcengineapi.com, https', () => {
    const info = SmsService.getServiceInfo('cn-north-1');
    expect(info.host).toBe('sms.volcengineapi.com');
    expect(info.header).toEqual({ Accept: 'application/json' });
    expect(info.credentials.service).toBe('volcSMS');
    expect(info.credentials.region).toBe('cn-north-1');
    expect(info.credentials.ak).toBe('');
    expect(info.connectionTimeout).toBe(5);
    expect(info.socketTimeout).toBe(5);
    expect(info.scheme).toBe('https');
  });

  it('region ap-singapore-1 → host sms.byteplusapi.com', () => {
    const info = SmsService.getServiceInfo('ap-singapore-1');
    expect(info.host).toBe('sms.byteplusapi.com');
    expect(info.credentials.region).toBe('ap-singapore-1');
  });

  it('apiInfo map đủ 11 API với method/Action/Version khớp Python', () => {
    const api = SmsService.getApiInfo();
    const expected: Array<[string, string, string]> = [
      ['SendSms', 'POST', '2020-01-01'],
      ['SendSmsVerifyCode', 'POST', '2020-01-01'],
      ['CheckSmsVerifyCode', 'POST', '2020-01-01'],
      ['SendBatchSms', 'POST', '2021-01-01'],
      ['Conversion', 'POST', '2020-01-01'],
      ['GetSmsTemplateAndOrderList', 'GET', '2021-01-11'],
      ['ApplySmsTemplate', 'POST', '2021-01-11'],
      ['DeleteSmsTemplate', 'POST', '2021-01-11'],
      ['GetSubAccountList', 'GET', '2021-01-11'],
      ['GetSubAccountDetail', 'GET', '2021-01-11'],
      ['InsertSubAccount', 'POST', '2021-01-11'],
    ];
    expect(Object.keys(api).sort()).toEqual(
      expected.map(([name]) => name).sort(),
    );
    for (const [name, method, version] of expected) {
      expect(api[name]?.method, name).toBe(method);
      expect(api[name]?.path, name).toBe('/');
      expect(api[name]?.query, name).toEqual({
        Action: name,
        Version: version,
      });
    }
  });
});

describe('SmsService — singleton kiểu Python', () => {
  it('hai lần khởi tạo trả về cùng một instance', () => {
    expect(new SmsService()).toBe(new SmsService());
  });

  it('khởi tạo lại reset serviceInfo và áp region mới lên instance chung', () => {
    const first = new SmsService();
    first.setAk('manually-set-ak');

    const second = new SmsService('ap-singapore-1');
    expect(second).toBe(first);
    expect(first.serviceInfo.host).toBe('sms.byteplusapi.com');
    expect(first.serviceInfo.credentials.region).toBe('ap-singapore-1');
    expect(first.serviceInfo.credentials.ak).toBe('');
  });

  it('khởi tạo lại nạp credential mới từ biến môi trường', () => {
    vi.stubEnv('BYTEPLUS_ACCESSKEY', 'env-ak-sms');
    vi.stubEnv('BYTEPLUS_SECRETKEY', 'env-sk-sms');
    const svc = new SmsService();
    expect(svc.serviceInfo.credentials.ak).toBe('env-ak-sms');
    expect(svc.serviceInfo.credentials.sk).toBe('env-sk-sms');
  });
});

describe('SmsService — retry kiểu @retry(tries=2) của Python', () => {
  it('POST: lỗi lần 1 thì gọi lại, lần 2 thành công trả kết quả', async () => {
    const svc = new SmsService();
    const spy = vi
      .spyOn(svc, 'json')
      .mockRejectedValueOnce(new Error('tạm thời'))
      .mockResolvedValueOnce('{"ResponseMetadata": {}, "Result": {"MessageID": ["1"]}}');

    await expect(
      svc.sendSms({ SmsAccount: 'acc', Sign: 'sign' }),
    ).resolves.toEqual({
      ResponseMetadata: {},
      Result: { MessageID: ['1'] },
    });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('SendSms', {}, { SmsAccount: 'acc', Sign: 'sign' });
  });

  it('POST: lỗi cả 2 lần thì propagate lỗi, không gọi lần 3', async () => {
    const svc = new SmsService();
    const spy = vi
      .spyOn(svc, 'json')
      .mockRejectedValue(new Error('hỏng hẳn'));

    await expect(svc.sendBatchSms({})).rejects.toThrow('hỏng hẳn');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('response rỗng → "empty response" (sau retry) — guard giống Python', async () => {
    const svc = new SmsService();
    const spy = vi.spyOn(svc, 'json').mockResolvedValue('');

    await expect(svc.getSubAccountList({ PageIndex: 1 })).rejects.toThrow(
      'empty response',
    );
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(
      'GetSubAccountList',
      { PageIndex: 1 },
      {},
    );
  });

  it('parse JSON response thành object', async () => {
    const svc = new SmsService();
    vi.spyOn(svc, 'json').mockResolvedValue('{"Result": {"Total": 0}}');

    await expect(svc.getSmsTemplateAndOrderList({})).resolves.toEqual({
      Result: { Total: 0 },
    });
  });
});

describe('SmsService — mỗi method map đúng Action (khớp Python)', () => {
  // Python: json(action, {}, body) cho các method nhận body —
  // kể cả GetSmsTemplateAndOrderList (GET nhưng dữ liệu nằm trong body).
  const bodyCases: Array<[keyof SmsService & string, string]> = [
    ['sendSms', 'SendSms'],
    ['sendBatchSms', 'SendBatchSms'],
    ['conversion', 'Conversion'],
    ['sendSmsVerifyCode', 'SendSmsVerifyCode'],
    ['checkSmsVerifyCode', 'CheckSmsVerifyCode'],
    ['getSmsTemplateAndOrderList', 'GetSmsTemplateAndOrderList'],
    ['applySmsTemplate', 'ApplySmsTemplate'],
    ['deleteSmsTemplate', 'DeleteSmsTemplate'],
    ['insertSmsSubAccount', 'InsertSubAccount'],
  ];
  for (const [method, action] of bodyCases) {
    it(`${method} → json('${action}', {}, body)`, async () => {
      const svc = new SmsService();
      const spy = vi.spyOn(svc, 'json').mockResolvedValue('{}');
      await (svc[method] as (body: Record<string, unknown>) => Promise<unknown>)({ a: 1 });
      expect(spy).toHaveBeenCalledWith(action, {}, { a: 1 });
    });
  }

  // Python: json(action, param, {}) cho 2 API sub-account (param vào query).
  const paramCases: Array<[keyof SmsService & string, string]> = [
    ['getSubAccountList', 'GetSubAccountList'],
    ['getSubAccountDetail', 'GetSubAccountDetail'],
  ];
  for (const [method, action] of paramCases) {
    it(`${method} → json('${action}', params, {})`, async () => {
      const svc = new SmsService();
      const spy = vi.spyOn(svc, 'json').mockResolvedValue('{}');
      await (svc[method] as (params: Record<string, unknown>) => Promise<unknown>)({ p: 2 });
      expect(spy).toHaveBeenCalledWith(action, { p: 2 }, {});
    });
  }
});

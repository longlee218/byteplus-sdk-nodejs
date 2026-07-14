// Port từ byteplus_sdk/sms/SmsService.py (master)
import { ApiInfo } from '../api-info';
import { Credentials } from '../credentials';
import { Service } from '../base/service';
import { ServiceInfo } from '../service-info';
import { REGION_AP_SINGAPORE1, REGION_CN_NORTH1 } from '../const';

export class SmsService extends Service {
  private static instance: SmsService | undefined;

  // Singleton đúng ngữ nghĩa Python: __new__ trả về cùng instance nhưng
  // __init__ vẫn chạy lại mỗi lần gọi, nên serviceInfo/apiInfo bị reset
  // (credential nạp lại từ env / ~/.byteplus/config, region mới có hiệu lực).
  constructor(region: string = REGION_CN_NORTH1) {
    super(SmsService.getServiceInfo(region), SmsService.getApiInfo());
    if (SmsService.instance !== undefined) {
      SmsService.instance.serviceInfo = this.serviceInfo;
      SmsService.instance.apiInfo = this.apiInfo;
      return SmsService.instance;
    }
    SmsService.instance = this;
  }

  static getServiceInfo(region: string): ServiceInfo {
    const host =
      region === REGION_AP_SINGAPORE1
        ? 'sms.byteplusapi.com'
        : 'sms.volcengineapi.com';
    return new ServiceInfo(
      host,
      { Accept: 'application/json' },
      new Credentials('', '', 'volcSMS', region),
      5,
      5,
      'https',
    );
  }

  static getApiInfo(): Record<string, ApiInfo> {
    const api = (
      method: string,
      action: string,
      version: string,
    ): ApiInfo =>
      new ApiInfo(method, '/', { Action: action, Version: version }, {}, {});
    return {
      SendSms: api('POST', 'SendSms', '2020-01-01'),
      SendSmsVerifyCode: api('POST', 'SendSmsVerifyCode', '2020-01-01'),
      CheckSmsVerifyCode: api('POST', 'CheckSmsVerifyCode', '2020-01-01'),
      SendBatchSms: api('POST', 'SendBatchSms', '2021-01-01'),
      Conversion: api('POST', 'Conversion', '2020-01-01'),
      GetSmsTemplateAndOrderList: api(
        'GET',
        'GetSmsTemplateAndOrderList',
        '2021-01-11',
      ),
      ApplySmsTemplate: api('POST', 'ApplySmsTemplate', '2021-01-11'),
      DeleteSmsTemplate: api('POST', 'DeleteSmsTemplate', '2021-01-11'),
      GetSubAccountList: api('GET', 'GetSubAccountList', '2021-01-11'),
      GetSubAccountDetail: api('GET', 'GetSubAccountDetail', '2021-01-11'),
      InsertSubAccount: api('POST', 'InsertSubAccount', '2021-01-11'),
    };
  }

  // Python bọc mọi method bằng @retry(tries=2, delay=0): lỗi lần đầu thì
  // gọi lại đúng 1 lần, lỗi lần 2 mới propagate.
  private async retryTwice(fn: () => Promise<unknown>): Promise<unknown> {
    try {
      return await fn();
    } catch {
      return fn();
    }
  }

  // Mỗi method Python: res = self.json(...); res == '' → raise; json.loads(res).
  // Các API GET (GetSmsTemplateAndOrderList nhận dữ liệu trong body,
  // GetSubAccountList/Detail nhận query param + body {}) vẫn đi qua json()
  // như Python — GET có body được core hỗ trợ qua node:http(s), quyết định 0010.
  private callJson(
    api: string,
    params: Record<string, unknown>,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.retryTwice(async () => {
      const res = await this.json(api, params, body);
      if (res === '') {
        throw new Error('empty response');
      }
      return JSON.parse(res);
    });
  }

  sendSms(body: Record<string, unknown>): Promise<unknown> {
    return this.callJson('SendSms', {}, body);
  }

  sendBatchSms(body: Record<string, unknown>): Promise<unknown> {
    return this.callJson('SendBatchSms', {}, body);
  }

  conversion(body: Record<string, unknown>): Promise<unknown> {
    return this.callJson('Conversion', {}, body);
  }

  sendSmsVerifyCode(body: Record<string, unknown>): Promise<unknown> {
    return this.callJson('SendSmsVerifyCode', {}, body);
  }

  checkSmsVerifyCode(body: Record<string, unknown>): Promise<unknown> {
    return this.callJson('CheckSmsVerifyCode', {}, body);
  }

  getSmsTemplateAndOrderList(
    body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.callJson('GetSmsTemplateAndOrderList', {}, body);
  }

  applySmsTemplate(body: Record<string, unknown>): Promise<unknown> {
    return this.callJson('ApplySmsTemplate', {}, body);
  }

  deleteSmsTemplate(body: Record<string, unknown>): Promise<unknown> {
    return this.callJson('DeleteSmsTemplate', {}, body);
  }

  getSubAccountList(params: Record<string, unknown>): Promise<unknown> {
    return this.callJson('GetSubAccountList', params, {});
  }

  getSubAccountDetail(params: Record<string, unknown>): Promise<unknown> {
    return this.callJson('GetSubAccountDetail', params, {});
  }

  insertSmsSubAccount(body: Record<string, unknown>): Promise<unknown> {
    return this.callJson('InsertSubAccount', {}, body);
  }
}

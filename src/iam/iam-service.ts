// Port từ byteplus_sdk/iam/IamService.py (master)
import { ApiInfo } from '../api-info';
import { Credentials } from '../credentials';
import { Service } from '../base/service';
import { ServiceInfo } from '../service-info';

export class IamService extends Service {
  private static instance: IamService | undefined;

  // Singleton đúng ngữ nghĩa Python: __new__ trả về cùng instance nhưng
  // __init__ vẫn chạy lại mỗi lần gọi, nên serviceInfo/apiInfo bị reset
  // (credential nạp lại từ env / ~/.byteplus/config).
  constructor() {
    super(IamService.getServiceInfo(), IamService.getApiInfo());
    if (IamService.instance !== undefined) {
      IamService.instance.serviceInfo = this.serviceInfo;
      IamService.instance.apiInfo = this.apiInfo;
      return IamService.instance;
    }
    IamService.instance = this;
  }

  static getServiceInfo(): ServiceInfo {
    return new ServiceInfo(
      'open.byteplusapi.com',
      { Accept: 'application/json' },
      new Credentials('', '', 'iam', 'ap-singapore-1'),
      5,
      5,
    );
  }

  static getApiInfo(): Record<string, ApiInfo> {
    return {
      ListUsers: new ApiInfo(
        'GET',
        '/',
        { Action: 'ListUsers', Version: '2018-01-01' },
        {},
        {},
      ),
    };
  }

  async listUsers(params: Record<string, unknown>): Promise<unknown> {
    const res = await this.get('ListUsers', params);
    if (res === '') {
      throw new Error('empty response');
    }
    return JSON.parse(res);
  }
}

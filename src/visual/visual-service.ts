// Port từ byteplus_sdk/visual/VisualService.py (master)
import { ApiInfo } from '../api-info';
import { Credentials } from '../credentials';
import { Service } from '../base/service';
import { ServiceInfo } from '../service-info';

type Params = Record<string, unknown>;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export class VisualService extends Service {
  private static instance: VisualService | undefined;

  // Singleton đúng ngữ nghĩa Python: __init__ chạy lại mỗi lần gọi nên
  // serviceInfo/apiInfo bị reset (xem IamService).
  constructor() {
    super(VisualService.getServiceInfo(), VisualService.getApiInfo());
    if (VisualService.instance !== undefined) {
      VisualService.instance.serviceInfo = this.serviceInfo;
      VisualService.instance.apiInfo = this.apiInfo;
      return VisualService.instance;
    }
    VisualService.instance = this;
  }

  static getServiceInfo(): ServiceInfo {
    return new ServiceInfo(
      'cv.byteplusapi.com',
      { Accept: 'application/json' },
      new Credentials('', '', 'cv', 'ap-singapore-1'),
      30,
      30,
      'https',
    );
  }

  static getApiInfo(): Record<string, ApiInfo> {
    const post = (action: string, version: string): ApiInfo =>
      new ApiInfo('POST', '/', { Action: action, Version: version }, {}, {});
    return {
      ComicPortrait: post('ComicPortrait', '2022-08-24'),
      PortraitFusion: post('PortraitFusion', '2022-08-24'),
      CVProcess: post('CVProcess', '2024-06-06'),
      CVSubmitTask: post('CVSubmitTask', '2024-06-06'),
      CVGetResult: post('CVGetResult', '2024-06-06'),
      CVSync2AsyncSubmitTask: post('CVSync2AsyncSubmitTask', '2024-06-06'),
      CVSync2AsyncGetResult: post('CVSync2AsyncGetResult', '2024-06-06'),
      CVCancelTask: post('CVCancelTask', '2024-06-06'),
    };
  }

  // Giữ nguyên hành vi Python: lỗi có message parse được thành JSON thì
  // RETURN object đó (vd body lỗi non-200), chỉ throw khi không phải JSON.
  async commonHandler(api: string, form: Params): Promise<unknown> {
    try {
      return JSON.parse(await this.post(api, {}, form));
    } catch (e) {
      const res = errorMessage(e);
      try {
        return JSON.parse(res);
      } catch {
        throw new Error(res);
      }
    }
  }

  async commonGetHandler(api: string, params: Params): Promise<unknown> {
    try {
      return JSON.parse(await this.get(api, params));
    } catch (e) {
      const res = errorMessage(e);
      try {
        return JSON.parse(res);
      } catch {
        throw new Error(res);
      }
    }
  }

  async commonJsonHandler(api: string, body: Params): Promise<unknown> {
    try {
      return JSON.parse(await this.json(api, {}, body));
    } catch (e) {
      const res = errorMessage(e);
      try {
        return JSON.parse(res);
      } catch {
        throw new Error(res);
      }
    }
  }

  async cvProcess(body: Params): Promise<unknown> {
    return this.commonJsonHandler('CVProcess', body);
  }

  async cvSubmitTask(body: Params): Promise<unknown> {
    return this.commonJsonHandler('CVSubmitTask', body);
  }

  async cvGetResult(body: Params): Promise<unknown> {
    return this.commonJsonHandler('CVGetResult', body);
  }

  async cvCancelTask(body: Params): Promise<unknown> {
    return this.commonJsonHandler('CVCancelTask', body);
  }

  async cvSync2AsyncSubmitTask(body: Params): Promise<unknown> {
    return this.commonJsonHandler('CVSync2AsyncSubmitTask', body);
  }

  async cvSync2AsyncGetResult(body: Params): Promise<unknown> {
    return this.commonJsonHandler('CVSync2AsyncGetResult', body);
  }

  async comicPortrait(form: Params): Promise<unknown> {
    return this.commonHandler('ComicPortrait', form);
  }

  async portraitFusion(form: Params): Promise<unknown> {
    return this.commonHandler('PortraitFusion', form);
  }
}

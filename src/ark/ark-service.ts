// Port từ byteplussdkark (byteplus-python-sdk-v2) — Ark management API.
// Python v2 ký byteplusSign (SignerV4) với service `ark`, path cố định
// `/{Action}/2024-01-01/ark/post/application_json/` và query Action+Version
// do interceptor inject. Response có envelope {ResponseMetadata, Result}.
import { ApiInfo } from '../api-info';
import { Credentials } from '../credentials';
import { Service } from '../base/service';
import { ServiceInfo } from '../service-info';
import { REGION_AP_SINGAPORE1 } from '../const';

type Params = Record<string, unknown>;

const ARK_VERSION = '2024-01-01';

const ARK_ACTIONS = [
  'CreateAsset',
  'CreateAssetGroup',
  'CreateBatchInferenceJob',
  'CreateEndpoint',
  'CreateEvaluationJob',
  'CreateModelCustomizationJob',
  'CreateVisualValidateSession',
  'DeleteAsset',
  'DeleteAssetGroup',
  'DeleteEndpoint',
  'GetApiKey',
  'GetAsset',
  'GetAssetGroup',
  'GetEndpoint',
  'GetEndpointCertificate',
  'GetModelCustomizationJob',
  'GetVisualValidateResult',
  'ListAssetGroups',
  'ListAssets',
  'ListBatchInferenceJobs',
  'ListModelCustomizationJobs',
  'UpdateAsset',
  'UpdateAssetGroup',
] as const;

export class ArkService extends Service {
  private static instance: ArkService | undefined;

  // Singleton đúng ngữ nghĩa Python: __init__ chạy lại mỗi lần gọi nên
  // serviceInfo/apiInfo bị reset (xem IamService). Python v2 mặc định
  // cn-beijing nhưng SDK này nhắm BytePlus quốc tế nên mặc định Singapore.
  constructor(region: string = REGION_AP_SINGAPORE1) {
    super(ArkService.getServiceInfo(region), ArkService.getApiInfo());
    if (ArkService.instance !== undefined) {
      ArkService.instance.serviceInfo = this.serviceInfo;
      ArkService.instance.apiInfo = this.apiInfo;
      return ArkService.instance;
    }
    ArkService.instance = this;
  }

  static getServiceInfo(region: string): ServiceInfo {
    // Python v2: service `ark` không có endpoint theo region, fallback về
    // open.byteplusapi.com (default_provider.py). Timeout 30/30 theo
    // Configuration mặc định của byteplussdkcore.
    return new ServiceInfo(
      'open.byteplusapi.com',
      { Accept: 'application/json' },
      new Credentials('', '', 'ark', region),
      30,
      30,
      'https',
    );
  }

  static getApiInfo(): Record<string, ApiInfo> {
    const api: Record<string, ApiInfo> = {};
    for (const action of ARK_ACTIONS) {
      api[action] = new ApiInfo(
        'POST',
        `/${action}/${ARK_VERSION}/ark/post/application_json/`,
        { Action: action, Version: ARK_VERSION },
        {},
        {},
      );
    }
    return api;
  }

  private async callJson(api: string, body: Params): Promise<unknown> {
    const res = await this.json(api, {}, body);
    if (res === '') {
      throw new Error('empty response');
    }
    return JSON.parse(res);
  }

  createAsset(body: Params): Promise<unknown> {
    return this.callJson('CreateAsset', body);
  }

  createAssetGroup(body: Params): Promise<unknown> {
    return this.callJson('CreateAssetGroup', body);
  }

  createBatchInferenceJob(body: Params): Promise<unknown> {
    return this.callJson('CreateBatchInferenceJob', body);
  }

  createEndpoint(body: Params): Promise<unknown> {
    return this.callJson('CreateEndpoint', body);
  }

  createEvaluationJob(body: Params): Promise<unknown> {
    return this.callJson('CreateEvaluationJob', body);
  }

  createModelCustomizationJob(body: Params): Promise<unknown> {
    return this.callJson('CreateModelCustomizationJob', body);
  }

  // Mở phiên xác thực người thật cho real-human portrait library: trả H5Link
  // để end user tự xác thực trên browser và BytedToken (sống 30 phút) để đổi
  // lấy GroupId qua getVisualValidateResult. Asset group của người thật sinh
  // ra từ đây, không tạo bằng createAssetGroup.
  createVisualValidateSession(body: Params): Promise<unknown> {
    return this.callJson('CreateVisualValidateSession', body);
  }

  deleteAsset(body: Params): Promise<unknown> {
    return this.callJson('DeleteAsset', body);
  }

  deleteAssetGroup(body: Params): Promise<unknown> {
    return this.callJson('DeleteAssetGroup', body);
  }

  deleteEndpoint(body: Params): Promise<unknown> {
    return this.callJson('DeleteEndpoint', body);
  }

  getApiKey(body: Params): Promise<unknown> {
    return this.callJson('GetApiKey', body);
  }

  getAsset(body: Params): Promise<unknown> {
    return this.callJson('GetAsset', body);
  }

  getAssetGroup(body: Params): Promise<unknown> {
    return this.callJson('GetAssetGroup', body);
  }

  getEndpoint(body: Params): Promise<unknown> {
    return this.callJson('GetEndpoint', body);
  }

  getEndpointCertificate(body: Params): Promise<unknown> {
    return this.callJson('GetEndpointCertificate', body);
  }

  getModelCustomizationJob(body: Params): Promise<unknown> {
    return this.callJson('GetModelCustomizationJob', body);
  }

  // Đổi BytedToken thành GroupId của asset group vừa được tạo cho người thật.
  // Chỉ gọi được sau khi end user hoàn tất H5 (resultCode 10000).
  getVisualValidateResult(body: Params): Promise<unknown> {
    return this.callJson('GetVisualValidateResult', body);
  }

  listAssetGroups(body: Params): Promise<unknown> {
    return this.callJson('ListAssetGroups', body);
  }

  listAssets(body: Params): Promise<unknown> {
    return this.callJson('ListAssets', body);
  }

  listBatchInferenceJobs(body: Params): Promise<unknown> {
    return this.callJson('ListBatchInferenceJobs', body);
  }

  listModelCustomizationJobs(body: Params): Promise<unknown> {
    return this.callJson('ListModelCustomizationJobs', body);
  }

  updateAsset(body: Params): Promise<unknown> {
    return this.callJson('UpdateAsset', body);
  }

  updateAssetGroup(body: Params): Promise<unknown> {
    return this.callJson('UpdateAssetGroup', body);
  }
}

// Port từ byteplus_sdk/cdn/service.py (master)
import { ApiInfo } from '../api-info';
import { Credentials } from '../credentials';
import { Service } from '../base/service';
import { ServiceInfo } from '../service-info';
import { REGION_AP_SINGAPORE1 } from '../const';

type Params = Record<string, unknown>;

export class CdnService extends Service {
  private static instance: CdnService | undefined;

  // Singleton đúng ngữ nghĩa Python: __init__ chạy lại mỗi lần gọi nên
  // serviceInfo/apiInfo bị reset (xem IamService/VisualService/SmsService).
  constructor(region: string = REGION_AP_SINGAPORE1) {
    super(CdnService.getServiceInfo(region), CdnService.getApiInfo());
    if (CdnService.instance !== undefined) {
      CdnService.instance.serviceInfo = this.serviceInfo;
      CdnService.instance.apiInfo = this.apiInfo;
      return CdnService.instance;
    }
    CdnService.instance = this;
  }

  static getServiceInfo(region: string): ServiceInfo {
    if (region !== REGION_AP_SINGAPORE1) {
      throw new Error(`do not support region ${region}`);
    }
    return new ServiceInfo(
      'open.byteplusapi.com',
      { accept: 'application/json' },
      new Credentials('', '', 'CDN', region),
      60,
      300,
      'https',
    );
  }

  static getApiInfo(): Record<string, ApiInfo> {
    const post = (action: string): ApiInfo =>
      new ApiInfo('POST', '/', { Action: action, Version: '2021-03-01' }, {}, {});
    return {
      AddCdnDomain: post('AddCdnDomain'),
      StartCdnDomain: post('StartCdnDomain'),
      StopCdnDomain: post('StopCdnDomain'),
      DeleteCdnDomain: post('DeleteCdnDomain'),
      ListCdnDomains: post('ListCdnDomains'),
      DescribeCdnConfig: post('DescribeCdnConfig'),
      UpdateCdnConfig: post('UpdateCdnConfig'),
      DescribeCdnData: post('DescribeCdnData'),
      DescribeEdgeNrtDataSummary: post('DescribeEdgeNrtDataSummary'),
      DescribeCdnOriginData: post('DescribeCdnOriginData'),
      DescribeOriginNrtDataSummary: post('DescribeOriginNrtDataSummary'),
      DescribeCdnDataDetail: post('DescribeCdnDataDetail'),
      DescribeDistrictIspData: post('DescribeDistrictIspData'),
      DescribeEdgeStatisticalData: post('DescribeEdgeStatisticalData'),
      DescribeEdgeTopNrtData: post('DescribeEdgeTopNrtData'),
      DescribeOriginTopNrtData: post('DescribeOriginTopNrtData'),
      DescribeEdgeTopStatusCode: post('DescribeEdgeTopStatusCode'),
      DescribeOriginTopStatusCode: post('DescribeOriginTopStatusCode'),
      DescribeEdgeTopStatisticalData: post('DescribeEdgeTopStatisticalData'),
      DescribeCdnRegionAndIsp: post('DescribeCdnRegionAndIsp'),
      DescribeCdnService: post('DescribeCdnService'),
      DescribeAccountingData: post('DescribeAccountingData'),
      SubmitRefreshTask: post('SubmitRefreshTask'),
      SubmitPreloadTask: post('SubmitPreloadTask'),
      DescribeContentTasks: post('DescribeContentTasks'),
      DescribeContentQuota: post('DescribeContentQuota'),
      SubmitBlockTask: post('SubmitBlockTask'),
      SubmitUnblockTask: post('SubmitUnblockTask'),
      DescribeContentBlockTasks: post('DescribeContentBlockTasks'),
      DescribeCdnAccessLog: post('DescribeCdnAccessLog'),
      DescribeIPInfo: post('DescribeIPInfo'),
      DescribeIPListInfo: post('DescribeIPListInfo'),
      DescribeCdnUpperIp: post('DescribeCdnUpperIp'),
      ListResourceTags: post('ListResourceTags'),
      AddCdnCertificate: post('AddCdnCertificate'),
      ListCertInfo: post('ListCertInfo'),
      ListCdnCertInfo: post('ListCdnCertInfo'),
      DescribeCertConfig: post('DescribeCertConfig'),
      BatchDeployCert: post('BatchDeployCert'),
      DeleteCdnCertificate: post('DeleteCdnCertificate'),
      DescribeAccountingSummary: post('DescribeAccountingSummary'),
      DescribeTemplates: post('DescribeTemplates'),
      DescribeServiceTemplate: post('DescribeServiceTemplate'),
      DescribeCipherTemplate: post('DescribeCipherTemplate'),
      CreateCipherTemplate: post('CreateCipherTemplate'),
      UpdateServiceTemplate: post('UpdateServiceTemplate'),
      UpdateCipherTemplate: post('UpdateCipherTemplate'),
      DuplicateTemplate: post('DuplicateTemplate'),
      LockTemplate: post('LockTemplate'),
      DeleteTemplate: post('DeleteTemplate'),
      DescribeTemplateDomains: post('DescribeTemplateDomains'),
      AddTemplateDomain: post('AddTemplateDomain'),
      UpdateTemplateDomain: post('UpdateTemplateDomain'),
      CreateServiceTemplate: post('CreateServiceTemplate'),
      CreateTemplateVersion: post('CreateTemplateVersion'),
      DescribeTemplateReleaseVersions: post('DescribeTemplateReleaseVersions'),
      DescribeDomainShared: post('DescribeDomainShared'),
      DescribeCdnIP: post('DescribeCdnIP'),
      DescribeDistrictData: post('DescribeDistrictData'),
      DescribeEdgeData: post('DescribeEdgeData'),
      DescribeDistrictSummary: post('DescribeDistrictSummary'),
      DescribeEdgeSummary: post('DescribeEdgeSummary'),
      DescribeOriginData: post('DescribeOriginData'),
      DescribeOriginSummary: post('DescribeOriginSummary'),
      DescribeUserData: post('DescribeUserData'),
      DescribeDistrictRanking: post('DescribeDistrictRanking'),
      DescribeEdgeRanking: post('DescribeEdgeRanking'),
      DescribeOriginRanking: post('DescribeOriginRanking'),
      DescribeEdgeStatusCodeRanking: post('DescribeEdgeStatusCodeRanking'),
      DescribeOriginStatusCodeRanking: post('DescribeOriginStatusCodeRanking'),
      DescribeStatisticalRanking: post('DescribeStatisticalRanking'),
      BatchUpdateCdnConfig: post('BatchUpdateCdnConfig'),
      AddCertificate: post('AddCertificate'),
      DeleteUsageReport: post('DeleteUsageReport'),
      CreateUsageReport: post('CreateUsageReport'),
      ListUsageReports: post('ListUsageReports'),
      DescribeSharedConfig: post('DescribeSharedConfig'),
      ListSharedConfig: post('ListSharedConfig'),
      DeleteSharedConfig: post('DeleteSharedConfig'),
      UpdateSharedConfig: post('UpdateSharedConfig'),
      AddSharedConfig: post('AddSharedConfig'),
      TagResources: post('TagResources'),
      UntagResources: post('UntagResources'),
      ReleaseTemplate: post('ReleaseTemplate'),
      CreateRuleEngineTemplate: post('CreateRuleEngineTemplate'),
      UpdateRuleEngineTemplate: post('UpdateRuleEngineTemplate'),
      DescribeRuleEngineTemplate: post('DescribeRuleEngineTemplate'),
    };
  }

  // Mỗi method Python: res = self.json(action, [], params); res == '' → raise;
  // json.loads(res). Đối số thứ hai của json là query params (luôn rỗng trong
  // CDN), đối số thứ ba là body JSON.
  private async callJson(action: string, params: Params): Promise<unknown> {
    const res = await this.json(action, {}, params);
    if (res === '') {
      throw new Error(`${action}: empty response`);
    }
    return JSON.parse(res);
  }

  // Python `send_request` gọi `self.request(...)` cho GET, nhưng base Service
  // Python không có method `request`; ở TS dùng `this.get` để method hoạt động
  // được thay vì giữ nhánh dead code.
  async sendRequest(
    action: string,
    params: Params = {},
    method: string = 'POST',
  ): Promise<string> {
    const m = String(method).toUpperCase();
    if (m === 'POST') {
      return this.json(action, {}, JSON.stringify(params));
    }
    if (m === 'GET') {
      return this.get(action, params);
    }
    throw new Error(`not support method ${m}`);
  }

  addCdnDomain(params: Params = {}): Promise<unknown> {
    return this.callJson('AddCdnDomain', params);
  }

  startCdnDomain(params: Params = {}): Promise<unknown> {
    return this.callJson('StartCdnDomain', params);
  }

  stopCdnDomain(params: Params = {}): Promise<unknown> {
    return this.callJson('StopCdnDomain', params);
  }

  deleteCdnDomain(params: Params = {}): Promise<unknown> {
    return this.callJson('DeleteCdnDomain', params);
  }

  listCdnDomains(params: Params = {}): Promise<unknown> {
    return this.callJson('ListCdnDomains', params);
  }

  describeCdnConfig(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeCdnConfig', params);
  }

  updateCdnConfig(params: Params = {}): Promise<unknown> {
    return this.callJson('UpdateCdnConfig', params);
  }

  describeCdnData(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeCdnData', params);
  }

  describeEdgeNrtDataSummary(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeEdgeNrtDataSummary', params);
  }

  describeCdnOriginData(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeCdnOriginData', params);
  }

  describeOriginNrtDataSummary(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeOriginNrtDataSummary', params);
  }

  describeCdnDataDetail(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeCdnDataDetail', params);
  }

  describeDistrictIspData(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeDistrictIspData', params);
  }

  describeEdgeStatisticalData(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeEdgeStatisticalData', params);
  }

  describeEdgeTopNrtData(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeEdgeTopNrtData', params);
  }

  describeOriginTopNrtData(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeOriginTopNrtData', params);
  }

  describeEdgeTopStatusCode(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeEdgeTopStatusCode', params);
  }

  describeOriginTopStatusCode(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeOriginTopStatusCode', params);
  }

  describeEdgeTopStatisticalData(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeEdgeTopStatisticalData', params);
  }

  describeCdnRegionAndIsp(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeCdnRegionAndIsp', params);
  }

  describeCdnService(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeCdnService', params);
  }

  describeAccountingData(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeAccountingData', params);
  }

  submitRefreshTask(params: Params = {}): Promise<unknown> {
    return this.callJson('SubmitRefreshTask', params);
  }

  submitPreloadTask(params: Params = {}): Promise<unknown> {
    return this.callJson('SubmitPreloadTask', params);
  }

  describeContentTasks(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeContentTasks', params);
  }

  describeContentQuota(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeContentQuota', params);
  }

  submitBlockTask(params: Params = {}): Promise<unknown> {
    return this.callJson('SubmitBlockTask', params);
  }

  submitUnblockTask(params: Params = {}): Promise<unknown> {
    return this.callJson('SubmitUnblockTask', params);
  }

  describeContentBlockTasks(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeContentBlockTasks', params);
  }

  describeCdnAccessLog(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeCdnAccessLog', params);
  }

  describeIpInfo(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeIPInfo', params);
  }

  describeIpListInfo(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeIPListInfo', params);
  }

  describeCdnUpperIp(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeCdnUpperIp', params);
  }

  listResourceTags(params: Params = {}): Promise<unknown> {
    return this.callJson('ListResourceTags', params);
  }

  addCdnCertificate(params: Params = {}): Promise<unknown> {
    return this.callJson('AddCdnCertificate', params);
  }

  listCertInfo(params: Params = {}): Promise<unknown> {
    return this.callJson('ListCertInfo', params);
  }

  listCdnCertInfo(params: Params = {}): Promise<unknown> {
    return this.callJson('ListCdnCertInfo', params);
  }

  describeCertConfig(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeCertConfig', params);
  }

  batchDeployCert(params: Params = {}): Promise<unknown> {
    return this.callJson('BatchDeployCert', params);
  }

  deleteCdnCertificate(params: Params = {}): Promise<unknown> {
    return this.callJson('DeleteCdnCertificate', params);
  }

  describeAccountingSummary(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeAccountingSummary', params);
  }

  describeTemplates(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeTemplates', params);
  }

  describeServiceTemplate(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeServiceTemplate', params);
  }

  describeCipherTemplate(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeCipherTemplate', params);
  }

  createCipherTemplate(params: Params = {}): Promise<unknown> {
    return this.callJson('CreateCipherTemplate', params);
  }

  updateServiceTemplate(params: Params = {}): Promise<unknown> {
    return this.callJson('UpdateServiceTemplate', params);
  }

  updateCipherTemplate(params: Params = {}): Promise<unknown> {
    return this.callJson('UpdateCipherTemplate', params);
  }

  duplicateTemplate(params: Params = {}): Promise<unknown> {
    return this.callJson('DuplicateTemplate', params);
  }

  lockTemplate(params: Params = {}): Promise<unknown> {
    return this.callJson('LockTemplate', params);
  }

  deleteTemplate(params: Params = {}): Promise<unknown> {
    return this.callJson('DeleteTemplate', params);
  }

  describeTemplateDomains(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeTemplateDomains', params);
  }

  addTemplateDomain(params: Params = {}): Promise<unknown> {
    return this.callJson('AddTemplateDomain', params);
  }

  updateTemplateDomain(params: Params = {}): Promise<unknown> {
    return this.callJson('UpdateTemplateDomain', params);
  }

  createServiceTemplate(params: Params = {}): Promise<unknown> {
    return this.callJson('CreateServiceTemplate', params);
  }

  createTemplateVersion(params: Params = {}): Promise<unknown> {
    return this.callJson('CreateTemplateVersion', params);
  }

  describeTemplateReleaseVersions(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeTemplateReleaseVersions', params);
  }

  describeDomainShared(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeDomainShared', params);
  }

  describeCdnIp(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeCdnIP', params);
  }

  describeDistrictData(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeDistrictData', params);
  }

  describeEdgeData(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeEdgeData', params);
  }

  describeDistrictSummary(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeDistrictSummary', params);
  }

  describeEdgeSummary(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeEdgeSummary', params);
  }

  describeOriginData(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeOriginData', params);
  }

  describeOriginSummary(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeOriginSummary', params);
  }

  describeUserData(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeUserData', params);
  }

  describeDistrictRanking(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeDistrictRanking', params);
  }

  describeEdgeRanking(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeEdgeRanking', params);
  }

  describeOriginRanking(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeOriginRanking', params);
  }

  describeEdgeStatusCodeRanking(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeEdgeStatusCodeRanking', params);
  }

  describeOriginStatusCodeRanking(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeOriginStatusCodeRanking', params);
  }

  describeStatisticalRanking(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeStatisticalRanking', params);
  }

  batchUpdateCdnConfig(params: Params = {}): Promise<unknown> {
    return this.callJson('BatchUpdateCdnConfig', params);
  }

  addCertificate(params: Params = {}): Promise<unknown> {
    return this.callJson('AddCertificate', params);
  }

  deleteUsageReport(params: Params = {}): Promise<unknown> {
    return this.callJson('DeleteUsageReport', params);
  }

  createUsageReport(params: Params = {}): Promise<unknown> {
    return this.callJson('CreateUsageReport', params);
  }

  listUsageReports(params: Params = {}): Promise<unknown> {
    return this.callJson('ListUsageReports', params);
  }

  describeSharedConfig(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeSharedConfig', params);
  }

  listSharedConfig(params: Params = {}): Promise<unknown> {
    return this.callJson('ListSharedConfig', params);
  }

  deleteSharedConfig(params: Params = {}): Promise<unknown> {
    return this.callJson('DeleteSharedConfig', params);
  }

  updateSharedConfig(params: Params = {}): Promise<unknown> {
    return this.callJson('UpdateSharedConfig', params);
  }

  addSharedConfig(params: Params = {}): Promise<unknown> {
    return this.callJson('AddSharedConfig', params);
  }

  tagResources(params: Params = {}): Promise<unknown> {
    return this.callJson('TagResources', params);
  }

  untagResources(params: Params = {}): Promise<unknown> {
    return this.callJson('UntagResources', params);
  }

  releaseTemplate(params: Params = {}): Promise<unknown> {
    return this.callJson('ReleaseTemplate', params);
  }

  createRuleEngineTemplate(params: Params = {}): Promise<unknown> {
    return this.callJson('CreateRuleEngineTemplate', params);
  }

  updateRuleEngineTemplate(params: Params = {}): Promise<unknown> {
    return this.callJson('UpdateRuleEngineTemplate', params);
  }

  describeRuleEngineTemplate(params: Params = {}): Promise<unknown> {
    return this.callJson('DescribeRuleEngineTemplate', params);
  }

  // Alias deprecated giữ lại để khớp Python.
  describeIplistInfo(params: Params = {}): Promise<unknown> {
    return this.describeIpListInfo(params);
  }
}

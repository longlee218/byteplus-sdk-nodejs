import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CdnService } from '../../src/cdn/cdn-service';
import { REGION_AP_SINGAPORE1 } from '../../src/const';

beforeEach(() => {
  // Chặn Service.init đọc env/HOME thật của máy dev
  vi.stubEnv('BYTEPLUS_ACCESSKEY', undefined);
  vi.stubEnv('BYTEPLUS_SECRETKEY', undefined);
  vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'cdn-home-')));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const EXPECTED_ACTIONS: string[] = [
  'AddCdnDomain',
  'StartCdnDomain',
  'StopCdnDomain',
  'DeleteCdnDomain',
  'ListCdnDomains',
  'DescribeCdnConfig',
  'UpdateCdnConfig',
  'DescribeCdnData',
  'DescribeEdgeNrtDataSummary',
  'DescribeCdnOriginData',
  'DescribeOriginNrtDataSummary',
  'DescribeCdnDataDetail',
  'DescribeDistrictIspData',
  'DescribeEdgeStatisticalData',
  'DescribeEdgeTopNrtData',
  'DescribeOriginTopNrtData',
  'DescribeEdgeTopStatusCode',
  'DescribeOriginTopStatusCode',
  'DescribeEdgeTopStatisticalData',
  'DescribeCdnRegionAndIsp',
  'DescribeCdnService',
  'DescribeAccountingData',
  'SubmitRefreshTask',
  'SubmitPreloadTask',
  'DescribeContentTasks',
  'DescribeContentQuota',
  'SubmitBlockTask',
  'SubmitUnblockTask',
  'DescribeContentBlockTasks',
  'DescribeCdnAccessLog',
  'DescribeIPInfo',
  'DescribeIPListInfo',
  'DescribeCdnUpperIp',
  'ListResourceTags',
  'AddCdnCertificate',
  'ListCertInfo',
  'ListCdnCertInfo',
  'DescribeCertConfig',
  'BatchDeployCert',
  'DeleteCdnCertificate',
  'DescribeAccountingSummary',
  'DescribeTemplates',
  'DescribeServiceTemplate',
  'DescribeCipherTemplate',
  'CreateCipherTemplate',
  'UpdateServiceTemplate',
  'UpdateCipherTemplate',
  'DuplicateTemplate',
  'LockTemplate',
  'DeleteTemplate',
  'DescribeTemplateDomains',
  'AddTemplateDomain',
  'UpdateTemplateDomain',
  'CreateServiceTemplate',
  'CreateTemplateVersion',
  'DescribeTemplateReleaseVersions',
  'DescribeDomainShared',
  'DescribeCdnIP',
  'DescribeDistrictData',
  'DescribeEdgeData',
  'DescribeDistrictSummary',
  'DescribeEdgeSummary',
  'DescribeOriginData',
  'DescribeOriginSummary',
  'DescribeUserData',
  'DescribeDistrictRanking',
  'DescribeEdgeRanking',
  'DescribeOriginRanking',
  'DescribeEdgeStatusCodeRanking',
  'DescribeOriginStatusCodeRanking',
  'DescribeStatisticalRanking',
  'BatchUpdateCdnConfig',
  'AddCertificate',
  'DeleteUsageReport',
  'CreateUsageReport',
  'ListUsageReports',
  'DescribeSharedConfig',
  'ListSharedConfig',
  'DeleteSharedConfig',
  'UpdateSharedConfig',
  'AddSharedConfig',
  'TagResources',
  'UntagResources',
  'ReleaseTemplate',
  'CreateRuleEngineTemplate',
  'UpdateRuleEngineTemplate',
  'DescribeRuleEngineTemplate',
];

describe('CdnService — cấu hình mặc định (khớp Python)', () => {
  it('region mặc định ap-singapore-1 → host open.byteplusapi.com, https', () => {
    const info = CdnService.getServiceInfo(REGION_AP_SINGAPORE1);
    expect(info.host).toBe('open.byteplusapi.com');
    expect(info.header).toEqual({ accept: 'application/json' });
    expect(info.credentials.service).toBe('CDN');
    expect(info.credentials.region).toBe(REGION_AP_SINGAPORE1);
    expect(info.credentials.ak).toBe('');
    expect(info.connectionTimeout).toBe(60);
    expect(info.socketTimeout).toBe(300);
    expect(info.scheme).toBe('https');
  });

  it('region không hỗ trợ throw đúng message', () => {
    expect(() => CdnService.getServiceInfo('cn-north-1')).toThrow(
      'do not support region cn-north-1',
    );
  });

  it('apiInfo map đủ 87 API với method=POST, Version=2021-03-01', () => {
    const api = CdnService.getApiInfo();
    expect(Object.keys(api).sort()).toEqual(EXPECTED_ACTIONS.slice().sort());
    for (const action of EXPECTED_ACTIONS) {
      expect(api[action]?.method, action).toBe('POST');
      expect(api[action]?.path, action).toBe('/');
      expect(api[action]?.query, action).toEqual({
        Action: action,
        Version: '2021-03-01',
      });
    }
  });
});

describe('CdnService — singleton kiểu Python', () => {
  it('hai lần khởi tạo trả về cùng một instance', () => {
    expect(new CdnService()).toBe(new CdnService());
  });

  it('khởi tạo lại reset serviceInfo trên instance chung', () => {
    const first = new CdnService();
    first.setAk('manually-set-ak');

    const second = new CdnService();
    expect(second).toBe(first);
    expect(first.serviceInfo.credentials.ak).toBe('');
  });

  it('khởi tạo lại nạp credential mới từ biến môi trường', () => {
    vi.stubEnv('BYTEPLUS_ACCESSKEY', 'env-ak-cdn');
    vi.stubEnv('BYTEPLUS_SECRETKEY', 'env-sk-cdn');
    const svc = new CdnService();
    expect(svc.serviceInfo.credentials.ak).toBe('env-ak-cdn');
    expect(svc.serviceInfo.credentials.sk).toBe('env-sk-cdn');
  });
});

describe('CdnService — guard và parse response', () => {
  it('response rỗng → throw "${action}: empty response"', async () => {
    const svc = new CdnService();
    vi.spyOn(svc, 'json').mockResolvedValue('');

    await expect(svc.listCdnDomains({})).rejects.toThrow(
      'ListCdnDomains: empty response',
    );
  });

  it('parse JSON response thành object', async () => {
    const svc = new CdnService();
    vi.spyOn(svc, 'json').mockResolvedValue('{"Result":{"Total":0}}');

    await expect(svc.describeCdnService({})).resolves.toEqual({
      Result: { Total: 0 },
    });
  });
});

describe('CdnService — sendRequest', () => {
  it('POST gọi json với body là JSON.stringify(params)', async () => {
    const svc = new CdnService();
    const spy = vi.spyOn(svc, 'json').mockResolvedValue('{}');

    const res = await svc.sendRequest('ListCdnDomains', { PageNum: 1 }, 'POST');

    expect(spy).toHaveBeenCalledWith('ListCdnDomains', {}, '{"PageNum":1}');
    expect(res).toBe('{}');
  });

  it('GET gọi get với params', async () => {
    const svc = new CdnService();
    const spy = vi.spyOn(svc, 'get').mockResolvedValue('{}');

    const res = await svc.sendRequest('ListCdnDomains', { PageNum: 1 }, 'GET');

    expect(spy).toHaveBeenCalledWith('ListCdnDomains', { PageNum: 1 });
    expect(res).toBe('{}');
  });

  it('method không hỗ trợ throw đúng message', async () => {
    const svc = new CdnService();
    await expect(svc.sendRequest('X', {}, 'PUT')).rejects.toThrow(
      'not support method PUT',
    );
  });

  it('chấp nhận method viết thường', async () => {
    const svc = new CdnService();
    const spy = vi.spyOn(svc, 'json').mockResolvedValue('{}');
    await svc.sendRequest('ListCdnDomains', {}, 'post');
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('CdnService — mỗi method map đúng Action (khớp Python)', () => {
  const cases: Array<[keyof CdnService & string, string]> = [
    ['addCdnDomain', 'AddCdnDomain'],
    ['startCdnDomain', 'StartCdnDomain'],
    ['stopCdnDomain', 'StopCdnDomain'],
    ['deleteCdnDomain', 'DeleteCdnDomain'],
    ['listCdnDomains', 'ListCdnDomains'],
    ['describeCdnConfig', 'DescribeCdnConfig'],
    ['updateCdnConfig', 'UpdateCdnConfig'],
    ['describeCdnData', 'DescribeCdnData'],
    ['describeEdgeNrtDataSummary', 'DescribeEdgeNrtDataSummary'],
    ['describeCdnOriginData', 'DescribeCdnOriginData'],
    ['describeOriginNrtDataSummary', 'DescribeOriginNrtDataSummary'],
    ['describeCdnDataDetail', 'DescribeCdnDataDetail'],
    ['describeDistrictIspData', 'DescribeDistrictIspData'],
    ['describeEdgeStatisticalData', 'DescribeEdgeStatisticalData'],
    ['describeEdgeTopNrtData', 'DescribeEdgeTopNrtData'],
    ['describeOriginTopNrtData', 'DescribeOriginTopNrtData'],
    ['describeEdgeTopStatusCode', 'DescribeEdgeTopStatusCode'],
    ['describeOriginTopStatusCode', 'DescribeOriginTopStatusCode'],
    ['describeEdgeTopStatisticalData', 'DescribeEdgeTopStatisticalData'],
    ['describeCdnRegionAndIsp', 'DescribeCdnRegionAndIsp'],
    ['describeCdnService', 'DescribeCdnService'],
    ['describeAccountingData', 'DescribeAccountingData'],
    ['submitRefreshTask', 'SubmitRefreshTask'],
    ['submitPreloadTask', 'SubmitPreloadTask'],
    ['describeContentTasks', 'DescribeContentTasks'],
    ['describeContentQuota', 'DescribeContentQuota'],
    ['submitBlockTask', 'SubmitBlockTask'],
    ['submitUnblockTask', 'SubmitUnblockTask'],
    ['describeContentBlockTasks', 'DescribeContentBlockTasks'],
    ['describeCdnAccessLog', 'DescribeCdnAccessLog'],
    ['describeIpInfo', 'DescribeIPInfo'],
    ['describeIpListInfo', 'DescribeIPListInfo'],
    ['describeCdnUpperIp', 'DescribeCdnUpperIp'],
    ['listResourceTags', 'ListResourceTags'],
    ['addCdnCertificate', 'AddCdnCertificate'],
    ['listCertInfo', 'ListCertInfo'],
    ['listCdnCertInfo', 'ListCdnCertInfo'],
    ['describeCertConfig', 'DescribeCertConfig'],
    ['batchDeployCert', 'BatchDeployCert'],
    ['deleteCdnCertificate', 'DeleteCdnCertificate'],
    ['describeAccountingSummary', 'DescribeAccountingSummary'],
    ['describeTemplates', 'DescribeTemplates'],
    ['describeServiceTemplate', 'DescribeServiceTemplate'],
    ['describeCipherTemplate', 'DescribeCipherTemplate'],
    ['createCipherTemplate', 'CreateCipherTemplate'],
    ['updateServiceTemplate', 'UpdateServiceTemplate'],
    ['updateCipherTemplate', 'UpdateCipherTemplate'],
    ['duplicateTemplate', 'DuplicateTemplate'],
    ['lockTemplate', 'LockTemplate'],
    ['deleteTemplate', 'DeleteTemplate'],
    ['describeTemplateDomains', 'DescribeTemplateDomains'],
    ['addTemplateDomain', 'AddTemplateDomain'],
    ['updateTemplateDomain', 'UpdateTemplateDomain'],
    ['createServiceTemplate', 'CreateServiceTemplate'],
    ['createTemplateVersion', 'CreateTemplateVersion'],
    ['describeTemplateReleaseVersions', 'DescribeTemplateReleaseVersions'],
    ['describeDomainShared', 'DescribeDomainShared'],
    ['describeCdnIp', 'DescribeCdnIP'],
    ['describeDistrictData', 'DescribeDistrictData'],
    ['describeEdgeData', 'DescribeEdgeData'],
    ['describeDistrictSummary', 'DescribeDistrictSummary'],
    ['describeEdgeSummary', 'DescribeEdgeSummary'],
    ['describeOriginData', 'DescribeOriginData'],
    ['describeOriginSummary', 'DescribeOriginSummary'],
    ['describeUserData', 'DescribeUserData'],
    ['describeDistrictRanking', 'DescribeDistrictRanking'],
    ['describeEdgeRanking', 'DescribeEdgeRanking'],
    ['describeOriginRanking', 'DescribeOriginRanking'],
    ['describeEdgeStatusCodeRanking', 'DescribeEdgeStatusCodeRanking'],
    ['describeOriginStatusCodeRanking', 'DescribeOriginStatusCodeRanking'],
    ['describeStatisticalRanking', 'DescribeStatisticalRanking'],
    ['batchUpdateCdnConfig', 'BatchUpdateCdnConfig'],
    ['addCertificate', 'AddCertificate'],
    ['deleteUsageReport', 'DeleteUsageReport'],
    ['createUsageReport', 'CreateUsageReport'],
    ['listUsageReports', 'ListUsageReports'],
    ['describeSharedConfig', 'DescribeSharedConfig'],
    ['listSharedConfig', 'ListSharedConfig'],
    ['deleteSharedConfig', 'DeleteSharedConfig'],
    ['updateSharedConfig', 'UpdateSharedConfig'],
    ['addSharedConfig', 'AddSharedConfig'],
    ['tagResources', 'TagResources'],
    ['untagResources', 'UntagResources'],
    ['releaseTemplate', 'ReleaseTemplate'],
    ['createRuleEngineTemplate', 'CreateRuleEngineTemplate'],
    ['updateRuleEngineTemplate', 'UpdateRuleEngineTemplate'],
    ['describeRuleEngineTemplate', 'DescribeRuleEngineTemplate'],
    ['describeIplistInfo', 'DescribeIPListInfo'],
  ];

  for (const [method, action] of cases) {
    it(`${method} → json('${action}', {}, params)`, async () => {
      const svc = new CdnService();
      const spy = vi.spyOn(svc, 'json').mockResolvedValue('{}');
      await (
        svc[method] as (params: Record<string, unknown>) => Promise<unknown>
      )({ a: 1 });
      expect(spy).toHaveBeenCalledWith(action, {}, { a: 1 });
    });
  }

  it('describeIplistInfo là alias deprecated của describeIpListInfo', async () => {
    const svc = new CdnService();
    const spy = vi.spyOn(svc, 'json').mockResolvedValue('{}');
    await svc.describeIplistInfo({ ip: '1.2.3.4' });
    expect(spy).toHaveBeenCalledWith('DescribeIPListInfo', {}, { ip: '1.2.3.4' });
  });
});

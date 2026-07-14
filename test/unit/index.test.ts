import { describe, expect, it } from 'vitest';

import * as sdk from '../../src/index';

describe('public API surface', () => {
  it('export đầy đủ các thành phần lõi', () => {
    expect(sdk.ApiInfo).toBeTypeOf('function');
    expect(sdk.Credentials).toBeTypeOf('function');
    expect(sdk.ServiceInfo).toBeTypeOf('function');
    expect(sdk.MetaData).toBeTypeOf('function');
    expect(sdk.SignerV4).toBeTypeOf('function');
    expect(sdk.Request).toBeTypeOf('function');
    expect(sdk.Service).toBeTypeOf('function');
    expect(sdk.Policy).toBeTypeOf('function');
    expect(sdk.Statement).toBeTypeOf('function');
    expect(sdk.SecurityToken2).toBeTypeOf('function');
    expect(sdk.InnerToken).toBeTypeOf('function');
    expect(sdk.IamService).toBeTypeOf('function');
    expect(sdk.VisualService).toBeTypeOf('function');
    expect(sdk.SmsService).toBeTypeOf('function');
    expect(sdk.VERSION).toBeTypeOf('string');
    expect(sdk.Const.REGION_AP_SINGAPORE1).toBe('ap-singapore-1');
    expect(sdk.Util.sha256).toBeTypeOf('function');
    expect(sdk.Util.crc32).toBeTypeOf('function');
    expect(sdk.Util.normQuery).toBeTypeOf('function');
  });

  it('ApiInfo.toString mô tả method và path', () => {
    expect(String(new sdk.ApiInfo('GET', '/x', {}, {}, {}))).toBe(
      'method: GET, path: /x',
    );
  });
});

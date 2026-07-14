import { describe, expect, it } from 'vitest';

import { IamService } from '../../src/iam/iam-service';

// E2E gọi BytePlus API thật — chỉ chạy khi có credential thật trong env:
//   BYTEPLUS_E2E_AK=... BYTEPLUS_E2E_SK=... npm run test
const ak = process.env['BYTEPLUS_E2E_AK'];
const sk = process.env['BYTEPLUS_E2E_SK'];

describe.skipIf(ak === undefined || sk === undefined)(
  'IamService E2E — BytePlus API thật',
  () => {
    it('ListUsers trả về ResponseMetadata hợp lệ', async () => {
      const svc = new IamService();
      svc.setScheme('https');
      svc.setAk(ak as string);
      svc.setSk(sk as string);

      const resp = (await svc.listUsers({ Limit: 1 })) as {
        ResponseMetadata?: { Action?: string };
      };
      expect(resp).toBeTypeOf('object');
      expect(resp.ResponseMetadata?.Action).toBe('ListUsers');
    });
  },
);

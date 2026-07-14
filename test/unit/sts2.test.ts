import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceInfo } from '../../src/service-info';
import { Credentials } from '../../src/credentials';
import { Service } from '../../src/base/service';
import { Policy, Statement } from '../../src/policy';
import { VECTOR_CREDENTIALS, vectors } from '../helpers/vectors';

vi.mock('../../src/util/crypto', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/util/crypto')>();
  return {
    ...actual,
    generateAccessKeyId: (): string => vectors.sts2.accessKeyId,
    generateSecretKey: (): string => vectors.sts2.secretAccessKey,
  };
});

function makeService(): Service {
  const { ak, sk, service, region } = VECTOR_CREDENTIALS;
  return new Service(
    new ServiceInfo(
      'open.byteplusapi.com',
      {},
      new Credentials(ak, sk, service, region),
      5,
      5,
    ),
    {},
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(vectors.sts2.nowEpoch * 1000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Service.signSts2', () => {
  it('khớp toàn bộ SecurityToken2 với vector Python (có policy)', () => {
    const policy = new Policy([
      Statement.newAllowStatement(
        ['vod:GetPlayInfo'],
        ['trn:vod::*:video_id/abc'],
      ),
    ]);
    const sts = makeService().signSts2(policy, vectors.sts2.expireSeconds);

    expect(sts.accessKeyId).toBe(vectors.sts2.accessKeyId);
    expect(sts.secretAccessKey).toBe(vectors.sts2.secretAccessKey);
    expect(sts.currentTime).toBe(vectors.sts2.currentTime);
    expect(sts.expiredTime).toBe(vectors.sts2.expiredTime);
    expect(sts.sessionToken).toBe(vectors.sts2.sessionToken);
  });

  it('khớp vector Python khi policy=null và expire < 60 bị nâng lên 60', () => {
    const sts = makeService().signSts2(
      null,
      vectors.sts2NoPolicy.expireSeconds,
    );
    expect(sts.expiredTime).toBe(vectors.sts2NoPolicy.expiredTime);
    expect(sts.sessionToken).toBe(vectors.sts2NoPolicy.sessionToken);
  });
});

describe('Statement', () => {
  it('newDenyStatement gán effect Deny', () => {
    const s = Statement.newDenyStatement(['a:b'], ['r']);
    expect(s.effect).toBe('Deny');
    expect(s.action).toEqual(['a:b']);
  });
});

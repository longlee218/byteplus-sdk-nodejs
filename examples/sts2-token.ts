// Sample: cấp STS2 token tạm thời với policy giới hạn quyền
// Chạy: BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> npx tsx examples/sts2-token.ts
import {
  ApiInfo,
  Const,
  Credentials,
  Policy,
  Service,
  ServiceInfo,
  Statement,
} from '../src';

function main(): void {
  const service = new Service(
    new ServiceInfo(
      'open.byteplusapi.com',
      { Accept: 'application/json' },
      new Credentials('', '', 'vod', Const.REGION_AP_SINGAPORE1),
      5,
      5,
      'https',
    ),
    { GetPlayInfo: new ApiInfo('GET', '/', {}, {}, {}) },
  );

  const policy = new Policy([
    Statement.newAllowStatement(
      [Const.ACTION_VOD_GET_PLAY_INFO],
      ['trn:vod::*:video_id/<video_id>'],
    ),
  ]);

  const sts = service.signSts2(policy, 3600); // hết hạn sau 1 giờ
  console.log(
    JSON.stringify(
      {
        AccessKeyID: sts.accessKeyId,
        SecretAccessKey: sts.secretAccessKey,
        SessionToken: sts.sessionToken,
        CurrentTime: sts.currentTime,
        ExpiredTime: sts.expiredTime,
      },
      null,
      2,
    ),
  );
}

main();

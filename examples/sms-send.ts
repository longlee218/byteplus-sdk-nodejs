// Sample: gửi SMS và mã xác thực (OTP) qua SmsService
// Chạy: BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> npx tsx examples/sms-send.ts
import { Const, SmsService } from '../src';

interface SmsResponse {
  ResponseMetadata: { Error?: { Code: string; Message: string } };
  Result?: { MessageID?: string[] };
}

async function main(): Promise<void> {
  // BytePlus quốc tế dùng ap-singapore-1 (sms.byteplusapi.com);
  // bỏ tham số để dùng mặc định cn-north-1 (sms.volcengineapi.com).
  const sms = new SmsService(Const.REGION_AP_SINGAPORE1);
  // AK/SK tự nạp từ env hoặc ~/.byteplus/config

  // ----- Gửi SMS theo template -----
  const resp = (await sms.sendSms({
    SmsAccount: '<sms_account>', // message group ID trên console BytePlus
    Sign: '<chữ_ký_thương_hiệu>',
    TemplateID: '<template_id>',
    TemplateParam: JSON.stringify({ code: '123456' }), // string JSON
    PhoneNumbers: '84900000000', // nhiều số cách nhau dấu phẩy
  })) as SmsResponse;

  if (resp.ResponseMetadata.Error !== undefined) {
    throw new Error(
      `BytePlus trả lỗi ${resp.ResponseMetadata.Error.Code}: ${resp.ResponseMetadata.Error.Message}`,
    );
  }
  console.log('MessageID:', resp.Result?.MessageID);

  // ----- Gửi và kiểm tra mã xác thực (OTP) -----
  await sms.sendSmsVerifyCode({
    SmsAccount: '<sms_account>',
    Sign: '<chữ_ký_thương_hiệu>',
    TemplateID: '<template_id>',
    PhoneNumber: '84900000000',
    Scene: 'login',
    ExpireTime: 300,
    TryCount: 3,
    CodeType: 6,
  });

  const check = await sms.checkSmsVerifyCode({
    SmsAccount: '<sms_account>',
    PhoneNumber: '84900000000',
    Scene: 'login',
    Code: '<mã_người_dùng_nhập>',
  });
  console.log('Kết quả kiểm tra OTP:', JSON.stringify(check));
}

main().catch((e) => {
  console.error('Lỗi:', (e as Error).message);
  process.exitCode = 1;
});

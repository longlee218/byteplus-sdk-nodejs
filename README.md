# byteplus-sdk-nodejs

BytePlus SDK cho Node.js — port từ [byteplus-sdk-python](https://github.com/byteplus-sdk/byteplus-sdk-python) (nhánh `master`, v1.0.59). Mọi hành vi ký request, mã hoá và cấu trúc API đều được đối chiếu từng byte với bản Python gốc bằng test vector.

## Yêu cầu

- Node.js `>= 18.19.0`
- Không có runtime dependency — chỉ dùng module built-in (`node:crypto`, `fetch`)

## Trạng thái

| Module | Trạng thái |
| --- | --- |
| Lõi: ký request SignerV4, Service/Request, Credentials, STS2, util, const | ✅ Hoàn thành |
| IAM | ✅ Hoàn thành |
| Visual | ✅ Hoàn thành |
| SMS | ✅ Hoàn thành |
| CDN, Live, VOD | 📋 Kế hoạch |

📖 **Tài liệu chi tiết:** [Hướng dẫn tích hợp](guides/huong-dan-tich-hop.md) · **Code mẫu:** [`examples/`](examples/)

## Cài đặt

Package chưa publish lên npm. Cài trực tiếp từ repo:

```bash
npm install <đường-dẫn-hoặc-git-url-repo-này>
```

## Cấu hình credential

SDK đọc credential theo thứ tự ưu tiên (giống bản Python):

1. Biến môi trường `BYTEPLUS_ACCESSKEY` và `BYTEPLUS_SECRETKEY`.
2. File `~/.byteplus/config` dạng JSON: `{"ak": "...", "sk": "..."}`.
3. Truyền trực tiếp qua `Credentials` hoặc `service.setAk()/setSk()`.

> ⚠️ Không hardcode AK/SK trong source code.

## Sử dụng nhanh

Lõi SDK dùng để gọi bất kỳ BytePlus API nào có ký SignerV4 (các service module iam/visual sẽ đóng gói sẵn phần này):

```typescript
import { ApiInfo, Credentials, Service, ServiceInfo } from 'byteplus-sdk-nodejs';

const serviceInfo = new ServiceInfo(
  'open.byteplusapi.com',                          // host
  { Accept: 'application/json' },                  // header chung
  new Credentials('<AK>', '<SK>', 'iam', 'ap-singapore-1'),
  5,                                               // connection timeout (giây)
  5,                                               // socket timeout (giây)
  'https',
);

const apiInfo = {
  ListUsers: new ApiInfo('GET', '/', { Action: 'ListUsers', Version: '2018-01-01' }, {}, {}),
};

const service = new Service(serviceInfo, apiInfo);

// GET với query params — request được ký tự động
const result = await service.get('ListUsers', { Limit: 10 });

// POST JSON
// const result = await service.json('SomeAction', {}, { Key: 'value' });

// Sinh URL đã ký (không gửi request)
// const signedQuery = service.getSignUrl('ListUsers', {});
```

### Module IAM

```typescript
import { IamService } from 'byteplus-sdk-nodejs';

const iam = new IamService(); // singleton, mặc định region ap-singapore-1
iam.setScheme('https');
iam.setAk('<AK>'); // bỏ qua nếu đã cấu hình env hoặc ~/.byteplus/config
iam.setSk('<SK>');

const users = await iam.listUsers({ Limit: 5, Offset: 0 });
```

### Module Visual (Computer Vision)

```typescript
import { VisualService } from 'byteplus-sdk-nodejs';

const visual = new VisualService(); // singleton, host cv.byteplusapi.com, https
visual.setAk('<AK>');
visual.setSk('<SK>');

// API JSON (v2024-06-06)
const result = await visual.cvProcess({
  req_key: 'face_swap',
  binary_data_base64: ['<ảnh base64>'],
});

// Tác vụ bất đồng bộ
const task = await visual.cvSubmitTask({ req_key: '...' });
const output = await visual.cvGetResult({ task_id: '...' });

// API form (v2022-08-24)
const comic = await visual.comicPortrait({ image_base64: '<ảnh base64>' });
```

> Lưu ý (giữ nguyên hành vi bản Python): khi BytePlus trả lỗi có body JSON
> (vd `{"code": 50411, "message": ...}`), các method Visual **trả về object
> lỗi đó** thay vì throw — hãy kiểm tra `code` trong kết quả. Chỉ throw khi
> response lỗi không phải JSON.

### Module SMS

```typescript
import { SmsService } from 'byteplus-sdk-nodejs';

// Mặc định region cn-north-1 (host sms.volcengineapi.com) — giống Python.
// Với BytePlus quốc tế dùng ap-singapore-1 (host sms.byteplusapi.com):
const sms = new SmsService('ap-singapore-1'); // singleton
sms.setAk('<AK>'); // bỏ qua nếu đã cấu hình env hoặc ~/.byteplus/config
sms.setSk('<SK>');

// Gửi SMS
const result = await sms.sendSms({
  SmsAccount: '<sms_account>',
  Sign: '<chữ_ký_thương_hiệu>',
  TemplateID: '<template_id>',
  TemplateParam: '{"code": "123456"}',
  PhoneNumbers: '84900000000',
});

// Gửi / kiểm tra mã xác thực
await sms.sendSmsVerifyCode({ SmsAccount: '...', Sign: '...', TemplateID: '...', PhoneNumbers: '...', Scene: '...', ExpireTime: 300, TryCount: 3, CodeType: 6 });
await sms.checkSmsVerifyCode({ SmsAccount: '...', PhoneNumber: '...', Scene: '...', Code: '123456' });

// Quản lý template / sub-account
await sms.getSmsTemplateAndOrderList({ subAccount: '...', pageIndex: 1, pageSize: 10 });
await sms.getSubAccountList({ subAccountName: '', pageIndex: 1, pageSize: 10 });
```

> Mỗi method SMS tự retry thêm 1 lần khi lỗi (giữ nguyên `@retry(tries=2)`
> của bản Python).

### STS2 token

```typescript
import { Policy, Statement } from 'byteplus-sdk-nodejs';

const policy = new Policy([
  Statement.newAllowStatement(['vod:GetPlayInfo'], ['trn:vod::*:video_id/abc']),
]);
const sts = service.signSts2(policy, 3600); // hết hạn sau 3600 giây
// sts.accessKeyId, sts.secretAccessKey, sts.sessionToken
```

### Tiện ích mã hoá

```typescript
import { Util } from 'byteplus-sdk-nodejs';

Util.sha256('nội dung');                 // hex SHA-256
Util.hmacSha256(Buffer.from('key'), 'content');
Util.crc32File('/path/to/file');         // CRC32 khi upload file
```

## Khác biệt so với bản Python

Bản Node giữ nguyên hành vi ký/mã hoá, chỉ khác các điểm sau:

- HTTP dùng `fetch` built-in thay cho thư viện `requests`; timeout tổng = `connectionTimeout + socketTimeout`. Riêng `service.json()` với method `GET` kèm body khác rỗng (một số API SMS cần) đi qua `node:http(s)` vì fetch cấm GET có body — wire format vẫn giống hệt Python.
- `ServiceInfoHttps` không tồn tại — dùng `ServiceInfo` với tham số `scheme: 'https'`.
- Naming đổi sang camelCase: `set_ak` → `setAk`, `sign_sts2` → `signSts2`…

## Phát triển

```bash
npm install
npm run test        # vitest + coverage (ngưỡng 80%)
npm run typecheck   # tsc --noEmit
npm run build       # biên dịch ra dist/
```

Test đối chiếu trực tiếp với output của bản Python (`test/fixtures/python-vectors.json`) — chữ ký, AES, STS2 token phải khớp từng byte.

## Giấy phép

MIT

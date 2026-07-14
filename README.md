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
| Visual | 🔜 Kế tiếp |
| SMS, CDN, Live, VOD | 📋 Kế hoạch |

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

- HTTP dùng `fetch` built-in thay cho thư viện `requests`; timeout tổng = `connectionTimeout + socketTimeout`.
- `ServiceInfoHttps` không tồn tại — dùng `ServiceInfo` với tham số `scheme: 'https'`.
- `service.json()` với method `GET` kèm body khác rỗng sẽ throw (fetch không cho phép GET có body).
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

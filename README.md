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
| CDN | ✅ Hoàn thành |
| Ark (management + runtime: chat, embeddings, images, video) | ✅ Hoàn thành |
| Live, VOD | 📋 Kế hoạch |

📖 **Tài liệu chi tiết:** [Hướng dẫn tích hợp](guides/huong-dan-tich-hop.md) · **Code mẫu:** [`examples/`](examples/)

## Cài đặt

Package chưa publish lên npm registry. Có 3 cách cài, tuỳ tình huống:

### Cách 1: Git dependency (dùng cho project khác)

```bash
# Ghim theo phiên bản release cụ thể (khuyến nghị — xem tag tại
# https://github.com/longlee218/byteplus-sdk-nodejs/tags)
npm install github:longlee218/byteplus-sdk-nodejs#v0.1.1

# hoặc URL đầy đủ qua SSH
npm install git+ssh://git@github.com/longlee218/byteplus-sdk-nodejs.git#v0.1.1

# lấy luôn branch master (mới nhất, chưa chắc ổn định)
npm install github:longlee218/byteplus-sdk-nodejs#master
```

> Script `prepare` tự chạy `npm run build` khi npm cài từ git — không cần
> build tay. (Tag `v0.1.0` được tạo trước khi thêm script này nên không tự
> build; từ `v0.1.1` trở đi thì cài xong dùng được ngay.)

### Cách 2: Từ thư mục local (dev cùng monorepo)

```bash
npm install file:../đường-dẫn-tới-byteplus-sdk-nodejs
```

### Cách 3: Clone thủ công

```bash
git clone git@github.com:longlee218/byteplus-sdk-nodejs.git
cd byteplus-sdk-nodejs
npm install
npm run build
```

Import qua đường dẫn tương đối tới `dist/index.js`, hoặc publish lên registry
nội bộ (GitHub Packages/Verdaccio) nếu cần dùng ở nhiều project cùng lúc.

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

### Module CDN

```typescript
import { CdnService } from 'byteplus-sdk-nodejs';

const cdn = new CdnService(); // singleton, chỉ hỗ trợ ap-singapore-1, host open.byteplusapi.com
cdn.setAk('<AK>'); // bỏ qua nếu đã cấu hình env hoặc ~/.byteplus/config
cdn.setSk('<SK>');

// Quản lý domain
const domains = await cdn.listCdnDomains({ PageNum: 1, PageSize: 10 });
await cdn.addCdnDomain({ Domain: 'example.com', ServiceType: 'download' });

// Cache refresh / preload
await cdn.submitRefreshTask({ Type: 'file', Urls: 'https://example.com/a.js' });
await cdn.submitPreloadTask({ Type: 'file', Urls: 'https://example.com/b.js' });

// Thống kê
const data = await cdn.describeCdnData({ StartTime: 1700000000, EndTime: 1700003600, Metric: 'flux' });
```

> CDN có 87 API POST, tất cả dùng `Version=2021-03-01` và được ký với
> `service=CDN`. Xem danh sách đầy đủ trong `src/cdn/cdn-service.ts`.

### Module Ark (management API)

Port từ `byteplussdkark` của [byteplus-python-sdk-v2](https://github.com/byteplus-sdk/byteplus-python-sdk-v2) (bản v1 không có Ark). Ký SignerV4 với `service=ark`, dùng AK/SK:

```typescript
import { ArkService } from 'byteplus-sdk-nodejs';

const ark = new ArkService(); // singleton, mặc định region ap-singapore-1
ark.setAk('<AK>'); // bỏ qua nếu đã cấu hình env hoặc ~/.byteplus/config
ark.setSk('<SK>');

// Lấy API key ngắn hạn cho endpoint (dùng cho Ark runtime)
const resp = await ark.getApiKey({
  DurationSeconds: 7 * 24 * 60 * 60,
  ResourceType: 'endpoint',
  ResourceIds: ['ep-xxx'],
});
// resp.Result.ApiKey, resp.Result.ExpiredTime

// Quản lý endpoint / model customization / batch inference
await ark.getEndpoint({ Id: 'ep-xxx' });
await ark.listBatchInferenceJobs({ PageNumber: 1 });

// Private trusted asset library (real-human portrait) cho Seedance 2.0 —
// asset group sinh ra từ xác thực người thật, không dùng createAssetGroup
const session = await ark.createVisualValidateSession({
  CallbackURL: 'https://www.example.com/callback',
  ProjectName: 'default',
});
console.log(session.Result.H5Link); // end user mở link này để xác thực (thêm &lng=en)
// Sau khi end user hoàn tất H5 (resultCode 10000), đổi BytedToken lấy GroupId.
// BytedToken sống 30 phút.
const validated = await ark.getVisualValidateResult({
  BytedToken: session.Result.BytedToken,
  ProjectName: 'default',
});
// validated.Result.GroupId — upload ảnh của chính người đó bằng createAsset
// bên dưới; asset sai người hoặc nhiều mặt sẽ về Status = 'Failed'.
// Query riêng library người thật bằng GroupType:
await ark.listAssets({
  Filter: { GroupIds: [validated.Result.GroupId], GroupType: 'LivenessFace' },
});

// Private trusted asset library (virtual portrait) cho Seedance 2.0
const group = await ark.createAssetGroup({ Name: 'g', ProjectName: 'default' });
const asset = await ark.createAsset({
  GroupId: group.Result.Id,
  URL: '<IMAGE_URL>',
  AssetType: 'Image',
  ProjectName: 'default',
});
await ark.getAsset({ Id: asset.Result.Id, ProjectName: 'default' }); // poll đến khi Status = Active
// Dùng asset://<AssetId> trong content.image_url.url khi gọi ArkRuntimeClient.createContentGenerationTask
```

> 23 action POST, `Version=2024-01-01`. Response giữ nguyên envelope
> `{ResponseMetadata, Result}` — kiểm tra `ResponseMetadata.Error` trước
> khi đọc `Result`.

Xem `examples/ark-upload-asset-and-generate-video.ts` (virtual portrait) và
`examples/ark-real-human-asset-and-generate-video.ts` (real-human portrait)
cho luồng đầy đủ tới bước sinh video.

### Module Ark runtime (inference)

Port từ `byteplussdkarkruntime` — client kiểu OpenAI gọi
`https://ark.ap-southeast.bytepluses.com/api/v3`:

```typescript
import { ArkRuntimeClient, ArkStream } from 'byteplus-sdk-nodejs';

// Cách 1: API key (env ARK_API_KEY hoặc truyền trực tiếp)
const client = new ArkRuntimeClient({ apiKey: '<API_KEY>' });

// Cách 2: AK/SK — tự đổi STS token qua GetApiKey, tự refresh trước hạn.
// Chỉ dùng được với model dạng endpoint `ep-...`.
// const client = new ArkRuntimeClient({ ak: '<AK>', sk: '<SK>' });

// Chat completions
const completion = await client.createChatCompletion({
  model: 'ep-xxx',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Chat completions streaming (SSE)
const stream = (await client.createChatCompletion({
  model: 'ep-xxx',
  messages: [{ role: 'user', content: 'Hello!' }],
  stream: true,
})) as ArkStream;
for await (const chunk of stream) {
  // chunk.choices[0].delta.content
}

// Embeddings
await client.createEmbeddings({ model: 'ep-xxx', input: ['xin chào'] });
await client.createMultimodalEmbeddings({ model: 'ep-xxx', input: [{ type: 'text', text: 'hi' }] });

// Sinh ảnh (bắt buộc API key — AK/SK không được hỗ trợ, giống Python)
await client.generateImages({ model: 'ep-img', prompt: 'a cat' });

// Sinh video / content generation (bắt buộc API key)
const task = await client.createContentGenerationTask({
  model: 'ep-video',
  content: [{ type: 'text', text: 'A cat playing piano --ratio 16:9' }],
});
await client.getContentGenerationTask('<task_id>');
await client.listContentGenerationTasks({ status: 'succeeded', pageSize: 10 });
await client.deleteContentGenerationTask('<task_id>');
```

> Retry tự động tối đa 2 lần cho lỗi mạng/408/409/429/5xx (giống Python
> `DEFAULT_MAX_RETRIES=2`). Timeout mặc định 600s. E2E encryption chưa hỗ trợ.

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

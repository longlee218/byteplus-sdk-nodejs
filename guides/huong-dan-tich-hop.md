# Hướng dẫn tích hợp BytePlus SDK Node.js

Tài liệu này hướng dẫn tích hợp SDK vào dự án Node.js/TypeScript. SDK được port từ [byteplus-sdk-python](https://github.com/byteplus-sdk/byteplus-sdk-python) (nhánh `master`) và giữ nguyên hành vi ký request, mã hoá của bản gốc.

## Mục lục

1. [Yêu cầu và cài đặt](#1-yêu-cầu-và-cài-đặt)
2. [Cấu hình credential](#2-cấu-hình-credential)
3. [Module IAM](#3-module-iam)
4. [Module Visual](#4-module-visual)
5. [Module SMS](#5-module-sms)
6. [Module CDN](#6-module-cdn)
7. [Module Ark](#7-module-ark)
8. [STS2 token](#8-sts2-token)
9. [Gọi API BytePlus bất kỳ bằng lõi SDK](#9-gọi-api-byteplus-bất-kỳ-bằng-lõi-sdk)
10. [Xử lý lỗi](#10-xử-lý-lỗi)
11. [Khác biệt so với bản Python](#11-khác-biệt-so-với-bản-python)

## 1. Yêu cầu và cài đặt

- Node.js `>= 18.19.0` (đã test trên 18/20/22/24).
- Không có runtime dependency.

```bash
# Package chưa publish npm — cài từ repo:
npm install <đường-dẫn-hoặc-git-url-repo-này>
```

Chạy thử các sample trong thư mục [`examples/`](../examples/):

```bash
BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> npx tsx examples/iam-list-users.ts
```

## 2. Cấu hình credential

SDK nạp credential theo thứ tự ưu tiên (giống bản Python):

| Ưu tiên | Nguồn | Ghi chú |
| --- | --- | --- |
| 1 | Biến môi trường `BYTEPLUS_ACCESSKEY` + `BYTEPLUS_SECRETKEY` | Khuyến nghị cho server/CI |
| 2 | File `~/.byteplus/config` | JSON: `{"ak": "...", "sk": "..."}` |
| 3 | Code: `service.setAk(...)` / `service.setSk(...)` | Chỉ dùng khi 2 cách trên không phù hợp |

> ⚠️ **Không hardcode AK/SK trong source code.** Nếu lỡ commit secret, hãy thu hồi (rotate) key ngay trên console BytePlus.

Lưu ý về singleton: `IamService`/`VisualService` là singleton — **mỗi lần `new` lại sẽ reset host/credential về mặc định** và nạp lại từ env/file config (đúng hành vi bản Python). Vì vậy hãy khởi tạo một lần rồi tái sử dụng.

## 3. Module IAM

```typescript
import { IamService } from 'byteplus-sdk-nodejs';

const iam = new IamService(); // mặc định: open.byteplusapi.com, region ap-singapore-1
iam.setScheme('https');       // mặc định của IAM là http — nên bật https

const resp = await iam.listUsers({ Limit: 5, Offset: 0 });
// resp = { ResponseMetadata: {...}, Result: { UserMetadata: [...] } }
```

- `listUsers(params)` throw `Error('empty response')` nếu BytePlus trả body rỗng, và throw body lỗi khi HTTP status khác 200.

## 4. Module Visual

```typescript
import { VisualService } from 'byteplus-sdk-nodejs';

const visual = new VisualService(); // cv.byteplusapi.com, https, timeout 30s
visual.setAk(process.env.BYTEPLUS_ACCESSKEY ?? '');
visual.setSk(process.env.BYTEPLUS_SECRETKEY ?? '');
```

### API đồng bộ (JSON, v2024-06-06)

```typescript
const result = await visual.cvProcess({
  req_key: '<tên_model>',
  binary_data_base64: ['<ảnh base64>'],
});
```

### Tác vụ bất đồng bộ

```typescript
const task = (await visual.cvSubmitTask({ req_key: '...' })) as {
  code: number;
  data?: { task_id: string };
};

const output = await visual.cvGetResult({
  req_key: '...',
  task_id: task.data?.task_id,
});
// Nếu chưa xong, poll lại sau vài giây. Huỷ task: visual.cvCancelTask(...)
```

Các cặp `cvSync2AsyncSubmitTask`/`cvSync2AsyncGetResult` dùng cho luồng sync-to-async tương tự.

### API form (v2022-08-24)

```typescript
const comic = await visual.comicPortrait({ image_base64: '<ảnh base64>' });
const fused = await visual.portraitFusion({ /* ... */ });
```

### ⚠️ Quy ước lỗi riêng của Visual

Giữ nguyên hành vi bản Python: khi BytePlus trả lỗi có **body JSON** (vd `{"code": 50411, "message": "Pre Img Risk Not Pass"}`), method **trả về object lỗi đó chứ không throw**. Luôn kiểm tra `code` trong kết quả:

```typescript
const resp = (await visual.cvProcess(body)) as { code: number; message?: string };
if (resp.code !== 10000) {
  // xử lý lỗi nghiệp vụ từ BytePlus
}
```

Method chỉ throw khi response lỗi không phải JSON (vd lỗi mạng, HTML gateway).

## 5. Module SMS

```typescript
import { SmsService } from 'byteplus-sdk-nodejs';

// Region quyết định host (giống Python):
// - 'ap-singapore-1'  → sms.byteplusapi.com (BytePlus quốc tế)
// - mặc định 'cn-north-1' → sms.volcengineapi.com
const sms = new SmsService('ap-singapore-1');
```

### Gửi SMS

```typescript
const resp = await sms.sendSms({
  SmsAccount: '<sms_account>',   // message group ID trên console
  Sign: '<chữ_ký_thương_hiệu>',
  TemplateID: '<template_id>',
  TemplateParam: '{"code": "123456"}', // string JSON, không phải object
  PhoneNumbers: '84900000000',   // nhiều số cách nhau dấu phẩy
});
// resp = { ResponseMetadata: {...}, Result: { MessageID: [...] } }

// Gửi hàng loạt với nội dung khác nhau từng số:
await sms.sendBatchSms({ SmsAccount: '...', Sign: '...', TemplateID: '...', Messages: [/* ... */] });
```

### Mã xác thực (OTP)

```typescript
await sms.sendSmsVerifyCode({
  SmsAccount: '...', Sign: '...', TemplateID: '...',
  PhoneNumber: '84900000000', Scene: 'login',
  ExpireTime: 300, TryCount: 3, CodeType: 6,
});

const check = await sms.checkSmsVerifyCode({
  SmsAccount: '...', PhoneNumber: '84900000000',
  Scene: 'login', Code: '123456',
});
```

### Template và sub-account

```typescript
await sms.applySmsTemplate({ /* đăng ký template mới */ });
await sms.deleteSmsTemplate({ /* xoá template */ });
await sms.getSmsTemplateAndOrderList({ subAccount: '...', pageIndex: 1, pageSize: 10 });
await sms.getSubAccountList({ subAccountName: '', pageIndex: 1, pageSize: 10 });
await sms.getSubAccountDetail({ subAccount: '...' });
await sms.insertSmsSubAccount({ /* tạo sub-account */ });
await sms.conversion({ /* báo cáo conversion */ });
```

Lưu ý:

- Mỗi method **tự retry thêm 1 lần** khi lỗi (giữ nguyên `@retry(tries=2)` của Python) — lỗi bạn nhận được là lỗi của lần gọi thứ 2.
- `getSmsTemplateAndOrderList` gửi dữ liệu trong **body của request GET** (đúng contract server BytePlus, như bản Python) — SDK tự xử lý qua `node:http(s)`.
- Body rỗng → throw `Error('empty response')`; HTTP status khác 200 → throw body lỗi.

## 6. Module CDN

```typescript
import { CdnService } from 'byteplus-sdk-nodejs';

// Chỉ hỗ trợ ap-singapore-1 (host open.byteplusapi.com, service=CDN, https).
// Constructor không nhận region cũng mặc định về ap-singapore-1.
const cdn = new CdnService();
```

### Quản lý domain

```typescript
const domains = await cdn.listCdnDomains({ PageNum: 1, PageSize: 10 });
await cdn.addCdnDomain({
  Domain: 'cdn.example.com',
  ServiceType: 'download', // hoặc 'web', 'video'
  Origin: [{ OriginAction: { Action: 'deny' } }], // xem tài liệu BytePlus
});
await cdn.startCdnDomain({ Domain: 'cdn.example.com' });
await cdn.stopCdnDomain({ Domain: 'cdn.example.com' });
await cdn.deleteCdnDomain({ Domain: 'cdn.example.com' });
```

### Refresh / preload / block cache

```typescript
await cdn.submitRefreshTask({ Type: 'file', Urls: 'https://cdn.example.com/a.js' });
await cdn.submitPreloadTask({ Type: 'file', Urls: 'https://cdn.example.com/b.js' });
await cdn.submitBlockTask({ Type: 'file', Urls: 'https://cdn.example.com/malicious.js' });
await cdn.submitUnblockTask({ Type: 'file', Urls: 'https://cdn.example.com/malicious.js' });
```

### Thống kê và log

```typescript
const data = await cdn.describeCdnData({
  StartTime: 1700000000,
  EndTime: 1700003600,
  Metric: 'flux', // hoặc 'bandwidth', 'request', ...
});
const summary = await cdn.describeEdgeNrtDataSummary({ /* ... */ });
const log = await cdn.describeCdnAccessLog({ Domain: 'cdn.example.com', StartTime: '...', EndTime: '...' });
```

Lưu ý:

- CDN có **87 API**, tất cả là POST `/` với `Version=2021-03-01`.
- Danh sách đầy đủ trong `src/cdn/cdn-service.ts` — tên method chuyển sang camelCase (`describe_cdn_config` → `describeCdnConfig`).
- Body rỗng → throw `Error('${Action}: empty response')`; HTTP status khác 200 → throw body lỗi.

## 7. Module Ark

Ark được port từ [byteplus-python-sdk-v2](https://github.com/byteplus-sdk/byteplus-python-sdk-v2)
(bản v1 không có module này), gồm 2 phần với 2 cơ chế xác thực khác nhau:

| Thành phần | Xác thực | Dùng cho |
| --- | --- | --- |
| `ArkService` (management) | AK/SK + SignerV4 (`service=ark`) | Quản lý endpoint, model customization, batch inference, lấy API key |
| `ArkRuntimeClient` (inference) | `Authorization: Bearer <api_key hoặc STS token>` | chat completions, embeddings, sinh ảnh, sinh video |

### Management API

```typescript
import { ArkService } from 'byteplus-sdk-nodejs';

const ark = new ArkService(); // singleton, mặc định region ap-singapore-1

// Lấy API key ngắn hạn cho endpoint — dùng cho ArkRuntimeClient
const resp = await ark.getApiKey({
  DurationSeconds: 7 * 24 * 60 * 60,
  ResourceType: 'endpoint',
  ResourceIds: ['ep-xxx'],
});
```

Response giữ nguyên envelope của BytePlus:

```typescript
const error = resp.ResponseMetadata?.Error;
if (error !== undefined) throw new Error(JSON.stringify(error));
const apiKey = resp.Result?.ApiKey; // Bearer token cho runtime
```

11 action: `createBatchInferenceJob`, `createEndpoint`,
`createEvaluationJob`, `createModelCustomizationJob`, `deleteEndpoint`,
`getApiKey`, `getEndpoint`, `getEndpointCertificate`,
`getModelCustomizationJob`, `listBatchInferenceJobs`,
`listModelCustomizationJobs` — tất cả POST, `Version=2024-01-01`.

### Runtime — chat completions

```typescript
import { ArkRuntimeClient, ArkStream } from 'byteplus-sdk-nodejs';

// Mode 1: API key (env ARK_API_KEY hoặc options)
const client = new ArkRuntimeClient({ apiKey: '<API_KEY>' });

// Mode 2: AK/SK — SDK tự gọi GetApiKey đổi STS token và tự refresh
// (advisory 30 phút / mandatory 10 phút trước hạn, TTL 7 ngày).
// Chỉ hoạt động với model dạng endpoint `ep-...`.
// const client = new ArkRuntimeClient({ ak: '<AK>', sk: '<SK>' });

const completion = await client.createChatCompletion({
  model: 'ep-xxx',
  messages: [{ role: 'user', content: 'Xin chào!' }],
});

// Streaming SSE
const stream = (await client.createChatCompletion({
  model: 'ep-xxx',
  messages: [{ role: 'user', content: 'Xin chào!' }],
  stream: true,
})) as ArkStream;
for await (const chunk of stream) {
  // chunk.choices[0].delta.content — dừng tự động khi gặp [DONE]
}
```

### Runtime — embeddings, ảnh, video

```typescript
// Embeddings (hỗ trợ cả api_key lẫn AK/SK)
await client.createEmbeddings({ model: 'ep-xxx', input: ['xin chào'] });
await client.createMultimodalEmbeddings({
  model: 'ep-xxx',
  input: [{ type: 'text', text: 'xin chào' }],
});

// Sinh ảnh — BẮT BUỘC api_key (AK/SK bị từ chối, giống @apikey_required Python)
await client.generateImages({ model: 'ep-img', prompt: 'a cat', size: '1024x1024' });

// Sinh video (content generation task) — BẮT BUỘC api_key
const task = await client.createContentGenerationTask({
  model: 'ep-video',
  content: [{ type: 'text', text: 'A cat playing piano --ratio 16:9' }],
});
const status = await client.getContentGenerationTask('<task_id>');
await client.listContentGenerationTasks({ status: 'succeeded', pageSize: 10 });
await client.deleteContentGenerationTask('<task_id>');
```

Xem sample chạy được: [`examples/ark-get-api-key.ts`](../examples/ark-get-api-key.ts),
[`examples/ark-chat-completions.ts`](../examples/ark-chat-completions.ts),
[`examples/ark-content-generation-video.ts`](../examples/ark-content-generation-video.ts).

Lưu ý:

- Base URL mặc định `https://ark.ap-southeast.bytepluses.com/api/v3`
  (đổi qua `options.baseUrl`).
- Retry tự động tối đa 2 lần với lỗi mạng/408/409/429/5xx
  (`options.maxRetries`), timeout mặc định 600 giây (`options.timeoutMs`).
- Model `ep-m-...` (preset endpoint) chưa dùng được với AK/SK — throw
  lỗi thiếu `project_name` giống Python.
- E2E encryption (ECDH) chưa hỗ trợ.

## 8. STS2 token

Cấp credential tạm thời (ví dụ cho client mobile gọi VOD):

```typescript
import { Policy, Statement, Const } from 'byteplus-sdk-nodejs';

const policy = new Policy([
  Statement.newAllowStatement(
    [Const.ACTION_VOD_GET_PLAY_INFO],
    ['trn:vod::*:video_id/abc'],
  ),
]);

const sts = service.signSts2(policy, 3600); // tối thiểu 60 giây
// sts.accessKeyId, sts.secretAccessKey, sts.sessionToken,
// sts.currentTime, sts.expiredTime
```

Truyền `null` thay cho policy nếu không giới hạn quyền.

## 9. Gọi API BytePlus bất kỳ bằng lõi SDK

Với service chưa có module riêng (Live, VOD — xem roadmap), dùng trực tiếp `Service` + `ApiInfo`:

```typescript
import { ApiInfo, Credentials, Service, ServiceInfo } from 'byteplus-sdk-nodejs';

const service = new Service(
  new ServiceInfo(
    'open.byteplusapi.com',
    { Accept: 'application/json' },
    new Credentials('', '', '<tên_service>', 'ap-singapore-1'),
    5, 5, 'https',
  ),
  {
    MyAction: new ApiInfo('GET', '/', { Action: 'MyAction', Version: '<version>' }, {}, {}),
    MyPostAction: new ApiInfo('POST', '/', { Action: 'MyPostAction', Version: '<version>' }, {}, {}),
  },
);

const text = await service.get('MyAction', { Limit: 10 });   // GET, trả string
const json = await service.json('MyPostAction', {}, { Key: 'value' }); // POST JSON
const form = await service.post('MyPostAction', {}, { field: 'x' });   // POST form
const signedQuery = service.getSignUrl('MyAction', {});      // URL đã ký, không gửi request
const [ok, body] = await service.putData('<url>', buffer, headers);   // upload PUT
```

Tiện ích mã hoá đi kèm (`Util`): `sha256`, `hmacSha256`, `hmacSha1`, `crc32`, `crc32File`, `aesEncryptCbcWithBase64`, `normQuery`, `pyJsonDumps`…

## 10. Xử lý lỗi

| Tình huống | Hành vi |
| --- | --- |
| HTTP status khác 200 (`Service.get/post/json`) | Throw `Error` với message là body response |
| Visual: lỗi có body JSON | **Return** object lỗi (xem mục 4) |
| IAM/SMS/CDN: body rỗng | Throw `Error('empty response')` hoặc `Error('${Action}: empty response')` |
| SMS: mọi lỗi | Retry thêm 1 lần trước khi throw (xem mục 5) |
| Timeout (connection + socket, tính bằng giây) | Throw `TimeoutError` từ `AbortSignal.timeout` |
| Gọi API không khai báo trong `apiInfo` | Throw `Error('no such api')` |

Message lỗi từ BytePlus thường là JSON — parse để lấy `ResponseMetadata.Error`:

```typescript
try {
  await iam.listUsers({});
} catch (e) {
  const detail = JSON.parse((e as Error).message);
  // detail.ResponseMetadata.Error.Code / .Message
}
```

## 11. Khác biệt so với bản Python

Hành vi ký/mã hoá giữ nguyên 100% (kiểm chứng bằng test vector đối chiếu từng byte). Khác biệt:

| Python | Node.js | Lý do |
| --- | --- | --- |
| `requests` | `fetch` built-in; timeout tổng = connection + socket | Node 18+ có sẵn, zero dependency |
| `ServiceInfoHttps` | `ServiceInfo(..., scheme: 'https')` | Class Python chỉ khác scheme mặc định |
| `requests.get(url, json=body)` | `service.json()` với GET + body đi qua `node:http(s)`, wire format giữ nguyên | `fetch` cấm GET có body |
| `snake_case` (`list_users`) | `camelCase` (`listUsers`) | Chuẩn JS/TS |
| Trả `dict` | Trả `unknown` — tự cast theo API | An toàn kiểu ở phía người dùng |

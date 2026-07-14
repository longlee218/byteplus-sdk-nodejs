# Hướng dẫn tích hợp BytePlus SDK Node.js

Tài liệu này hướng dẫn tích hợp SDK vào dự án Node.js/TypeScript. SDK được port từ [byteplus-sdk-python](https://github.com/byteplus-sdk/byteplus-sdk-python) (nhánh `master`) và giữ nguyên hành vi ký request, mã hoá của bản gốc.

## Mục lục

1. [Yêu cầu và cài đặt](#1-yêu-cầu-và-cài-đặt)
2. [Cấu hình credential](#2-cấu-hình-credential)
3. [Module IAM](#3-module-iam)
4. [Module Visual](#4-module-visual)
5. [STS2 token](#5-sts2-token)
6. [Gọi API BytePlus bất kỳ bằng lõi SDK](#6-gọi-api-byteplus-bất-kỳ-bằng-lõi-sdk)
7. [Xử lý lỗi](#7-xử-lý-lỗi)
8. [Khác biệt so với bản Python](#8-khác-biệt-so-với-bản-python)

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

## 5. STS2 token

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

## 6. Gọi API BytePlus bất kỳ bằng lõi SDK

Với service chưa có module riêng (SMS, CDN, Live, VOD — xem roadmap), dùng trực tiếp `Service` + `ApiInfo`:

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

## 7. Xử lý lỗi

| Tình huống | Hành vi |
| --- | --- |
| HTTP status khác 200 (`Service.get/post/json`) | Throw `Error` với message là body response |
| Visual: lỗi có body JSON | **Return** object lỗi (xem mục 4) |
| IAM: body rỗng | Throw `Error('empty response')` |
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

## 8. Khác biệt so với bản Python

Hành vi ký/mã hoá giữ nguyên 100% (kiểm chứng bằng test vector đối chiếu từng byte). Khác biệt:

| Python | Node.js | Lý do |
| --- | --- | --- |
| `requests` | `fetch` built-in; timeout tổng = connection + socket | Node 18+ có sẵn, zero dependency |
| `ServiceInfoHttps` | `ServiceInfo(..., scheme: 'https')` | Class Python chỉ khác scheme mặc định |
| `service.json()` với GET + body | Throw lỗi rõ ràng | `fetch` cấm GET có body |
| `snake_case` (`list_users`) | `camelCase` (`listUsers`) | Chuẩn JS/TS |
| Trả `dict` | Trả `unknown` — tự cast theo API | An toàn kiểu ở phía người dùng |

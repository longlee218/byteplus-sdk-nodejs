// Sample: quản lý CDN domain và cache task qua CdnService
// Chạy: BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> npx tsx examples/cdn-usage.ts
import { CdnService } from '../src';

interface CdnResponse {
  ResponseMetadata: { Error?: { Code: string; Message: string } };
  Result?: { Data?: unknown[] };
}

async function main(): Promise<void> {
  // CDN chỉ hỗ trợ ap-singapore-1 (mặc định).
  const cdn = new CdnService();
  // AK/SK tự nạp từ env hoặc ~/.byteplus/config

  // ----- Liệt kê domain CDN -----
  const list = (await cdn.listCdnDomains({})) as CdnResponse;
  if (list.ResponseMetadata.Error !== undefined) {
    throw new Error(
      `BytePlus trả lỗi ${list.ResponseMetadata.Error.Code}: ${list.ResponseMetadata.Error.Message}`,
    );
  }
  console.log('Domains:', list.Result?.Data);

  // ----- Tạo refresh cache task -----
  const refresh = (await cdn.submitRefreshTask({
    Type: 'file',
    Urls: 'https://example.com/static/app.js',
  })) as CdnResponse;
  console.log('Refresh task:', refresh.Result);

  // ----- Lấy quota refresh/preload còn lại -----
  const quota = (await cdn.describeContentQuota({})) as CdnResponse;
  console.log('Quota:', quota.Result);
}

main().catch((e) => {
  console.error('Lỗi:', (e as Error).message);
  process.exitCode = 1;
});

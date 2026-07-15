// Sample: lấy API key ngắn hạn cho endpoint Ark — port từ
// byteplussdkark GetApiKey (byteplus-python-sdk-v2).
// Chạy: BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> npx tsx examples/ark-get-api-key.ts
import { ArkService } from '../src';

interface GetApiKeyEnvelope {
  ResponseMetadata?: { Error?: { Code?: string; Message?: string } };
  Result?: { ApiKey?: string; ExpiredTime?: number };
}

async function main(): Promise<void> {
  const arkService = new ArkService();

  const resp = (await arkService.getApiKey({
    DurationSeconds: 7 * 24 * 60 * 60,
    ResourceType: 'endpoint',
    ResourceIds: ['<YOUR_ENDPOINT_ID>'],
  })) as GetApiKeyEnvelope;

  if (resp.ResponseMetadata?.Error !== undefined) {
    throw new Error(JSON.stringify(resp.ResponseMetadata.Error));
  }
  console.log('ApiKey:', resp.Result?.ApiKey);
  console.log(
    'ExpiredTime:',
    new Date((resp.Result?.ExpiredTime ?? 0) * 1000).toISOString(),
  );
}

main().catch((e) => {
  console.error('Lỗi:', (e as Error).message);
  process.exitCode = 1;
});

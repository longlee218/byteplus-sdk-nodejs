// Sample: private trusted asset library (virtual portrait) cho Seedance 2.0 —
// port từ tutorial "Upload assets to the virtual portrait library" +
// "Generate video using portrait assets" (docs.byteplus.com/en/docs/ModelArk).
// Bước 1-3 dùng ArkService (AK/SK, management API); bước 4 dùng
// ArkRuntimeClient (API key, content generation) tham chiếu asset qua asset://.
//
// Chạy:
//   BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> ARK_API_KEY=<API_KEY> \
//     npx tsx examples/ark-upload-asset-and-generate-video.ts
//
// Chỉ muốn kiểm tra phần asset (bỏ qua sinh video, không cần ARK_API_KEY):
//   BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> SKIP_VIDEO_GEN=1 \
//     npx tsx examples/ark-upload-asset-and-generate-video.ts
import { ArkRuntimeClient, ArkService } from '../src';

const MODEL = '<YOUR_VIDEO_ENDPOINT_ID>';
const IMAGE_URL = 'https://dev-static.apero.vn/content/uploads/teal_53af4a1091.jpeg';

interface ArkEnvelope<T> {
  ResponseMetadata?: { Error?: { Code?: string; Message?: string } };
  Result?: T;
}

function unwrap<T>(resp: ArkEnvelope<T>): T {
  if (resp.ResponseMetadata?.Error !== undefined) {
    throw new Error(JSON.stringify(resp.ResponseMetadata.Error));
  }
  if (resp.Result === undefined) {
    throw new Error('empty Result in response');
  }
  return resp.Result;
}

interface TaskStatus {
  id?: string;
  status?: string;
  content?: { video_url?: string };
  error?: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Poll GetAsset đến khi Status thành Active mới được dùng cho inference;
// Failed thì báo lỗi ngay, tránh chờ vô hạn.
async function waitForAssetActive(
  ark: ArkService,
  assetId: string,
): Promise<void> {
  for (;;) {
    const asset = unwrap(
      (await ark.getAsset({
        Id: assetId,
        ProjectName: 'default',
      })) as ArkEnvelope<{ Status?: string; URL?: string }>,
    );
    console.log('asset status:', asset.Status);
    if (asset.Status === 'Active') return;
    if (asset.Status === 'Failed') {
      throw new Error(`asset ${assetId} preprocessing failed`);
    }
    await sleep(5_000);
  }
}

async function main(): Promise<void> {
  const ark = new ArkService();

  const group = unwrap(
    (await ark.createAssetGroup({
      Name: 'demo-group',
      Description: 'Demo asset group',
      ProjectName: 'default',
    })) as ArkEnvelope<{ Id?: string }>,
  );
  console.log('GroupId:', group.Id);

  const asset = unwrap(
    (await ark.createAsset({
      GroupId: group.Id,
      URL: IMAGE_URL,
      AssetType: 'Image',
      ProjectName: 'default',
    })) as ArkEnvelope<{ Id?: string }>,
  );
  console.log('AssetId:', asset.Id);

  await waitForAssetActive(ark, asset.Id ?? '');

  if (process.env['SKIP_VIDEO_GEN'] === '1') {
    console.log('SKIP_VIDEO_GEN=1 — bỏ qua bước sinh video, dừng ở đây.');
    return;
  }

  const client = new ArkRuntimeClient();
  const created = (await client.createContentGenerationTask({
    model: MODEL,
    content: [
      { type: 'text', text: 'The person in Image 1 waves at the camera.' },
      {
        type: 'image_url',
        role: 'reference_image',
        image_url: { url: `asset://${asset.Id}` },
      },
    ],
  })) as TaskStatus;
  console.log('Task đã tạo:', created.id);

  for (;;) {
    const task = (await client.getContentGenerationTask(
      created.id ?? '',
    )) as TaskStatus;
    console.log('Trạng thái:', task.status);
    if (task.status === 'succeeded') {
      console.log('Video URL:', task.content?.video_url);
      return;
    }
    if (task.status === 'failed' || task.status === 'cancelled') {
      throw new Error(`Task ${task.status}: ${JSON.stringify(task.error)}`);
    }
    await sleep(5_000);
  }
}

main().catch((e) => {
  console.error('Lỗi:', (e as Error).message);
  process.exitCode = 1;
});

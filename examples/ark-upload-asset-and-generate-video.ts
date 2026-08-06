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
//
// Đã có asset Active rồi, chỉ muốn thử lại bước sinh video (không tốn quota
// tạo lại asset — hữu ích để kiểm tra xem có phải do độ trễ lan truyền sau
// khi Active hay không, hoặc để thử lại nhanh sau khi đổi ARK_API_KEY):
//   BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> ARK_API_KEY=<API_KEY> \
//     ASSET_ID=asset-xxxx npx tsx examples/ark-upload-asset-and-generate-video.ts
import { ArkRuntimeClient, ArkService } from "../src";

const MODEL = "dreamina-seedance-2-0-260128";
const IMAGE_URL =
  "https://dev-static.apero.vn/content/uploads/Screenshot_2026_08_05_at_16_58_55_fd407bf3be.png";
// Assets are isolated per BytePlus Project — CreateAsset/GetAsset must use
// the SAME ProjectName as whatever project ARK_API_KEY was issued under,
// or content generation throws "asset ... is not found" even though the
// asset is genuinely Active. Override to test different project names
// without editing this file each time.
const PROJECT_NAME = process.env["PROJECT_NAME"] || "default";
// Docs ModelArk ký AK/SK bằng ap-southeast-1 (mọi sample Go trong tutorial
// dùng WithRegion("ap-southeast-1")). Default của SDK là ap-singapore-1
// (REGION_AP_SINGAPORE1, port từ Python v1) — đổi qua ARK_REGION nếu ký sai
// region báo lỗi signature.
const REGION = process.env["ARK_REGION"] || "ap-southeast-1";
const DEMO_GROUP_NAME = process.env["GROUP_NAME"] || "demo-group";
// GetAsset báo Active nghĩa là preprocessing xong, KHÔNG đảm bảo runtime
// (ArkRuntimeClient/ARK_API_KEY) đã đồng bộ xong asset đó — BytePlus không
// cam kết SLA cho bước này. Khi sinh video gặp đúng lỗi "asset ... is not
// found" thì thử lại có giới hạn thay vì coi là lỗi vĩnh viễn ngay lập tức.
const VIDEO_GEN_ASSET_SYNC_RETRIES = 10;
const VIDEO_GEN_ASSET_SYNC_RETRY_DELAY_MS = 60_000;

interface ArkEnvelope<T> {
  ResponseMetadata?: { Error?: { Code?: string; Message?: string } };
  Result?: T;
}

function unwrap<T>(resp: ArkEnvelope<T>): T {
  if (resp.ResponseMetadata?.Error !== undefined) {
    throw new Error(JSON.stringify(resp.ResponseMetadata.Error));
  }
  if (resp.Result === undefined) {
    throw new Error("empty Result in response");
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

// Chỉ khớp đúng lỗi "asset <id> is not found" (InvalidParameter) — lỗi
// khác (sai model, quota, v.v.) phải throw ngay, không được nuốt.
function isAssetNotYetSynced(e: unknown, assetId: string): boolean {
  if (!(e instanceof Error)) return false;
  try {
    const parsed = JSON.parse(e.message) as {
      error?: { code?: string; message?: string };
    };
    return (
      parsed.error?.code === "InvalidParameter" &&
      typeof parsed.error.message === "string" &&
      parsed.error.message.includes(`asset ${assetId} is not found`)
    );
  } catch {
    return false;
  }
}

// Tìm lại group theo tên trước khi tạo. Bản trước gọi createAssetGroup vô
// điều kiện nên mỗi lần chạy example lại sinh thêm một group "demo-group"
// trùng tên (đã thấy 3 bản trùng trong project Reelme), ăn dần quota dùng
// chung giữa virtual portrait và real-human library.
//
// Filter.Name là fuzzy nên phải so khớp chính xác ở client; GroupType bắt
// buộc, thiếu nó BytePlus trả MissingParameter.Filter.GroupType.
async function getOrCreateDemoGroup(ark: ArkService): Promise<string> {
  const listed = unwrap(
    (await ark.listAssetGroups({
      Filter: { Name: DEMO_GROUP_NAME, GroupType: "AIGC" },
      ProjectName: PROJECT_NAME,
      PageNumber: 1,
      PageSize: 100,
    })) as ArkEnvelope<{ Items?: Array<{ Id?: string; Name?: string }> }>,
  );
  const existing = listed.Items?.find((g) => g.Name === DEMO_GROUP_NAME);
  if (existing?.Id !== undefined) {
    console.log("dùng lại group có sẵn:", existing.Id);
    return existing.Id;
  }

  const created = unwrap(
    (await ark.createAssetGroup({
      Name: DEMO_GROUP_NAME,
      Description: "Demo asset group",
      ProjectName: PROJECT_NAME,
    })) as ArkEnvelope<{ Id?: string }>,
  );
  if (created.Id === undefined) {
    throw new Error("thiếu Id trong response CreateAssetGroup");
  }
  return created.Id;
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
        ProjectName: PROJECT_NAME,
      })) as ArkEnvelope<{ Status?: string; URL?: string }>,
    );
    console.log("asset status:", asset.Status);
    if (asset.Status === "Active") return;
    if (asset.Status === "Failed") {
      throw new Error(`asset ${assetId} preprocessing failed`);
    }
    await sleep(5_000);
  }
}

async function generateVideo(assetId: string): Promise<void> {
  const client = new ArkRuntimeClient({ region: REGION });

  let created: TaskStatus | undefined;
  for (let attempt = 1; ; attempt += 1) {
    try {
      created = (await client.createContentGenerationTask({
        model: MODEL,
        content: [
          { type: "text", text: "The person in Image 1 waves at the camera." },
          {
            type: "image_url",
            role: "reference_image",
            image_url: { url: `asset://${assetId}` },
          },
        ],
      })) as TaskStatus;
      break;
    } catch (e) {
      if (
        !isAssetNotYetSynced(e, assetId) ||
        attempt >= VIDEO_GEN_ASSET_SYNC_RETRIES
      ) {
        throw e;
      }
      console.log(
        `lần ${attempt}/${VIDEO_GEN_ASSET_SYNC_RETRIES}: asset chưa đồng bộ sang runtime, chờ ${VIDEO_GEN_ASSET_SYNC_RETRY_DELAY_MS / 1000}s rồi thử lại...`,
      );
      await sleep(VIDEO_GEN_ASSET_SYNC_RETRY_DELAY_MS);
    }
  }
  console.log("Task đã tạo:", created.id);

  for (;;) {
    const task = (await client.getContentGenerationTask(
      created.id ?? "",
    )) as TaskStatus;
    console.log("Trạng thái:", task.status);
    if (task.status === "succeeded") {
      console.log("Video URL:", task.content?.video_url);
      return;
    }
    if (task.status === "failed" || task.status === "cancelled") {
      throw new Error(`Task ${task.status}: ${JSON.stringify(task.error)}`);
    }
    await sleep(5_000);
  }
}

async function main(): Promise<void> {
  console.log("ProjectName:", PROJECT_NAME);

  const existingAssetId = process.env["ASSET_ID"];
  if (existingAssetId) {
    console.log(
      "ASSET_ID set — bỏ qua tạo group/asset, dùng lại:",
      existingAssetId,
    );
    await generateVideo(existingAssetId);
    return;
  }

  const ark = new ArkService(REGION);

  const groupId = await getOrCreateDemoGroup(ark);
  console.log("GroupId:", groupId);

  const asset = unwrap(
    (await ark.createAsset({
      GroupId: groupId,
      URL: IMAGE_URL,
      AssetType: "Image",
      ProjectName: PROJECT_NAME,
    })) as ArkEnvelope<{ Id?: string }>,
  );
  console.log("AssetId:", asset.Id);

  await waitForAssetActive(ark, asset.Id ?? "");

  if (process.env["SKIP_VIDEO_GEN"] === "1") {
    console.log("SKIP_VIDEO_GEN=1 — bỏ qua bước sinh video, dừng ở đây.");
    return;
  }

  await generateVideo(asset.Id ?? "");
}

main().catch((e) => {
  console.error("Lỗi:", (e as Error).message);
  process.exitCode = 1;
});

// Sample: private trusted asset library (real-human portrait) cho Seedance 2.0
// — port từ tutorial "Private real-human asset library guide"
// (docs.byteplus.com/en/docs/ModelArk). Khác virtual portrait library ở chỗ
// asset group KHÔNG tạo bằng CreateAssetGroup: nó sinh ra từ phiên xác thực
// người thật (CreateVisualValidateSession -> H5 -> GetVisualValidateResult),
// nhờ vậy quyền hình ảnh được chốt ngay từ đầu. Các bước upload/quản lý asset
// và sinh video thì dùng chung với virtual portrait.
//
// Chạy (phải mở H5Link trên browser để xác thực người thật):
//   BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> ARK_API_KEY=<API_KEY> \
//     REAL_PERSON_IMAGE_URL=<ẢNH_CỦA_CHÍNH_NGƯỜI_ĐÃ_XÁC_THỰC> \
//     npx tsx examples/ark-real-human-asset-and-generate-video.ts
//
// Đã xác thực người thật rồi, dùng lại group cũ (end user chỉ cần xác thực
// một lần; các asset sau của cùng người upload vào cùng group):
//   ... GROUP_ID=group-xxxx REAL_PERSON_IMAGE_URL=<IMAGE_URL> npx tsx ...
//
// Đã có asset Active, chỉ muốn thử lại bước sinh video:
//   ... ASSET_ID=asset-xxxx npx tsx ...
import { createInterface } from "node:readline/promises";

import { ArkRuntimeClient, ArkService } from "../src";

const MODEL = "dreamina-seedance-2-0-260128";
// Real-human asset phải là ảnh của đúng người đã hoàn tất xác thực: hệ thống
// so khớp khuôn mặt với ảnh tham chiếu thu lúc xác thực, nên không có ảnh
// mặc định nào dùng được ở đây (khác example virtual portrait).
const REAL_PERSON_IMAGE_URL = process.env["REAL_PERSON_IMAGE_URL"];
// Sau khi xác thực xong, H5 mở CallbackURL kèm resultCode/bytedToken. Example
// không chạy callback server — BytedToken lấy trực tiếp từ response của
// CreateVisualValidateSession — nên URL này chỉ để điền cho đủ tham số.
const CALLBACK_URL =
  process.env["CALLBACK_URL"] || "https://www.example.com/callback";
// Assets bị cô lập theo BytePlus Project — CreateAsset/GetAsset phải cùng
// ProjectName với project đã phát hành ARK_API_KEY, nếu không sinh video sẽ
// báo "asset ... is not found" dù asset thật sự Active.
const PROJECT_NAME = process.env["PROJECT_NAME"] || "default";
// GroupType của asset group người thật, dùng để phân biệt với virtual portrait
// khi query ListAssets/ListAssetGroups (hai library dùng chung API).
const GROUP_TYPE_REAL_HUMAN = "LivenessFace";

// GetVisualValidateResult chỉ trả GroupId sau khi end user bấm Complete trên
// H5. BytePlus không mô tả response lúc phiên còn dở, nên không thể phân biệt
// "chưa xong" với "thất bại" => chờ user xác nhận rồi mới gọi, và chỉ retry
// ngắn để hấp thụ độ trễ lan truyền. BytedToken sống 30 phút, giới hạn 3 QPS.
const RESULT_RETRIES = 8;
const RESULT_RETRY_DELAY_MS = 15_000;

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

async function prompt(question: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await rl.question(question);
  } finally {
    rl.close();
  }
}

// Bước 1: mở phiên xác thực, chờ end user hoàn tất H5, rồi đổi BytedToken
// thành GroupId của asset group vừa tạo cho người đó.
async function verifyRealPerson(ark: ArkService): Promise<string> {
  const session = unwrap(
    (await ark.createVisualValidateSession({
      CallbackURL: CALLBACK_URL,
      ProjectName: PROJECT_NAME,
    })) as ArkEnvelope<{ H5Link?: string; BytedToken?: string }>,
  );
  const bytedToken = session.BytedToken;
  if (bytedToken === undefined) {
    throw new Error("thiếu BytedToken trong response CreateVisualValidateSession");
  }
  const h5Link = session.H5Link;
  if (h5Link === undefined) {
    throw new Error("thiếu H5Link trong response CreateVisualValidateSession");
  }

  // Link mặc định tiếng Trung giản thể; lng nhận zh | en | zh-Hant.
  console.log("Mở link này trên browser để xác thực người thật:");
  console.log(`${h5Link}&lng=en`);

  // rl.question không bao giờ resolve khi stdin không phải TTY (pipe, CI),
  // nên tiến trình treo rồi thoát mã 0 — trông như thành công dù chưa xác
  // thực gì. Đây là điều kiện tiên quyết thật sự, chặn sớm thay vì để im lặng.
  if (process.stdin.isTTY !== true) {
    throw new Error(
      "cần TTY để xác nhận bước H5 — hoặc truyền GROUP_ID để bỏ qua xác thực",
    );
  }
  await prompt("Bấm Enter sau khi đã hoàn tất xác thực trên H5...");

  let lastError = "";
  for (let attempt = 1; attempt <= RESULT_RETRIES; attempt += 1) {
    try {
      const result = unwrap(
        (await ark.getVisualValidateResult({
          BytedToken: bytedToken,
          ProjectName: PROJECT_NAME,
        })) as ArkEnvelope<{ GroupId?: string }>,
      );
      if (result.GroupId !== undefined) return result.GroupId;
      lastError = "response không có GroupId";
    } catch (e) {
      lastError = (e as Error).message;
    }
    console.log(
      `lần ${attempt}/${RESULT_RETRIES} chưa lấy được GroupId: ${lastError}`,
    );
    if (attempt < RESULT_RETRIES) await sleep(RESULT_RETRY_DELAY_MS);
  }
  throw new Error(
    `không lấy được GroupId sau ${RESULT_RETRIES} lần: ${lastError}`,
  );
}

// Poll GetAsset đến khi Status thành Active mới được dùng cho inference.
// Với real-human asset, Failed là đường thất bại bình thường (không phải bug):
// ảnh không phải cùng người với ảnh tham chiếu lúc xác thực, hoặc ảnh có nhiều
// mặt, thì asset không được vào library.
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
      throw new Error(
        `asset ${assetId} preprocessing failed — kiểm tra ảnh có đúng người đã xác thực và chỉ có một mặt`,
      );
    }
    await sleep(5_000);
  }
}

// Prompt phải gọi asset theo thứ tự "Image N" trong request body, không dùng
// Asset ID trực tiếp.
async function generateVideo(assetId: string): Promise<void> {
  const client = new ArkRuntimeClient();
  const created = (await client.createContentGenerationTask({
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
  if (existingAssetId !== undefined && existingAssetId !== "") {
    console.log(
      "ASSET_ID set — bỏ qua xác thực và upload, dùng lại:",
      existingAssetId,
    );
    await generateVideo(existingAssetId);
    return;
  }

  if (REAL_PERSON_IMAGE_URL === undefined || REAL_PERSON_IMAGE_URL === "") {
    throw new Error(
      "cần REAL_PERSON_IMAGE_URL — ảnh của đúng người sẽ xác thực (không có giá trị mặc định)",
    );
  }

  const ark = new ArkService();

  // End user chỉ phải xác thực một lần; lần sau truyền GROUP_ID để upload thêm
  // ảnh của cùng người vào cùng group.
  const envGroupId = process.env["GROUP_ID"];
  const groupId =
    envGroupId !== undefined && envGroupId !== ""
      ? envGroupId
      : await verifyRealPerson(ark);
  console.log("GroupId:", groupId);

  const asset = unwrap(
    (await ark.createAsset({
      GroupId: groupId,
      URL: REAL_PERSON_IMAGE_URL,
      AssetType: "Image",
      ProjectName: PROJECT_NAME,
    })) as ArkEnvelope<{ Id?: string }>,
  );
  const assetId = asset.Id;
  if (assetId === undefined) {
    throw new Error("thiếu Id trong response CreateAsset");
  }
  console.log("AssetId:", assetId);

  await waitForAssetActive(ark, assetId);

  // Query lại theo GroupType để thấy asset người thật tách khỏi virtual portrait.
  const listed = unwrap(
    (await ark.listAssets({
      Filter: {
        GroupIds: [groupId],
        GroupType: GROUP_TYPE_REAL_HUMAN,
        Statuses: ["Active"],
      },
      ProjectName: PROJECT_NAME,
      PageNumber: 1,
      PageSize: 10,
    })) as ArkEnvelope<{ TotalCount?: number }>,
  );
  console.log("Số asset Active trong group:", listed.TotalCount);

  if (process.env["SKIP_VIDEO_GEN"] === "1") {
    console.log("SKIP_VIDEO_GEN=1 — bỏ qua bước sinh video, dừng ở đây.");
    return;
  }

  await generateVideo(assetId);
}

main().catch((e) => {
  console.error("Lỗi:", (e as Error).message);
  process.exitCode = 1;
});

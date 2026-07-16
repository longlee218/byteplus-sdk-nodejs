// Sample: gọi Visual CVProcess (đồng bộ) và luồng submit/get-result (bất đồng bộ)
// Chạy: BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> npx tsx examples/visual-cv-process.ts
import { readFileSync } from "node:fs";

import { VisualService } from "../src";

interface CvResponse {
  code: number;
  message?: string;
  data?: { task_id?: string; resp_data?: string; status?: string };
  status: number;
  request_id: string;
  time_elapsed: string;
}

async function main(): Promise<void> {
  const visual = new VisualService(); // tự nạp AK/SK từ env hoặc ~/.byteplus/config

  const imageBase64 = readFileSync("/đường/dẫn/ảnh.jpg").toString("base64");

  // ----- Bất đồng bộ (submit rồi poll kết quả) -----
  const submit = (await visual.cvSync2AsyncSubmitTask({
    req_key: "dreamactor_m20_gen_video_cvtob",
    binary_data_base64: [imageBase64],
    video_url: "<url_video_mẫu>",
  })) as CvResponse;

  if (submit.code !== 10000 || submit.data?.task_id === undefined) {
    throw new Error(`Submit thất bại ${submit.code}: ${submit.message}`);
  }
  const taskId = submit.data.task_id;

  let output: CvResponse;
  do {
    await new Promise((r) => setTimeout(r, 3000));
    output = (await visual.cvSync2AsyncGetResult({
      req_key: "dreamactor_m20_gen_video_cvtob",
      task_id: taskId,
    })) as CvResponse;
  } while (output.code === 10000);

  console.log("Kết quả task:", output.code);
}

main().catch((e) => {
  console.error("Lỗi:", (e as Error).message);
  process.exitCode = 1;
});

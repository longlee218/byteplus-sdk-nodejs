// Sample: gọi Visual CVProcess (đồng bộ) và luồng submit/get-result (bất đồng bộ)
// Chạy: BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> npx tsx examples/visual-cv-process.ts
import { readFileSync } from "node:fs";

import { VisualService } from "../src";

interface CvResponse {
  code: number;
  message?: string;
  data?: { resp_data: string; status: string };
  status: number;
  request_id: string;
  time_elapsed: string;
}

async function main(): Promise<void> {
  const visual = new VisualService(); // tự nạp AK/SK từ env hoặc ~/.byteplus/config

  const imageBase64 = readFileSync("/đường/dẫn/ảnh.jpg").toString("base64");

  // ----- Bất đồng bộ (submit rồi poll kết quả) -----
  const taskId = "task_" + new Date().getTime();
  const task = (await visual.cvSync2AsyncGetResult({
    req_key: "dreamactor_m20_gen_video_cvtob",
    binary_data_base64: [imageBase64],
    video_url:
      "https://sf16-resources.bytepluscdn.com/obj/byteplus-public-aiso/cloud-universal-doc/upload_1245a943232e4a7801f3e4dfba953ba5.mp4",
    task_id: taskId,
  })) as CvResponse;

  if (task.code !== 10000) {
    throw new Error(`Submit thất bại ${task.code}: ${task.message}`);
  }

  let output: CvResponse;
  do {
    await new Promise((r) => setTimeout(r, 3000));
    output = (await visual.cvGetResult({
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

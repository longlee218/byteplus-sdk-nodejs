// Sample: gọi Visual CVProcess (đồng bộ) và luồng submit/get-result (bất đồng bộ)
// Chạy: BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> npx tsx examples/visual-cv-process.ts
import { readFileSync } from 'node:fs';

import { VisualService } from '../src';

interface CvResponse {
  code: number;
  message?: string;
  data?: { task_id?: string; binary_data_base64?: string[] };
}

async function main(): Promise<void> {
  const visual = new VisualService(); // tự nạp AK/SK từ env hoặc ~/.byteplus/config

  const imageBase64 = readFileSync('/đường/dẫn/ảnh.jpg').toString('base64');

  // ----- Cách 1: API đồng bộ -----
  const result = (await visual.cvProcess({
    req_key: '<tên_model_theo_tài_liệu_BytePlus>',
    binary_data_base64: [imageBase64],
  })) as CvResponse;

  // Visual trả lỗi nghiệp vụ dưới dạng object (không throw) — kiểm tra code
  if (result.code !== 10000) {
    throw new Error(`BytePlus trả lỗi ${result.code}: ${result.message}`);
  }
  console.log('Số ảnh kết quả:', result.data?.binary_data_base64?.length);

  // ----- Cách 2: bất đồng bộ (submit rồi poll kết quả) -----
  const task = (await visual.cvSubmitTask({
    req_key: '<tên_model>',
    binary_data_base64: [imageBase64],
  })) as CvResponse;
  if (task.code !== 10000 || task.data?.task_id === undefined) {
    throw new Error(`Submit thất bại ${task.code}: ${task.message}`);
  }

  let output: CvResponse;
  do {
    await new Promise((r) => setTimeout(r, 3000));
    output = (await visual.cvGetResult({
      req_key: '<tên_model>',
      task_id: task.data.task_id,
    })) as CvResponse;
  } while (output.code === 10000 && output.data?.binary_data_base64 === undefined);

  console.log('Kết quả task:', output.code);
}

main().catch((e) => {
  console.error('Lỗi:', (e as Error).message);
  process.exitCode = 1;
});

// Sample: liệt kê user IAM — port từ example/iam/example_list_users.py
// Chạy: BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> npx tsx examples/iam-list-users.ts
import { IamService } from '../src';

async function main(): Promise<void> {
  const iamService = new IamService(); // tự nạp AK/SK từ env hoặc ~/.byteplus/config
  iamService.setScheme('https');

  // Bỏ comment nếu muốn set trực tiếp thay vì env/config:
  // iamService.setAk('<AK>');
  // iamService.setSk('<SK>');

  const resp = await iamService.listUsers({ Limit: 5, Offset: 0 });
  console.log(JSON.stringify(resp, null, 2));
}

main().catch((e) => {
  console.error('Lỗi:', (e as Error).message);
  process.exitCode = 1;
});

// Sample: tạo video bằng Ark content generation — port từ
// byteplussdkexamples/byteplussdkarkruntime/content_generation_tasks.py.
// Bắt buộc API key (AK/SK không được hỗ trợ cho nhóm API này):
//   ARK_API_KEY=<API_KEY> npx tsx examples/ark-content-generation-video.ts
import { ArkRuntimeClient } from '../src';

const MODEL = '<YOUR_VIDEO_ENDPOINT_ID>';

interface TaskStatus {
  id?: string;
  status?: string;
  content?: { video_url?: string };
  error?: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const client = new ArkRuntimeClient();

  const created = (await client.createContentGenerationTask({
    model: MODEL,
    content: [
      { type: 'text', text: 'A cat playing piano on stage --ratio 16:9' },
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

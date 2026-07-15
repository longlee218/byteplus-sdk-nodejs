// Sample: chat completions qua Ark runtime — port từ
// byteplussdkexamples/byteplussdkarkruntime/completions.py.
// Auth 1 trong 2 cách:
//   ARK_API_KEY=<API_KEY> npx tsx examples/ark-chat-completions.ts
//   BYTEPLUS_ACCESSKEY=<AK> BYTEPLUS_SECRETKEY=<SK> npx tsx examples/ark-chat-completions.ts
//   (AK/SK chỉ dùng được với model dạng endpoint `ep-...`)
import { ArkRuntimeClient, ArkStream } from '../src';

const MODEL = '<YOUR_ENDPOINT_ID>'; // vd: ep-2024...

async function main(): Promise<void> {
  const client = new ArkRuntimeClient();

  console.log('----- standard request -----');
  const completion = (await client.createChatCompletion({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are Francis, a helpful AI assistant.' },
      { role: 'user', content: 'Hello, How are you?' },
    ],
  })) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  console.log(completion.choices?.[0]?.message?.content);

  console.log('----- streaming request -----');
  const stream = (await client.createChatCompletion({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are Francis, a helpful AI assistant.' },
      { role: 'user', content: 'Hello, How are you?' },
    ],
    stream: true,
  })) as ArkStream;

  for await (const chunk of stream) {
    const choices = chunk['choices'] as
      | Array<{ delta?: { content?: string } }>
      | undefined;
    const content = choices?.[0]?.delta?.content;
    if (content !== undefined) {
      process.stdout.write(content);
    }
  }
  process.stdout.write('\n');
}

main().catch((e) => {
  console.error('Lỗi:', (e as Error).message);
  process.exitCode = 1;
});

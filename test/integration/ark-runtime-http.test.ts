import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ArkRuntimeClient, ArkStream } from '../../src/ark/ark-runtime-client';
import { ArkService } from '../../src/ark/ark-service';

let server: Server;
let baseUrl: string;
let capturedUrl = '';
let capturedMethod = '';
let capturedHeaders: IncomingMessage['headers'] = {};
let capturedBody = '';
let requestCount = 0;
let respond: (res: ServerResponse) => void = (res) => {
  res.statusCode = 200;
  res.end('{}');
};

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      capturedUrl = req.url ?? '';
      capturedMethod = req.method ?? '';
      capturedHeaders = req.headers;
      capturedBody = Buffer.concat(chunks).toString('utf-8');
      requestCount += 1;
      respond(res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v3`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

beforeEach(() => {
  vi.stubEnv('BYTEPLUS_ACCESSKEY', undefined);
  vi.stubEnv('BYTEPLUS_SECRETKEY', undefined);
  vi.stubEnv('ARK_API_KEY', undefined);
  vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'ark-rt-int-home-')));
  requestCount = 0;
  respond = (res) => {
    res.statusCode = 200;
    res.end('{}');
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: string): void {
  respond = (res) => {
    res.statusCode = status;
    res.end(body);
  };
}

function makeClient(): ArkRuntimeClient {
  return new ArkRuntimeClient({ apiKey: 'test-api-key', baseUrl });
}

describe('ArkRuntimeClient — chat completions', () => {
  it('non-stream: POST /chat/completions với Bearer api key', async () => {
    jsonResponse(200, '{"id":"c1","choices":[{"message":{"content":"hi"}}]}');

    const resp = await makeClient().createChatCompletion({
      model: 'ep-1',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(resp).toEqual({
      id: 'c1',
      choices: [{ message: { content: 'hi' } }],
    });
    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe('/api/v3/chat/completions');
    expect(capturedHeaders['authorization']).toBe('Bearer test-api-key');
    expect(capturedHeaders['content-type']).toBe('application/json');
    expect(capturedHeaders['x-client-request-id']).toMatch(/^\d{14}/);
    expect(JSON.parse(capturedBody)).toEqual({
      model: 'ep-1',
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('stream: parse SSE và dừng ở [DONE]', async () => {
    respond = (res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream');
      res.write('data: {"choices":[{"delta":{"content":"A"}}]}\n\n');
      res.write('data: {"choices":[{"delta":{"content":"B"}}]}\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    };

    const stream = (await makeClient().createChatCompletion({
      model: 'ep-1',
      messages: [],
      stream: true,
    })) as ArkStream;

    const contents: string[] = [];
    for await (const chunk of stream) {
      const choices = chunk['choices'] as Array<{
        delta: { content: string };
      }>;
      contents.push(choices[0]!.delta.content);
    }
    expect(contents).toEqual(['A', 'B']);
    expect(JSON.parse(capturedBody)).toMatchObject({ stream: true });
  });

  it('stream: data.error → throw với message', async () => {
    respond = (res) => {
      res.statusCode = 200;
      res.write('data: {"error":{"message":"quota exceeded"}}\n\n');
      res.end();
    };

    const stream = (await makeClient().createChatCompletion({
      model: 'ep-1',
      messages: [],
      stream: true,
    })) as ArkStream;

    await expect(async () => {
      for await (const chunk of stream) {
        void chunk;
      }
    }).rejects.toThrow('quota exceeded');
  });

  it('AK/SK mode: đổi STS token qua GetApiKey rồi gửi Bearer token', async () => {
    jsonResponse(200, '{"id":"c1"}');
    vi.spyOn(ArkService.prototype, 'getApiKey').mockResolvedValue({
      ResponseMetadata: {},
      Result: {
        ApiKey: 'sts-token-xyz',
        ExpiredTime: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
      },
    });

    const client = new ArkRuntimeClient({ ak: 'a', sk: 's', baseUrl });
    const resp = await client.createChatCompletion({
      model: 'ep-1',
      messages: [],
    });

    expect(resp).toEqual({ id: 'c1' });
    expect(capturedHeaders['authorization']).toBe('Bearer sts-token-xyz');
  });
});

describe('ArkRuntimeClient — embeddings', () => {
  it('createEmbeddings POST /embeddings', async () => {
    jsonResponse(200, '{"data":[{"embedding":[0.1]}]}');
    const resp = await makeClient().createEmbeddings({
      model: 'ep-1',
      input: ['hello'],
    });
    expect(resp).toEqual({ data: [{ embedding: [0.1] }] });
    expect(capturedUrl).toBe('/api/v3/embeddings');
  });

  it('createMultimodalEmbeddings POST /embeddings/multimodal', async () => {
    jsonResponse(200, '{"data":{"embedding":[0.2]}}');
    await makeClient().createMultimodalEmbeddings({
      model: 'ep-1',
      input: [{ type: 'text', text: 'hello' }],
    });
    expect(capturedUrl).toBe('/api/v3/embeddings/multimodal');
  });
});

describe('ArkRuntimeClient — images', () => {
  it('generateImages POST /images/generations', async () => {
    jsonResponse(200, '{"data":[{"url":"https://img"}]}');
    const resp = await makeClient().generateImages({
      model: 'ep-img',
      prompt: 'a cat',
    });
    expect(resp).toEqual({ data: [{ url: 'https://img' }] });
    expect(capturedUrl).toBe('/api/v3/images/generations');
    expect(capturedMethod).toBe('POST');
  });
});

describe('ArkRuntimeClient — content generation tasks', () => {
  it('create POST /contents/generations/tasks', async () => {
    jsonResponse(200, '{"id":"cgt-1"}');
    const resp = await makeClient().createContentGenerationTask({
      model: 'ep-video',
      content: [{ type: 'text', text: 'a video of a cat' }],
    });
    expect(resp).toEqual({ id: 'cgt-1' });
    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe('/api/v3/contents/generations/tasks');
  });

  it('get GET /contents/generations/tasks/{id}', async () => {
    jsonResponse(200, '{"id":"cgt-1","status":"succeeded"}');
    const resp = await makeClient().getContentGenerationTask('cgt-1');
    expect(resp).toEqual({ id: 'cgt-1', status: 'succeeded' });
    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe('/api/v3/contents/generations/tasks/cgt-1');
  });

  it('list GET với query filter.* như Python', async () => {
    jsonResponse(200, '{"total":0,"items":[]}');
    await makeClient().listContentGenerationTasks({
      pageNum: 2,
      pageSize: 10,
      status: 'queued',
      model: 'ep-video',
      taskIds: ['t1', 't2'],
    });
    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(
      '/api/v3/contents/generations/tasks?page_num=2&page_size=10&filter.status=queued&filter.model=ep-video&filter.task_ids=t1&filter.task_ids=t2',
    );
  });

  it('delete DELETE /contents/generations/tasks/{id}', async () => {
    respond = (res) => {
      res.statusCode = 200;
      res.end('');
    };
    const resp = await makeClient().deleteContentGenerationTask('cgt-1');
    expect(resp).toBeUndefined();
    expect(capturedMethod).toBe('DELETE');
    expect(capturedUrl).toBe('/api/v3/contents/generations/tasks/cgt-1');
  });
});

describe('ArkRuntimeClient — lỗi và retry', () => {
  it('non-2xx (không retry được) throw body lỗi', async () => {
    jsonResponse(401, '{"error":{"message":"invalid api key"}}');
    await expect(
      makeClient().createChatCompletion({ model: 'ep-1', messages: [] }),
    ).rejects.toThrow('invalid api key');
  });

  it('5xx được retry (mặc định 2 lần) rồi thành công', async () => {
    respond = (res) => {
      if (requestCount === 1) {
        res.statusCode = 500;
        res.end('server error');
        return;
      }
      res.statusCode = 200;
      res.end('{"id":"ok"}');
    };
    const resp = await makeClient().createChatCompletion({
      model: 'ep-1',
      messages: [],
    });
    expect(resp).toEqual({ id: 'ok' });
    expect(requestCount).toBe(2);
  });

  it('maxRetries=0 thì 5xx throw ngay', async () => {
    jsonResponse(500, 'server error');
    const client = new ArkRuntimeClient({
      apiKey: 'k',
      baseUrl,
      maxRetries: 0,
    });
    await expect(
      client.createChatCompletion({ model: 'ep-1', messages: [] }),
    ).rejects.toThrow('server error');
    expect(requestCount).toBe(1);
  });
});

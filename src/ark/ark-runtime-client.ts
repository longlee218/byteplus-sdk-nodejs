// Port từ byteplussdkarkruntime (byteplus-python-sdk-v2) — Ark runtime
// (inference) client kiểu OpenAI. Phạm vi: chat completions, embeddings,
// multimodal embeddings, images, content generation tasks.
//
// Auth (khớp Python):
// - api_key → `Authorization: Bearer <api_key>` trực tiếp.
// - AK/SK + model `ep-...` → tự đổi STS token qua GetApiKey (with_sts_token).
// - images/generate và content generation tasks bắt buộc api_key
//   (@apikey_required — "ak&sk authentication is currently not supported").
import { randomBytes } from 'node:crypto';

import { REGION_AP_SINGAPORE1 } from '../const';
import { VERSION } from '../version';
import { iterServerSentEvents } from './sse';
import {
  RESOURCE_TYPE_ENDPOINT,
  RESOURCE_TYPE_PRESET_ENDPOINT,
  StsTokenManager,
} from './sts-token-manager';

type Params = Record<string, unknown>;

export const ARK_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';

// Python: httpx.Timeout(timeout=600.0, connect=60.0); fetch chỉ có một
// timeout tổng nên dùng 600s.
const DEFAULT_TIMEOUT_MS = 600_000;
const DEFAULT_MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 8_000;
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

export interface ArkRuntimeOptions {
  apiKey?: string;
  ak?: string;
  sk?: string;
  region?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export type ArkStream = AsyncGenerator<Record<string, unknown>, void, undefined>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function genRequestId(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const timeStr =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${timeStr}${randomBytes(9).toString('hex')}`;
}

export class ArkRuntimeClient {
  readonly apiKey: string | undefined;
  readonly ak: string | undefined;
  readonly sk: string | undefined;
  readonly region: string;
  readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private stsTokenManager: StsTokenManager | undefined;

  constructor(options: ArkRuntimeOptions = {}) {
    this.apiKey = options.apiKey ?? process.env['ARK_API_KEY'];
    this.ak = options.ak ?? process.env['BYTEPLUS_ACCESSKEY'];
    this.sk = options.sk ?? process.env['BYTEPLUS_SECRETKEY'];
    this.region = options.region ?? REGION_AP_SINGAPORE1;
    this.baseUrl = options.baseUrl ?? ARK_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

    if (
      this.apiKey === undefined &&
      (this.ak === undefined || this.sk === undefined)
    ) {
      throw new Error('you need to support api_key or ak&sk');
    }
  }

  static getResourceTypeByEndpointId(endpointId: string): string {
    if (endpointId.startsWith('ep-m-')) {
      return RESOURCE_TYPE_PRESET_ENDPOINT;
    }
    if (endpointId.startsWith('ep-')) {
      return RESOURCE_TYPE_ENDPOINT;
    }
    // Model ID mặc định là preset endpoint (như Python).
    return RESOURCE_TYPE_PRESET_ENDPOINT;
  }

  // ---- Chat / Embeddings (hỗ trợ api_key hoặc AK/SK→STS) ----

  createChatCompletion(body: Params & { stream: true }): Promise<ArkStream>;
  createChatCompletion(body: Params): Promise<unknown>;
  async createChatCompletion(body: Params): Promise<unknown> {
    const auth = await this.stsAuthHeader(body);
    return this.postJson('/chat/completions', body, auth);
  }

  async createEmbeddings(body: Params): Promise<unknown> {
    const auth = await this.stsAuthHeader(body);
    return this.postJson('/embeddings', body, auth);
  }

  async createMultimodalEmbeddings(body: Params): Promise<unknown> {
    const auth = await this.stsAuthHeader(body);
    return this.postJson('/embeddings/multimodal', body, auth);
  }

  // ---- Images (bắt buộc api_key) ----

  generateImages(body: Params & { stream: true }): Promise<ArkStream>;
  generateImages(body: Params): Promise<unknown>;
  async generateImages(body: Params): Promise<unknown> {
    return this.postJson('/images/generations', body, this.requireApiKey());
  }

  // ---- Content generation tasks (bắt buộc api_key) ----

  async createContentGenerationTask(body: Params): Promise<unknown> {
    return this.postJson(
      '/contents/generations/tasks',
      body,
      this.requireApiKey(),
    );
  }

  async getContentGenerationTask(taskId: string): Promise<unknown> {
    const resp = await this.request(
      'GET',
      `/contents/generations/tasks/${taskId}`,
      { auth: this.requireApiKey() },
    );
    return this.parseJsonResponse(resp);
  }

  async listContentGenerationTasks(
    params: {
      pageNum?: number;
      pageSize?: number;
      status?: string;
      taskIds?: string | string[];
      model?: string;
      serviceTier?: string;
    } = {},
  ): Promise<unknown> {
    const query = new URLSearchParams();
    if (params.pageNum !== undefined) {
      query.append('page_num', String(params.pageNum));
    }
    if (params.pageSize !== undefined) {
      query.append('page_size', String(params.pageSize));
    }
    if (params.status !== undefined) {
      query.append('filter.status', params.status);
    }
    if (params.model !== undefined) {
      query.append('filter.model', params.model);
    }
    if (params.serviceTier !== undefined) {
      query.append('filter.service_tier', params.serviceTier);
    }
    if (params.taskIds !== undefined) {
      const taskIds = Array.isArray(params.taskIds)
        ? params.taskIds
        : [params.taskIds];
      for (const taskId of taskIds) {
        query.append('filter.task_ids', taskId);
      }
    }
    const resp = await this.request('GET', '/contents/generations/tasks', {
      auth: this.requireApiKey(),
      query,
    });
    return this.parseJsonResponse(resp);
  }

  async deleteContentGenerationTask(taskId: string): Promise<unknown> {
    const resp = await this.request(
      'DELETE',
      `/contents/generations/tasks/${taskId}`,
      { auth: this.requireApiKey() },
    );
    return this.parseJsonResponse(resp);
  }

  // ---- Auth helpers ----

  private requireApiKey(): string {
    if (this.apiKey === undefined) {
      throw new Error(
        'ak&sk authentication is currently not supported for this method, please use api key instead',
      );
    }
    return `Bearer ${this.apiKey}`;
  }

  /**
   * Khớp _insert_sts_token của Python: api_key dùng trực tiếp; AK/SK chỉ
   * đổi được STS token cho model dạng endpoint `ep-...`.
   */
  private async stsAuthHeader(body: Params): Promise<string> {
    if (this.apiKey !== undefined) {
      return `Bearer ${this.apiKey}`;
    }
    const model = typeof body['model'] === 'string' ? body['model'] : '';
    if (model.startsWith('ep-') && this.ak !== undefined && this.sk !== undefined) {
      const resourceType = ArkRuntimeClient.getResourceTypeByEndpointId(model);
      if (resourceType === RESOURCE_TYPE_PRESET_ENDPOINT) {
        // Python yêu cầu project_name cho preset endpoint nhưng luồng
        // with_sts_token không truyền được nên cũng lỗi tại đây.
        throw new Error('must set project_name when get preset endpoint token.');
      }
      if (this.stsTokenManager === undefined) {
        this.stsTokenManager = new StsTokenManager(
          this.ak,
          this.sk,
          this.region,
        );
      }
      const token = await this.stsTokenManager.get(model, resourceType);
      return `Bearer ${token}`;
    }
    throw new Error(
      'must set api_key, or use ak&sk with an endpoint model (ep-...)',
    );
  }

  // ---- HTTP core ----

  private async postJson(
    path: string,
    body: Params,
    auth: string,
  ): Promise<unknown> {
    const resp = await this.request('POST', path, { auth, body });
    if (body['stream'] === true) {
      return this.streamEvents(resp);
    }
    return this.parseJsonResponse(resp);
  }

  private async request(
    method: string,
    path: string,
    opts: { auth: string; body?: Params; query?: URLSearchParams },
  ): Promise<Response> {
    const queryString = opts.query?.toString() ?? '';
    const url =
      this.baseUrl + path + (queryString === '' ? '' : `?${queryString}`);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': `byteplus-sdk-nodejs/${VERSION}`,
      'X-Client-Request-Id': genRequestId(),
      Authorization: opts.auth,
    };

    let attempt = 0;
    for (;;) {
      let resp: Response;
      try {
        resp = await fetch(url, {
          method,
          headers,
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (e) {
        if (attempt >= this.maxRetries) {
          throw e;
        }
        await sleep(this.retryDelayMs(attempt));
        attempt += 1;
        continue;
      }
      if (RETRYABLE_STATUS.has(resp.status) && attempt < this.maxRetries) {
        await sleep(this.retryDelayMs(attempt));
        attempt += 1;
        continue;
      }
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
      return resp;
    }
  }

  private retryDelayMs(attempt: number): number {
    return Math.min(INITIAL_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
  }

  private async parseJsonResponse(resp: Response): Promise<unknown> {
    const text = await resp.text();
    if (text === '') {
      return undefined;
    }
    return JSON.parse(text);
  }

  private async *streamEvents(resp: Response): ArkStream {
    if (resp.body === null) {
      throw new Error('empty response body');
    }
    const body = resp.body as unknown as AsyncIterable<Uint8Array>;
    for await (const sse of iterServerSentEvents(body)) {
      if (sse.data.startsWith('[DONE]')) {
        break;
      }
      const data = JSON.parse(sse.data) as Record<string, unknown>;
      const error = data['error'];
      if (sse.event === 'error' || error !== undefined) {
        const message =
          typeof error === 'object' && error !== null
            ? (error as Record<string, unknown>)['message']
            : undefined;
        throw new Error(
          typeof message === 'string'
            ? message
            : 'An error occurred during streaming',
        );
      }
      yield data;
    }
  }
}

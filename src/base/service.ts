// Port từ byteplus_sdk/base/Service.py (master). Khác biệt so với Python
// được ghi trong docs/stories/epics/E01-core/US-001-core-foundation/design.md:
// - HTTP dùng fetch built-in; timeout = (connectionTimeout + socketTimeout).
// - json() với method GET và body khác rỗng đi qua node:http(s) vì fetch cấm
//   GET có body (quyết định 0010) — wire format giữ nguyên như Python.
import { existsSync, readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

import { ApiInfo } from '../api-info';
import { Credentials } from '../credentials';
import { ServiceInfo } from '../service-info';
import { SignerV4 } from '../auth/signer-v4';
import {
  InnerToken,
  Policy,
  SecurityToken2,
  innerTokenToJson,
  policyToJson,
} from '../policy';
import { Request } from './request';
import { pyJsonDumps, pyUrlencode } from '../util/encoding';
import {
  aesEncryptCbcWithBase64,
  generateAccessKeyId,
  generateSecretKey,
  hmacSha256,
  md5,
  toHex,
} from '../util/crypto';
import { VERSION } from '../version';

export class Service {
  constructor(
    public serviceInfo: ServiceInfo,
    public apiInfo: Record<string, ApiInfo>,
  ) {
    this.init();
  }

  /** Đọc credential từ env hoặc ~/.byteplus/config như bản Python. */
  private init(): void {
    const envAk = process.env['BYTEPLUS_ACCESSKEY'];
    const envSk = process.env['BYTEPLUS_SECRETKEY'];
    if (envAk !== undefined && envSk !== undefined) {
      this.serviceInfo.credentials.setAk(envAk);
      this.serviceInfo.credentials.setSk(envSk);
      return;
    }

    const home = process.env['HOME'];
    if (home === undefined) return;

    const configPath = home + '/.byteplus/config';
    if (!existsSync(configPath)) return;

    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as {
      ak?: string;
      sk?: string;
    };
    if (config.ak !== undefined) this.serviceInfo.credentials.setAk(config.ak);
    if (config.sk !== undefined) this.serviceInfo.credentials.setSk(config.sk);
  }

  setAk(ak: string): void {
    this.serviceInfo.credentials.setAk(ak);
  }

  setSk(sk: string): void {
    this.serviceInfo.credentials.setSk(sk);
  }

  setHost(host: string): void {
    this.serviceInfo.host = host;
  }

  setScheme(scheme: string): void {
    this.serviceInfo.scheme = scheme;
  }

  getSignUrl(api: string, params: Record<string, unknown>): string {
    const apiInfo = this.requireApi(api);

    const mquery = this.merge(apiInfo.query, params);
    const r = new Request();
    r.setSchema(this.serviceInfo.scheme);
    r.setMethod(apiInfo.method);
    r.setPath(apiInfo.path);
    r.setQuery(mquery);

    return SignerV4.signUrl(r, this.serviceInfo.credentials);
  }

  async get(
    api: string,
    params: Record<string, unknown>,
    doseq = false,
  ): Promise<string> {
    const apiInfo = this.requireApi(api);
    const r = this.prepareRequest(apiInfo, params, doseq);

    SignerV4.sign(r, this.serviceInfo.credentials);

    const url = r.build(doseq);
    const resp = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers: r.headers,
    });
    const text = await resp.text();
    if (resp.status === 200) return text;
    throw new Error(text);
  }

  async post(
    api: string,
    params: Record<string, unknown>,
    form: Record<string, unknown>,
  ): Promise<string> {
    const apiInfo = this.requireApi(api);
    const r = this.prepareRequest(apiInfo, params);
    r.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    r.form = this.merge(apiInfo.form, form);
    r.body = pyUrlencode(r.form, true);
    SignerV4.sign(r, this.serviceInfo.credentials);

    const url = r.build();
    const resp = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: r.headers,
      body: r.body,
    });
    const text = await resp.text();
    if (resp.status === 200) return text;
    throw new Error(text);
  }

  async json(
    api: string,
    params: Record<string, unknown>,
    body: string | Record<string, unknown>,
  ): Promise<string> {
    const apiInfo = this.requireApi(api);
    const r = this.prepareRequest(apiInfo, params);
    r.headers['Content-Type'] = 'application/json';
    r.body = body;

    SignerV4.sign(r, this.serviceInfo.credentials);

    const url = r.build();
    const payload = typeof body === 'string' ? body : pyJsonDumps(body);
    if (apiInfo.method === 'GET' && payload !== '') {
      // Python requests gửi GET kèm body JSON và server đọc body này
      // (vd SMS GetSmsTemplateAndOrderList) — fetch cấm nên đi node:http(s).
      // Quyết định 0010.
      const { status, text } = await this.getWithBody(url, r.headers, payload);
      if (status === 200) return pyJsonDumps(JSON.parse(text));
      throw new Error(text);
    }
    const resp = await this.fetchWithTimeout(url, {
      method: apiInfo.method === 'GET' ? 'GET' : 'POST',
      headers: r.headers,
      body: apiInfo.method === 'GET' ? undefined : payload,
    });
    if (resp.status === 200) return pyJsonDumps(await resp.json());
    throw new Error(await resp.text());
  }

  private getWithBody(
    url: string,
    headers: Record<string, string>,
    payload: string,
  ): Promise<{ status: number; text: string }> {
    const timeoutMs =
      (this.serviceInfo.connectionTimeout + this.serviceInfo.socketTimeout) *
      1000;
    const doRequest = url.startsWith('https:') ? httpsRequest : httpRequest;
    return new Promise((resolve, reject) => {
      const req = doRequest(
        url,
        {
          method: 'GET',
          headers: {
            ...headers,
            'Content-Length': String(Buffer.byteLength(payload)),
          },
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              text: Buffer.concat(chunks).toString('utf-8'),
            }),
          );
          res.on('error', reject);
        },
      );
      req.on('timeout', () =>
        req.destroy(new Error(`GET có body quá thời gian chờ ${timeoutMs}ms`)),
      );
      req.on('error', reject);
      req.end(payload);
    });
  }

  async put(
    url: string,
    filePath: string,
    headers: Record<string, string>,
  ): Promise<[boolean, string]> {
    return this.putData(url, readFileSync(filePath), headers);
  }

  async putData(
    url: string,
    data: Buffer | string,
    headers: Record<string, string>,
  ): Promise<[boolean, string]> {
    const resp = await this.fetchWithTimeout(url, {
      method: 'PUT',
      headers,
      body: data,
    });
    const text = await resp.text();
    return [resp.status === 200, text];
  }

  prepareRequest(
    apiInfo: ApiInfo,
    params: Record<string, unknown>,
    doseq = false,
  ): Request {
    const coerced: Record<string, unknown> = {};
    for (const key of Object.keys(params)) {
      const value = params[key];
      if (typeof value === 'number') {
        coerced[key] = String(value);
      } else if (Array.isArray(value) && !doseq) {
        coerced[key] = value.join(',');
      } else {
        coerced[key] = value;
      }
    }

    const r = new Request();
    r.setSchema(this.serviceInfo.scheme);
    r.setMethod(apiInfo.method);
    r.setConnectionTimeout(this.serviceInfo.connectionTimeout);
    r.setSocketTimeout(this.serviceInfo.socketTimeout);

    const mheaders = this.merge(apiInfo.header, this.serviceInfo.header);
    mheaders['Host'] = this.serviceInfo.host;
    mheaders['User-Agent'] = 'byteplus-sdk-nodejs/' + VERSION;
    r.setHeaders(mheaders as Record<string, string>);

    r.setQuery(this.merge(apiInfo.query, coerced));
    r.setHost(this.serviceInfo.host);
    r.setPath(apiInfo.path);

    return r;
  }

  merge<T>(
    param1: Record<string, T>,
    param2: Record<string, T>,
  ): Record<string, T> {
    return { ...param1, ...param2 };
  }

  signSts2(policy: Policy | null, expire: number): SecurityToken2 {
    const sk = this.serviceInfo.credentials.sk;
    const key = md5(Buffer.from(sk, 'utf-8'));

    const sts = new SecurityToken2();
    sts.accessKeyId = generateAccessKeyId('AKTP');
    sts.secretAccessKey = generateSecretKey();
    const now = Math.floor(Date.now() / 1000);
    sts.currentTime = Service.toRfc3339(now);

    let expireSeconds = expire;
    if (expireSeconds < 60) {
      expireSeconds = 60;
    }
    const expiredAt = now + expireSeconds;
    sts.expiredTime = Service.toRfc3339(expiredAt);

    const innerToken = new InnerToken();
    innerToken.ltAccessKeyId = this.serviceInfo.credentials.ak;
    innerToken.accessKeyId = sts.accessKeyId;
    innerToken.policyString =
      policy === null
        ? ''
        : pyJsonDumps(policyToJson(policy), { sortKeys: true }).replace(
            / /g,
            '',
          );
    innerToken.signedSecretAccessKey = aesEncryptCbcWithBase64(
      sts.secretAccessKey,
      key,
    );
    innerToken.expiredTime = expiredAt;

    const signStr = [
      innerToken.ltAccessKeyId,
      innerToken.accessKeyId,
      innerToken.expiredTime,
      innerToken.signedSecretAccessKey,
      innerToken.policyString,
    ].join('|');
    innerToken.signature = toHex(hmacSha256(key, signStr));

    sts.sessionToken =
      'STS2' +
      Buffer.from(
        pyJsonDumps(innerTokenToJson(innerToken), { sortKeys: true }).replace(
          / /g,
          '',
        ),
        'utf-8',
      ).toString('base64');
    return sts;
  }

  /** time.strftime('%Y-%m-%dT%H:%M:%S%z') theo local timezone + chèn ':'. */
  static toRfc3339(epochSeconds: number): string {
    const d = new Date(epochSeconds * 1000);
    const pad2 = (n: number): string => String(Math.abs(n)).padStart(2, '0');
    const offsetMinutes = -d.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const offsetH = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetM = Math.abs(offsetMinutes) % 60;
    return (
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
      `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` +
      `${sign}${pad2(offsetH)}:${pad2(offsetM)}`
    );
  }

  private requireApi(api: string): ApiInfo {
    const apiInfo = this.apiInfo[api];
    if (apiInfo === undefined) {
      throw new Error('no such api');
    }
    return apiInfo;
  }

  private fetchWithTimeout(
    url: string,
    init: {
      method: string;
      headers?: Record<string, string>;
      body?: string | Buffer;
    },
  ): Promise<Response> {
    const timeoutSeconds =
      this.serviceInfo.connectionTimeout + this.serviceInfo.socketTimeout;
    return fetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body as RequestInit['body'],
      signal:
        timeoutSeconds > 0
          ? AbortSignal.timeout(timeoutSeconds * 1000)
          : undefined,
    });
  }
}

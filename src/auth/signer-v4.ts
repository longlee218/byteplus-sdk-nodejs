// Port từ byteplus_sdk/auth/SignerV4.py (master). Mọi bước phải khớp từng
// byte với bản Python — đối chiếu test/fixtures/python-vectors.json.
import { Credentials } from '../credentials';
import { Request } from '../base/request';
import { MetaData } from './meta-data';
import {
  normQuery,
  normUri,
  pyJsonDumps,
  pyUrlencode,
} from '../util/encoding';
import { hmacSha256, sha256, toHex } from '../util/crypto';

const SIGNED_HEADER_WHITELIST = ['Content-Type', 'Content-Md5', 'Host'];

export class SignerV4 {
  static sign(request: Request, credentials: Credentials): void {
    if (request.path === '') {
      request.path = '/';
    }
    if (request.method !== 'GET' && !('Content-Type' in request.headers)) {
      request.headers['Content-Type'] =
        'application/x-www-form-urlencoded; charset=utf-8';
    }

    const formatDate = SignerV4.getCurrentFormatDate();
    request.headers['X-Date'] = formatDate;

    const md = new MetaData();
    md.algorithm = 'HMAC-SHA256';
    md.service = credentials.service;
    md.region = credentials.region;
    md.date = formatDate.slice(0, 8);

    const hashedCanonReq = SignerV4.hashedCanonicalRequestV4(request, md);
    md.credentialScope = [md.date, md.region, md.service, 'request'].join('/');

    const signingStr = [
      md.algorithm,
      formatDate,
      md.credentialScope,
      hashedCanonReq,
    ].join('\n');
    const signingKey = SignerV4.getSigningSecretKeyV4(
      credentials.sk,
      md.date,
      md.region,
      md.service,
    );
    const sign = toHex(hmacSha256(signingKey, signingStr));
    request.headers['Authorization'] = SignerV4.buildAuthHeaderV4(
      sign,
      md,
      credentials,
    );
  }

  static signUrl(request: Request, credentials: Credentials): string {
    const formatDate = SignerV4.getCurrentFormatDate();
    const date = formatDate.slice(0, 8);

    const md = new MetaData();
    md.date = date;
    md.service = credentials.service;
    md.region = credentials.region;
    md.signedHeaders = '';
    md.algorithm = 'HMAC-SHA256';
    md.credentialScope = [md.date, md.region, md.service, 'request'].join('/');

    const query = request.query;
    query['X-Date'] = formatDate;
    query['X-NotSignBody'] = '';
    query['X-Credential'] = credentials.ak + '/' + md.credentialScope;
    query['X-Algorithm'] = md.algorithm;
    query['X-SignedHeaders'] = md.signedHeaders;
    query['X-SignedQueries'] = '';
    query['X-SignedQueries'] = Object.keys(query).sort().join(';');

    const hashedCanonReq = SignerV4.hashedSimpleCanonicalRequestV4(
      request,
      md,
    );
    const signingStr = [
      md.algorithm,
      formatDate,
      md.credentialScope,
      hashedCanonReq,
    ].join('\n');
    const signingKey = SignerV4.getSigningSecretKeyV4(
      credentials.sk,
      md.date,
      md.region,
      md.service,
    );
    query['X-Signature'] = SignerV4.signatureV4(signingKey, signingStr);
    return pyUrlencode(query);
  }

  static hashedSimpleCanonicalRequestV4(
    request: Request,
    meta: MetaData,
  ): string {
    const bodyHash = sha256('');

    if (request.path === '') {
      request.path = '/';
    }

    const canonicalRequest = [
      request.method,
      normUri(request.path),
      normQuery(request.query),
      '\n',
      meta.signedHeaders,
      bodyHash,
    ].join('\n');
    return sha256(canonicalRequest);
  }

  static hashedCanonicalRequestV4(request: Request, meta: MetaData): string {
    // Body dạng object được hash theo json.dumps của Python (có space)
    const bodyHash =
      typeof request.body === 'string'
        ? sha256(request.body)
        : sha256(pyJsonDumps(request.body));

    request.headers['X-Content-Sha256'] = bodyHash;

    const signedHeaders: Record<string, string> = {};
    for (const key of Object.keys(request.headers)) {
      if (SIGNED_HEADER_WHITELIST.includes(key) || key.startsWith('X-')) {
        signedHeaders[key.toLowerCase()] = request.headers[key] as string;
      }
    }

    const host = signedHeaders['host'];
    if (host !== undefined && host.includes(':')) {
      const [hostname, port] = host.split(':');
      if (port === '80' || port === '443') {
        signedHeaders['host'] = hostname as string;
      }
    }

    let signedStr = '';
    for (const key of Object.keys(signedHeaders).sort()) {
      signedStr += key + ':' + signedHeaders[key] + '\n';
    }

    meta.signedHeaders = Object.keys(signedHeaders).sort().join(';');

    const canonicalRequest = [
      request.method,
      normUri(request.path),
      normQuery(request.query),
      signedStr,
      meta.signedHeaders,
      bodyHash,
    ].join('\n');

    return sha256(canonicalRequest);
  }

  static signatureV4(signingKey: Buffer, signingStr: string): string {
    return toHex(hmacSha256(signingKey, signingStr));
  }

  static getSigningSecretKeyV4(
    sk: string,
    date: string,
    region: string,
    service: string,
  ): Buffer {
    const kdate = hmacSha256(Buffer.from(sk, 'utf-8'), date);
    const kregion = hmacSha256(kdate, region);
    const kservice = hmacSha256(kregion, service);
    return hmacSha256(kservice, 'request');
  }

  static buildAuthHeaderV4(
    signature: string,
    meta: MetaData,
    credentials: Credentials,
  ): string {
    const credential = credentials.ak + '/' + meta.credentialScope;
    return (
      meta.algorithm +
      ' Credential=' +
      credential +
      ', SignedHeaders=' +
      meta.signedHeaders +
      ', Signature=' +
      signature
    );
  }

  /** Format `YYYYMMDDTHHMMSSZ` theo UTC (khớp bản Python). */
  static getCurrentFormatDate(): string {
    const now = new Date();
    const pad2 = (n: number): string => String(n).padStart(2, '0');
    return (
      `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}` +
      `${pad2(now.getUTCDate())}T${pad2(now.getUTCHours())}` +
      `${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}Z`
    );
  }
}

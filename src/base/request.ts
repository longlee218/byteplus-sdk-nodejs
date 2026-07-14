// Port từ byteplus_sdk/base/Request.py (master)
import { pyUrlencode } from '../util/encoding';

export class Request {
  schema = '';
  method = '';
  host = '';
  path = '';
  headers: Record<string, string> = {};
  query: Record<string, unknown> = {};
  body: string | Record<string, unknown> = '';
  form: Record<string, unknown> = {};
  connectionTimeout = 0;
  socketTimeout = 0;

  setSchema(schema: string): void {
    this.schema = schema;
  }

  setMethod(method: string): void {
    this.method = method;
  }

  setHost(host: string): void {
    this.host = host;
  }

  setPath(path: string): void {
    this.path = path;
  }

  setHeaders(headers: Record<string, string>): void {
    this.headers = headers;
  }

  setQuery(query: Record<string, unknown>): void {
    this.query = query;
  }

  setBody(body: string | Record<string, unknown>): void {
    this.body = body;
  }

  setConnectionTimeout(connectionTimeout: number): void {
    this.connectionTimeout = connectionTimeout;
  }

  setSocketTimeout(socketTimeout: number): void {
    this.socketTimeout = socketTimeout;
  }

  build(doseq = false): string {
    return (
      this.schema +
      '://' +
      this.host +
      this.path +
      '?' +
      pyUrlencode(this.query, doseq)
    );
  }
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SignCase {
  name: string;
  method: string;
  path: string;
  host: string;
  query: Record<string, string>;
  headersIn: Record<string, string>;
  body?: string;
  bodyIsPyJsonDumpsOfBodyFixture?: boolean;
  headersOut: Record<string, string>;
  builtUrl: string;
}

export const vectors = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/python-vectors.json'), 'utf-8'),
);

// Phải giữ đúng thứ tự chèn key như script gen_vectors.py
export const BODY_FIXTURE = {
  Name: 'test-user',
  Ids: [1, 2],
  Nested: { B: 1.5, A: 'x y' },
  Note: 'việt 港',
  Flag: true,
  Empty: null,
};

export const VECTOR_CREDENTIALS = {
  ak: 'AKTPtestak',
  sk: 'testsk-fixed-secret',
  service: 'iam',
  region: 'ap-singapore-1',
};

export const FIXED_DATE_MS = Date.UTC(2026, 6, 14, 12, 0, 0);

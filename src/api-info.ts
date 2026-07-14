// Port từ byteplus_sdk/ApiInfo.py (master)

export class ApiInfo {
  constructor(
    public method: string,
    public path: string,
    public query: Record<string, unknown>,
    public form: Record<string, unknown>,
    public header: Record<string, string>,
  ) {}

  toString(): string {
    return `method: ${this.method}, path: ${this.path}`;
  }
}

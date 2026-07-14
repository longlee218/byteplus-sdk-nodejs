// Port từ byteplus_sdk/Credentials.py (master)

export class Credentials {
  constructor(
    public ak: string,
    public sk: string,
    public service: string,
    public region: string,
  ) {}

  setAk(ak: string): void {
    this.ak = ak;
  }

  setSk(sk: string): void {
    this.sk = sk;
  }
}

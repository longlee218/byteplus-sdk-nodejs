// Port từ byteplus_sdk/ServiceInfo.py + ServiceInfoHttps.py (master).
// Bản Python có class ServiceInfoHttps riêng chỉ khác scheme mặc định;
// bản Node dùng một class với tham số scheme.
import { Credentials } from './credentials';

export class ServiceInfo {
  constructor(
    public host: string,
    public header: Record<string, string>,
    public credentials: Credentials,
    /** Đơn vị: giây (như bản Python). */
    public connectionTimeout: number,
    /** Đơn vị: giây (như bản Python). */
    public socketTimeout: number,
    public scheme: string = 'http',
  ) {}
}

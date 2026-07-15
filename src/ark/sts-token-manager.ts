// Port từ byteplussdkarkruntime._client.StsTokenManager (byteplus-python-sdk-v2).
// Đổi AK/SK lấy API key ngắn hạn qua management API GetApiKey (ký SignerV4),
// cache theo endpoint và tự refresh: advisory 30 phút, mandatory 10 phút
// trước khi hết hạn; TTL mặc định 7 ngày.
import { ArkService } from './ark-service';

const ADVISORY_REFRESH_TIMEOUT_S = 30 * 60;
const MANDATORY_REFRESH_TIMEOUT_S = 10 * 60;
const DEFAULT_STS_TIMEOUT_S = 7 * 24 * 60 * 60;

export const RESOURCE_TYPE_ENDPOINT = 'endpoint';
export const RESOURCE_TYPE_PRESET_ENDPOINT = 'presetendpoint';

interface StsToken {
  apiKey: string;
  /** Epoch giây, theo ExpiredTime của GetApiKey. */
  expiredTime: number;
}

interface GetApiKeyEnvelope {
  ResponseMetadata?: { Error?: unknown };
  Result?: { ApiKey?: unknown; ExpiredTime?: unknown };
}

export class StsTokenManager {
  private readonly tokens = new Map<string, StsToken>();

  constructor(
    private readonly ak: string,
    private readonly sk: string,
    private readonly region: string,
  ) {}

  async get(
    endpointId: string,
    resourceType: string = RESOURCE_TYPE_ENDPOINT,
  ): Promise<string> {
    await this.refresh(endpointId, resourceType);
    return this.tokens.get(endpointId)?.apiKey ?? '';
  }

  private needRefresh(endpointId: string, refreshInSeconds: number): boolean {
    const expiredTime = this.tokens.get(endpointId)?.expiredTime ?? 0;
    return expiredTime - Date.now() / 1000 < refreshInSeconds;
  }

  private async refresh(
    endpointId: string,
    resourceType: string,
  ): Promise<void> {
    if (!this.needRefresh(endpointId, ADVISORY_REFRESH_TIMEOUT_S)) {
      return;
    }
    const isMandatory = this.needRefresh(
      endpointId,
      MANDATORY_REFRESH_TIMEOUT_S,
    );
    try {
      const token = await this.loadApiKey(endpointId, resourceType);
      this.tokens.set(endpointId, token);
    } catch (e) {
      // Như Python: refresh advisory lỗi thì giữ token cũ (vẫn còn hạn
      // >10 phút); chỉ propagate khi mandatory.
      if (isMandatory) {
        throw new Error(
          `load api key cause error: e=${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  private async loadApiKey(
    endpointId: string,
    resourceType: string,
  ): Promise<StsToken> {
    // ArkService là singleton kiểu Python — set lại credential mỗi lần
    // gọi, tương đương Configuration.set_default trong StsTokenManager gốc.
    const service = new ArkService(this.region);
    service.setAk(this.ak);
    service.setSk(this.sk);

    const resp = (await service.getApiKey({
      DurationSeconds: DEFAULT_STS_TIMEOUT_S,
      ResourceType: resourceType,
      ResourceIds: [endpointId],
    })) as GetApiKeyEnvelope;

    const error = resp.ResponseMetadata?.Error;
    if (error !== undefined) {
      throw new Error(JSON.stringify(error));
    }
    const apiKey = resp.Result?.ApiKey;
    const expiredTime = resp.Result?.ExpiredTime;
    if (typeof apiKey !== 'string' || typeof expiredTime !== 'number') {
      throw new Error('invalid GetApiKey response');
    }
    return { apiKey, expiredTime };
  }
}

// Port từ byteplus_sdk/Policy.py (master). Các hàm *ToJson tái tạo
// ComplexEncoder của Python (tên field PascalCase).

export class Statement {
  effect = '';
  action: string[] = [];
  resource: string[] = [];
  condition = '';

  static newAllowStatement(actions: string[], resources: string[]): Statement {
    const s = new Statement();
    s.effect = 'Allow';
    s.action = actions;
    s.resource = resources;
    return s;
  }

  static newDenyStatement(actions: string[], resources: string[]): Statement {
    const s = new Statement();
    s.effect = 'Deny';
    s.action = actions;
    s.resource = resources;
    return s;
  }
}

export class Policy {
  constructor(public statements: Statement[]) {}
}

export class SecurityToken2 {
  accessKeyId = '';
  secretAccessKey = '';
  sessionToken = '';
  expiredTime = '';
  currentTime = '';
}

export class InnerToken {
  ltAccessKeyId = '';
  accessKeyId = '';
  signedSecretAccessKey = '';
  expiredTime = 0;
  policyString = '';
  signature = '';
}

export function statementToJson(s: Statement): Record<string, unknown> {
  return { Effect: s.effect, Action: s.action, Resource: s.resource };
}

export function policyToJson(p: Policy): Record<string, unknown> {
  return { Statement: p.statements.map(statementToJson) };
}

export function innerTokenToJson(t: InnerToken): Record<string, unknown> {
  return {
    LTAccessKeyId: t.ltAccessKeyId,
    AccessKeyId: t.accessKeyId,
    SignedSecretAccessKey: t.signedSecretAccessKey,
    ExpiredTime: t.expiredTime,
    PolicyString: t.policyString,
    Signature: t.signature,
  };
}

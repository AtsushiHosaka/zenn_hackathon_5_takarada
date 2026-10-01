// 通信でもパースでも、失敗は全部これに畳んでから投げる。UI は message をそのまま出す。
export class DomainError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "DomainError";
    this.status = status;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export function toDomainError(cause: unknown): DomainError {
  if (cause instanceof DomainError) return cause;
  if (cause instanceof Error) return new DomainError(cause.message);
  return new DomainError("原因不明のエラーが発生しました");
}

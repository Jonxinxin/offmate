import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export type ErrorCode =
  | 'INVALID_PARAM'
  | 'UNAUTHORIZED'
  | 'RECOVERY_INVALID'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVITE_INVALID'
  | 'ALREADY_MEMBER'
  | 'GROUP_FULL'
  | 'LIMIT_EXCEEDED'
  | 'RATE_LIMITED'
  | 'INTERNAL'

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  INVALID_PARAM: 400,
  UNAUTHORIZED: 401,
  RECOVERY_INVALID: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVITE_INVALID: 404,
  ALREADY_MEMBER: 409,
  GROUP_FULL: 409,
  LIMIT_EXCEEDED: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
}

/** 业务异常。抛出后由 error 中间件统一转成响应。 */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
  }

  get status(): ContentfulStatusCode {
    return STATUS[this.code]
  }
}

export function ok<T>(c: Context, data: T) {
  return c.json({ ok: true as const, data })
}

export function fail(c: Context, code: ErrorCode, message: string) {
  return c.json({ ok: false as const, error: { code, message } }, STATUS[code])
}

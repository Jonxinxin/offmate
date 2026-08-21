import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ApiError, fail } from '../lib/response'

/** 统一错误出口。业务异常按 code 映射状态码，未知异常记录后返回 500。 */
export function onError(err: Error, c: Context) {
  if (err instanceof ApiError) {
    return fail(c, err.code, err.message)
  }

  if (err instanceof HTTPException) {
    return fail(c, err.status === 404 ? 'NOT_FOUND' : 'INTERNAL', err.message)
  }

  console.error('unhandled error:', err.stack ?? err.message)
  return fail(c, 'INTERNAL', '服务器开小差了，请稍后重试')
}

export function onNotFound(c: Context) {
  return fail(c, 'NOT_FOUND', '接口不存在')
}

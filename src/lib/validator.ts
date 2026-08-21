import { zValidator } from '@hono/zod-validator'
import type { ZodSchema } from 'zod'
import { fail } from './response'

/**
 * zValidator 的默认失败响应是 zod 的原始错误结构，与本项目的 { ok, error } 格式不一致。
 * 统一包一层，让前端只需要处理一种错误形状，并直接拿到可展示的中文提示。
 */
export function jsonBody<T extends ZodSchema>(schema: T) {
  return zValidator('json', schema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? '参数不正确'
      return fail(c, 'INVALID_PARAM', message)
    }
  })
}

export function queryParams<T extends ZodSchema>(schema: T) {
  return zValidator('query', schema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? '参数不正确'
      return fail(c, 'INVALID_PARAM', message)
    }
  })
}

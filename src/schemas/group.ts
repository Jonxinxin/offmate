import { z } from 'zod'

export const VISIBILITIES = ['full', 'busy_only', 'hidden'] as const

const groupName = z
  .string()
  .trim()
  .min(1, '群组名称不能为空')
  .max(16, '群组名称最多 16 个字')

/** 邀请码大小写不敏感，统一转大写后比对 */
const inviteCode = z
  .string()
  .trim()
  .min(1, '请输入邀请码')
  .max(16)
  .transform((v) => v.toUpperCase())

export const createGroupSchema = z.object({ name: groupName })

export const renameGroupSchema = z.object({ name: groupName })

export const joinGroupSchema = z.object({ inviteCode })

export const previewQuerySchema = z.object({ code: inviteCode })

export const transferSchema = z.object({
  userId: z.string().trim().min(1),
})

export const visibilitySchema = z.object({
  visibility: z.enum(VISIBILITIES, {
    errorMap: () => ({ message: '不支持的可见范围' }),
  }),
})

export const refreshInviteSchema = z.object({
  /** 邀请码有效期（秒）。省略表示永不过期。 */
  expireIn: z
    .number()
    .int()
    .positive()
    .max(30 * 24 * 3600)
    .optional(),
})

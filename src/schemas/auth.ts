import { z } from 'zod'

/** 头像 emoji 白名单。限定集合避免用户塞入任意字符或超长组合 emoji。 */
export const AVATAR_EMOJIS = [
  '🐟', '🐈', '🐕', '🐼', '🦊', '🐸', '🐧', '🦉',
  '🌵', '🌻', '🍀', '🍜', '🍕', '🍰', '☕', '🍺',
  '⚽', '🎸', '🎮', '📚', '✈️', '🚗', '🌙', '⭐',
  '😴', '😎', '🤖', '👻', '🎃', '🐳', '🦄', '🔥',
] as const

const nickname = z
  .string()
  .trim()
  .min(1, '昵称不能为空')
  .max(12, '昵称最多 12 个字')

// 默认的 enum 报错会把整个候选列表拼进消息里，直接展示给用户毫无意义
const avatarEmoji = z
  .enum(AVATAR_EMOJIS, { errorMap: () => ({ message: '不支持的头像' }) })
  .nullable()
  .optional()

export const registerSchema = z.object({
  nickname,
  avatarEmoji,
  /** 携带时注册后立即加入该群组（M2 接入） */
  inviteCode: z.string().trim().min(1).max(16).optional(),
})

export const recoverSchema = z.object({
  recoveryCode: z.string().trim().min(1, '请输入恢复码').max(32),
})

export const updateMeSchema = z
  .object({
    nickname: nickname.optional(),
    avatarEmoji,
  })
  .refine((v) => v.nickname !== undefined || v.avatarEmoji !== undefined, {
    message: '没有需要更新的内容',
  })

export type RegisterInput = z.infer<typeof registerSchema>
export type RecoverInput = z.infer<typeof recoverSchema>
export type UpdateMeInput = z.infer<typeof updateMeSchema>

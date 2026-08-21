/**
 * 头像 emoji 白名单，必须与后端 src/schemas/auth.ts 的 AVATAR_EMOJIS 保持一致。
 * 后端会拒绝列表外的值，两边不同步会导致用户选了却存不上。
 */
export const AVATAR_EMOJIS = [
  '🐟', '🐈', '🐕', '🐼', '🦊', '🐸', '🐧', '🦉',
  '🌵', '🌻', '🍀', '🍜', '🍕', '🍰', '☕', '🍺',
  '⚽', '🎸', '🎮', '📚', '✈️', '🚗', '🌙', '⭐',
  '😴', '😎', '🤖', '👻', '🎃', '🐳', '🦄', '🔥',
] as const

export const NICKNAME_MAX = 12

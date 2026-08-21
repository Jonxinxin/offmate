interface AvatarProps {
  nickname: string
  emoji?: string | null
  color: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'h-9 w-9 text-base',
  md: 'h-11 w-11 text-lg',
  lg: 'h-20 w-20 text-4xl',
}

/** 没有 emoji 时退化为昵称首字，保证任何用户都有可辨识的头像 */
export function Avatar({ nickname, emoji, color, size = 'md' }: AvatarProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full text-white ${SIZES[size]}`}
      style={{ backgroundColor: emoji ? 'transparent' : color }}
    >
      {emoji ?? [...nickname][0] ?? '?'}
    </div>
  )
}

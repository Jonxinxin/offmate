import { AVATAR_EMOJIS } from '../lib/constants'

interface EmojiPickerProps {
  value: string | null
  onChange: (emoji: string | null) => void
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {AVATAR_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          // 再点一次取消选择，退回昵称首字头像
          onClick={() => onChange(value === emoji ? null : emoji)}
          className={`flex h-10 items-center justify-center rounded-lg text-xl transition ${
            value === emoji ? 'bg-ink ring-2 ring-ink' : 'bg-gray-50'
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

import type { DayMember } from '../types/api'
import { Avatar } from './Avatar'
import { StatusTag } from './StatusTag'

export function MemberCard({ member, onClick }: { member: DayMember; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm transition active:scale-[0.99]"
    >
      <Avatar
        nickname={member.nickname}
        emoji={member.avatarEmoji}
        color={member.avatarColor}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {member.nickname}
          {member.isMe && <span className="ml-1 text-xs text-ink-soft">（我）</span>}
        </p>
        {member.note && (
          <p className="truncate text-xs text-ink-soft">{member.note}</p>
        )}
      </div>

      <StatusTag status={member.status} />
    </button>
  )
}

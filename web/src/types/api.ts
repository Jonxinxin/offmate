/** 与后端 src/schemas 及 services 返回结构对应。接口超过 40 个时改为共享包。 */

export type Role = 'owner' | 'member'
export type Visibility = 'full' | 'busy_only' | 'hidden'

export interface User {
  id: string
  nickname: string
  avatarEmoji: string | null
  avatarColor: string
}

export interface Group {
  id: string
  name: string
  ownerId: string
  memberCount: number
  createdAt: number
}

export interface GroupDetail extends Group {
  inviteCode: string
  inviteExpire: number | null
  myRole: Role
  myVisibility: Visibility
}

export interface Member {
  userId: string
  nickname: string
  avatarEmoji: string | null
  avatarColor: string
  role: Role
  joinedAt: number
}

/** 免登录预览，刻意不含群组 id */
export interface InvitePreview {
  name: string
  memberCount: number
  ownerNickname: string
}

export interface RegisterResult {
  token: string
  user: User
  recoveryCode: string
  joinedGroup: Group | null
}

export interface RecoverResult {
  token: string
  user: User
}

export interface MeResult {
  user: User
  groups: Group[]
}

export type Status = 'day' | 'mid' | 'night' | 'off'
/** 服务端脱敏后可能出现的状态：work = 在上班但不透露班次 */
export type ViewStatus = Status | 'work' | 'unset'

export interface DayMember {
  userId: string
  nickname: string
  avatarEmoji: string | null
  avatarColor: string
  role: Role
  isMe: boolean
  status: ViewStatus
  note: string | null
}

export interface GroupDayResult {
  date: string
  groupId: string
  members: DayMember[]
  summary: { off: number; work: number; unset: number }
}

export interface ScheduleEntry {
  date: string
  status: ViewStatus
  note: string | null
}

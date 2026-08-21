import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { schedulesApi } from '../api/schedules'
import { groupsApi } from '../api/groups'
import { Avatar } from '../components/Avatar'
import { STATUS_STYLES } from '../lib/status'
import { today, addDays, dateRange, weekdayOf, shortLabel } from '../lib/date'
import type { ViewStatus } from '../types/api'
import { card, page, pageBottomPlain } from '../lib/ui'

const PAST_DAYS = 7
const FUTURE_DAYS = 13

export function MemberDetail() {
  const { userId = '' } = useParams()
  const [params] = useSearchParams()
  const groupId = params.get('groupId') ?? ''

  const now = today()
  const from = addDays(now, -PAST_DAYS)
  const to = addDays(now, FUTURE_DAYS)

  const members = useQuery({
    queryKey: ['members', groupId],
    queryFn: () => groupsApi.members(groupId),
    enabled: groupId !== '',
  })

  const schedule = useQuery({
    queryKey: ['memberSchedule', userId, groupId, from, to],
    queryFn: () => schedulesApi.memberRange(userId, groupId, from, to),
    enabled: groupId !== '' && userId !== '',
    retry: false,
  })

  const member = members.data?.members.find((m) => m.userId === userId)

  const byDate = new Map(schedule.data?.entries.map((e) => [e.date, e]) ?? [])

  return (
    <div className={`${page} gap-4 p-6 ${pageBottomPlain}`}>
      <Link to="/" className="text-sm text-ink-soft">
        ← 返回
      </Link>

      {member && (
        <div className="flex items-center gap-4">
          <Avatar
            nickname={member.nickname}
            emoji={member.avatarEmoji}
            color={member.avatarColor}
            size="lg"
          />
          <div>
            <h1 className="text-xl font-semibold">{member.nickname}</h1>
            {member.role === 'owner' && <p className="text-sm text-ink-soft">群主</p>}
          </div>
        </div>
      )}

      {schedule.isLoading && <p className="text-sm text-ink-soft">加载中…</p>}

      {schedule.error && (
        <div className={card}>
          <p className="text-sm text-red-600">
            {schedule.error instanceof Error ? schedule.error.message : '看不到这位成员的作息'}
          </p>
        </div>
      )}

      {schedule.data && (
        <section className={`${card} flex flex-col gap-1`}>
          <p className="mb-2 text-sm text-ink-soft">近两周作息</p>

          {dateRange(from, to).map((date) => {
            const entry = byDate.get(date)
            const status: ViewStatus = entry?.status ?? 'unset'
            const style = STATUS_STYLES[status]
            const isToday = date === now

            return (
              <div
                key={date}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                  isToday ? 'bg-gray-50' : ''
                }`}
              >
                <span className={`w-14 text-sm ${isToday ? 'font-medium' : 'text-ink-soft'}`}>
                  {shortLabel(date, now)}
                </span>
                <span className="w-8 text-xs text-ink-soft">周{weekdayOf(date)}</span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                <span className={`text-sm ${status === 'unset' ? 'text-ink-soft' : ''}`}>
                  {style.label}
                </span>
                {entry?.note && (
                  <span className="ml-auto truncate text-xs text-ink-soft">{entry.note}</span>
                )}
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}

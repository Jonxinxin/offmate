import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schedulesApi } from '../api/schedules'
import { useAuth } from '../hooks/useAuth'
import { useCurrentGroup } from '../hooks/useCurrentGroup'
import { Avatar } from '../components/Avatar'
import { DateStrip } from '../components/DateStrip'
import { MemberCard } from '../components/MemberCard'
import { StatusPicker } from '../components/StatusPicker'
import { Guide, hasSeenGuide, markGuideSeen } from '../components/Guide'
import { groupKeyOf } from '../lib/status'
import { today, addDays, dateRange, formatFull } from '../lib/date'
import type { DayMember, Status } from '../types/api'
import { btnPrimary, card, page, floatingAboveTab, pageBottomFloating, pageBottomTab } from '../lib/ui'

/** 日期条范围：前 1 天 + 今天 + 未来 13 天 */
const STRIP_PAST = 1
const STRIP_FUTURE = 13

const GROUP_TITLES = { off: '休息', work: '上班', unset: '未设置' } as const

export function Home() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const groups = me?.groups ?? []
  const { current, select } = useCurrentGroup(groups)

  const now = today()
  const [selectedDate, setSelectedDate] = useState(now)
  const [switching, setSwitching] = useState(false)
  const [picking, setPicking] = useState(false)
  const [showGuide, setShowGuide] = useState(() => !hasSeenGuide())

  const groupId = current?.id ?? ''
  const stripFrom = addDays(now, -STRIP_PAST)
  const stripTo = addDays(now, STRIP_FUTURE)

  const day = useQuery({
    queryKey: ['groupDay', groupId, selectedDate],
    queryFn: () => schedulesApi.groupDay(groupId, selectedDate),
    enabled: groupId !== '',
  })

  const summary = useQuery({
    queryKey: ['groupSummary', groupId, stripFrom, stripTo],
    queryFn: () => schedulesApi.groupSummary(groupId, stripFrom, stripTo),
    enabled: groupId !== '',
  })

  const refreshDay = () => {
    queryClient.invalidateQueries({ queryKey: ['groupDay', groupId] })
    queryClient.invalidateQueries({ queryKey: ['groupSummary', groupId] })
  }

  const setDay = useMutation({
    mutationFn: ({ status, note }: { status: Status; note: string | null }) =>
      schedulesApi.setDay(selectedDate, status, note),
    onSuccess: refreshDay,
  })

  const clearDay = useMutation({
    mutationFn: () => schedulesApi.clearDay(selectedDate),
    onSuccess: refreshDay,
  })

  if (!me) return null

  // 首次进来自动展开使用说明。放在两个返回分支之外，
  // 这样刚注册、还没有群组的新用户同样能看到。
  const guide = showGuide ? (
    <Guide
      onClose={() => {
        markGuideSeen()
        setShowGuide(false)
      }}
    />
  ) : null

  if (groups.length === 0) {
    return (
      <div className={`${page} justify-between p-6`}>
        <div className="flex flex-col gap-4 pt-10">
          <h1 className="text-2xl font-semibold">OffMate</h1>
          <div className={card}>
            <p className="font-medium">还没有群组</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              创建一个群组，把邀请链接发到微信群，就能看到朋友们今天是上班还是休息。
            </p>
          </div>
        </div>
        <div className={`flex flex-col gap-3 ${pageBottomTab}`}>
          <Link to="/group/create" className={btnPrimary}>
            创建或加入群组
          </Link>
          <Link to="/me" className="text-center text-sm text-ink-soft">
            我的
          </Link>
        </div>
        {guide}
      </div>
    )
  }

  const members = day.data?.members ?? []
  const myEntry = members.find((m) => m.isMe)
  const counts = summary.data?.counts ?? {}

  const buckets: Record<'off' | 'work' | 'unset', DayMember[]> = { off: [], work: [], unset: [] }
  for (const m of members) buckets[groupKeyOf(m.status)].push(m)

  const headline =
    day.data && members.length > 0
      ? [
          day.data.summary.off > 0 ? `${day.data.summary.off} 人休息` : null,
          day.data.summary.work > 0 ? `${day.data.summary.work} 人上班` : null,
        ]
          .filter(Boolean)
          .join('，') || '还没有人设置'
      : ''

  return (
    <div className={`${page} gap-4 p-6 ${pageBottomFloating}`}>
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-1.5 text-lg font-semibold"
          onClick={() => setSwitching(!switching)}
        >
          {current?.name}
          {groups.length > 1 && <span className="text-xs text-ink-soft">▾</span>}
        </button>
        <Link to="/me">
          <Avatar
            nickname={me.user.nickname}
            emoji={me.user.avatarEmoji}
            color={me.user.avatarColor}
          />
        </Link>
      </div>

      {switching && (
        <div className={`${card} flex flex-col gap-1`}>
          {groups.map((g) => (
            <button
              key={g.id}
              className={`rounded-lg px-3 py-2.5 text-left text-sm transition ${
                g.id === current?.id ? 'bg-gray-100 font-medium' : ''
              }`}
              onClick={() => {
                select(g.id)
                setSwitching(false)
              }}
            >
              {g.name}
              <span className="ml-2 text-xs text-ink-soft">{g.memberCount} 人</span>
            </button>
          ))}
          <Link
            to="/group/create"
            className="rounded-lg px-3 py-2.5 text-left text-sm text-ink-soft"
          >
            ＋ 创建或加入群组
          </Link>
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">{formatFull(selectedDate)}</h2>
          {selectedDate !== now && (
            <button className="text-sm text-ink-soft" onClick={() => setSelectedDate(now)}>
              回到今天
            </button>
          )}
        </div>
        {headline && <p className="mt-0.5 text-sm text-ink-soft">{headline}</p>}
      </div>

      <DateStrip
        dates={dateRange(stripFrom, stripTo)}
        selected={selectedDate}
        today={now}
        counts={counts}
        onSelect={setSelectedDate}
      />

      {day.isLoading && <p className="text-sm text-ink-soft">加载中…</p>}

      {day.error && (
        <div className={card}>
          <p className="text-sm text-red-600">
            {day.error instanceof Error ? day.error.message : '加载失败'}
          </p>
          <button className="mt-2 text-sm text-ink-soft" onClick={() => day.refetch()}>
            重试
          </button>
        </div>
      )}

      {(['off', 'work', 'unset'] as const).map((key) =>
        buckets[key].length === 0 ? null : (
          <section key={key} className="flex flex-col gap-2">
            <p className="text-sm text-ink-soft">
              {GROUP_TITLES[key]} · {buckets[key].length} 人
            </p>
            {buckets[key].map((m) => (
              <MemberCard
                key={m.userId}
                member={m}
                // 点自己是改状态，点别人是看近期作息
                onClick={() =>
                  m.isMe
                    ? setPicking(true)
                    : navigate(`/member/${m.userId}?groupId=${groupId}`)
                }
              />
            ))}
          </section>
        ),
      )}

      {myEntry && (
        <button
          className={`${btnPrimary} ${floatingAboveTab} shadow-lg`}
          onClick={() => setPicking(true)}
        >
          设置我{selectedDate === now ? '今天' : '这天'}的状态
        </button>
      )}

      {picking && myEntry && (
        <StatusPicker
          date={selectedDate}
          current={myEntry.status}
          currentNote={myEntry.note}
          onPick={(status, note) => setDay.mutate({ status, note })}
          onClear={() => {
            clearDay.mutate()
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {guide}
    </div>
  )
}

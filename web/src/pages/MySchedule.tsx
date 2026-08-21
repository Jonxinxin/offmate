import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schedulesApi } from '../api/schedules'
import { MonthCalendar } from '../components/MonthCalendar'
import { StatusPicker } from '../components/StatusPicker'
import { STATUS_STYLES, SELECTABLE_STATUSES } from '../lib/status'
import {
  today,
  addDays,
  addMonths,
  monthStart,
  monthGrid,
  formatMonth,
  isSameMonth,
  weekStart,
  dateRange,
  weekdayOf,
  shortLabel,
} from '../lib/date'
import type { Status, ViewStatus } from '../types/api'
import { btnGhost, btnPrimary, card, page, floatingAboveTab, pageBottomFloatingTall } from '../lib/ui'

type View = 'month' | 'week'

export function MySchedule() {
  const queryClient = useQueryClient()
  const now = today()

  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(monthStart(now))
  const [weekAnchor, setWeekAnchor] = useState(weekStart(now))
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)

  // 月视图要多查前后补齐的日期，否则网格首尾几天没有数据
  const grid = monthGrid(anchor)
  const from = view === 'month' ? grid[0] : weekAnchor
  const to = view === 'month' ? grid[41] : addDays(weekAnchor, 6)

  const schedule = useQuery({
    queryKey: ['mySchedule', from, to],
    queryFn: () => schedulesApi.myRange(from, to),
  })

  const statuses = useMemo(() => {
    const map = new Map<string, ViewStatus>()
    for (const e of schedule.data?.entries ?? []) map.set(e.date, e.status)
    return map
  }, [schedule.data])

  const notes = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of schedule.data?.entries ?? []) if (e.note) map.set(e.date, e.note)
    return map
  }, [schedule.data])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['mySchedule'] })
    // 首页和日期条也会变
    queryClient.invalidateQueries({ queryKey: ['groupDay'] })
    queryClient.invalidateQueries({ queryKey: ['groupSummary'] })
  }

  const setOne = useMutation({
    mutationFn: ({ date, status, note }: { date: string; status: Status; note: string | null }) =>
      schedulesApi.setDay(date, status, note),
    onSuccess: invalidate,
  })

  const clearOne = useMutation({
    mutationFn: (date: string) => schedulesApi.clearDay(date),
    onSuccess: invalidate,
  })

  const setMany = useMutation({
    mutationFn: (status: Status) => schedulesApi.setDays([...selected], status),
    onSuccess: () => {
      invalidate()
      setSelected(new Set())
      setSelecting(false)
    },
  })

  function toggle(date: string) {
    if (!selecting) {
      setEditing(date)
      return
    }
    const next = new Set(selected)
    if (next.has(date)) next.delete(date)
    else next.add(date)
    setSelected(next)
  }

  /** 快捷选择：本月剩余（含今天），只在当前显示的月份内 */
  function selectRestOfMonth() {
    const dates = grid.filter((d) => isSameMonth(d, anchor) && d >= now)
    setSelected(new Set(dates))
  }

  function selectThisWeek() {
    const start = view === 'week' ? weekAnchor : weekStart(now)
    setSelected(new Set(dateRange(start, addDays(start, 6))))
  }

  const weekDates = dateRange(weekAnchor, addDays(weekAnchor, 6))

  return (
    <div className={`${page} gap-4 p-6 ${pageBottomFloatingTall}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">我的作息</h1>
        <div className="flex gap-1 rounded-lg bg-white p-1">
          {(['month', 'week'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-sm transition ${
                view === v ? 'bg-ink text-white' : 'text-ink-soft'
              }`}
            >
              {v === 'month' ? '月' : '周'}
            </button>
          ))}
        </div>
      </div>

      <div className={card}>
        {view === 'month' ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <button
                className="px-2 py-1 text-ink-soft"
                onClick={() => setAnchor(addMonths(anchor, -1))}
              >
                ‹
              </button>
              <span className="font-medium">{formatMonth(anchor)}</span>
              <button
                className="px-2 py-1 text-ink-soft"
                onClick={() => setAnchor(addMonths(anchor, 1))}
              >
                ›
              </button>
            </div>

            <MonthCalendar
              anchor={anchor}
              today={now}
              statuses={statuses}
              selected={selected}
              selecting={selecting}
              onPick={toggle}
            />
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <button
                className="px-2 py-1 text-ink-soft"
                onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}
              >
                ‹
              </button>
              <span className="font-medium">
                {weekAnchor.slice(5).replace('-', '/')} – {addDays(weekAnchor, 6).slice(5).replace('-', '/')}
              </span>
              <button
                className="px-2 py-1 text-ink-soft"
                onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
              >
                ›
              </button>
            </div>

            <div className="flex flex-col gap-1">
              {weekDates.map((date) => {
                const status = statuses.get(date) ?? 'unset'
                const style = STATUS_STYLES[status]
                const isToday = date === now
                const isSelected = selected.has(date)

                return (
                  <button
                    key={date}
                    onClick={() => toggle(date)}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
                      isSelected ? 'border-ink bg-gray-100' : 'border-transparent'
                    } ${status !== 'unset' ? style.soft : ''}`}
                  >
                    <span className={`w-12 text-sm ${isToday ? 'font-semibold' : 'text-ink-soft'}`}>
                      {shortLabel(date, now)}
                    </span>
                    <span className="w-8 text-xs text-ink-soft">周{weekdayOf(date)}</span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <span className={`text-sm ${status === 'unset' ? 'text-ink-soft' : ''}`}>
                      {style.label}
                    </span>
                    {notes.get(date) && (
                      <span className="ml-auto truncate text-xs text-ink-soft">
                        {notes.get(date)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {selecting ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button className="flex-1 rounded-lg bg-white py-2 text-sm" onClick={selectThisWeek}>
              选中这一周
            </button>
            {view === 'month' && (
              <button className="flex-1 rounded-lg bg-white py-2 text-sm" onClick={selectRestOfMonth}>
                本月剩余
              </button>
            )}
            <button
              className="flex-1 rounded-lg bg-white py-2 text-sm text-ink-soft"
              onClick={() => setSelected(new Set())}
            >
              清空
            </button>
          </div>
          <p className="text-center text-xs text-ink-soft">点日期可加选或取消</p>
        </div>
      ) : (
        <p className="text-center text-xs text-ink-soft">点某一天可以修改状态</p>
      )}

      {setMany.error && (
        <p className="text-sm text-red-600">
          {setMany.error instanceof Error ? setMany.error.message : '批量设置失败'}
        </p>
      )}

      {/* 底部操作条 */}
      <div className={floatingAboveTab}>
        {selecting ? (
          selected.size === 0 ? (
            <button
              className={btnGhost}
              onClick={() => {
                setSelecting(false)
                setSelected(new Set())
              }}
            >
              退出批量设置
            </button>
          ) : (
            <div className="rounded-2xl bg-white p-3 shadow-lg">
              <p className="mb-2 text-center text-sm">
                已选 <span className="font-semibold">{selected.size}</span> 天，设为
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {SELECTABLE_STATUSES.map((s) => (
                  <button
                    key={s}
                    disabled={setMany.isPending}
                    onClick={() => setMany.mutate(s)}
                    className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 py-2 text-xs active:scale-95"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[s].dot}`} />
                    {STATUS_STYLES[s].label}
                  </button>
                ))}
              </div>
            </div>
          )
        ) : (
          <button className={btnPrimary} onClick={() => setSelecting(true)}>
            批量设置
          </button>
        )}
      </div>

      {editing && (
        <StatusPicker
          date={editing}
          current={statuses.get(editing) ?? 'unset'}
          currentNote={notes.get(editing) ?? null}
          onPick={(status, note) => {
            setOne.mutate({ date: editing, status, note })
            setEditing(null)
          }}
          onClear={() => {
            clearOne.mutate(editing)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

import type { ViewStatus } from '../types/api'
import { STATUS_STYLES } from '../lib/status'
import { monthGrid, isSameMonth, isWeekend } from '../lib/date'

interface MonthCalendarProps {
  anchor: string
  today: string
  /** 日期 → 状态 */
  statuses: Map<string, ViewStatus>
  selected: Set<string>
  selecting: boolean
  onPick: (date: string) => void
}

const WEEK_HEADS = ['一', '二', '三', '四', '五', '六', '日']

export function MonthCalendar({
  anchor,
  today,
  statuses,
  selected,
  selecting,
  onPick,
}: MonthCalendarProps) {
  return (
    <div>
      <div className="mb-1 grid grid-cols-7">
        {WEEK_HEADS.map((w, i) => (
          <div
            key={w}
            className={`py-1.5 text-center text-xs ${i >= 5 ? 'text-status-day' : 'text-ink-soft'}`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {monthGrid(anchor).map((date) => {
          const inMonth = isSameMonth(date, anchor)
          const status = statuses.get(date) ?? 'unset'
          const style = STATUS_STYLES[status]
          const isToday = date === today
          const isSelected = selected.has(date)
          const day = Number(date.split('-')[2])

          return (
            <button
              key={date}
              onClick={() => onPick(date)}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border transition ${
                isSelected
                  ? 'border-ink bg-gray-100'
                  : isToday
                    ? 'border-ink/40'
                    : 'border-transparent'
              } ${status !== 'unset' && inMonth ? style.soft : ''} ${
                inMonth ? '' : 'opacity-30'
              } ${selecting ? 'active:scale-95' : ''}`}
            >
              <span
                className={`text-sm ${isToday ? 'font-semibold' : ''} ${
                  isWeekend(date) && status === 'unset' ? 'text-ink-soft' : ''
                }`}
              >
                {day}
              </span>
              {status === 'unset' ? (
                <span className="h-1.5" />
              ) : (
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

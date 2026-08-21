import { useEffect, useRef } from 'react'
import { shortLabel, weekdayOf, isWeekend } from '../lib/date'

interface DateStripProps {
  dates: string[]
  selected: string
  today: string
  /** 每日休息人数，用于下方的小圆点提示 */
  counts: Record<string, number>
  onSelect: (date: string) => void
}

/** 圆点最多画 3 个，再多显示 3+，否则窄屏会被撑破 */
function OffDots({ count }: { count: number }) {
  if (count === 0) return <span className="h-1.5" />
  if (count > 3) {
    return <span className="text-[10px] leading-none text-status-off">3+</span>
  }
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-status-off" />
      ))}
    </span>
  )
}

export function DateStrip({ dates, selected, today, counts, onSelect }: DateStripProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLButtonElement>(null)

  // 进入时把"今天"滚到视野内。日期条前面还有昨天，不滚的话今天会贴在左边缘。
  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [])

  return (
    <div ref={scroller} className="-mx-6 overflow-x-auto px-6 [scrollbar-width:none]">
      <div className="flex gap-1.5">
        {dates.map((date) => {
          const active = date === selected
          const weekend = isWeekend(date)

          return (
            <button
              key={date}
              ref={date === today ? todayRef : undefined}
              onClick={() => onSelect(date)}
              className={`flex w-12 shrink-0 flex-col items-center gap-1 rounded-xl py-2 transition ${
                active ? 'bg-ink text-white' : 'bg-white'
              }`}
            >
              <span
                className={`text-[11px] ${
                  active ? 'text-white/70' : weekend ? 'text-status-day' : 'text-ink-soft'
                }`}
              >
                周{weekdayOf(date)}
              </span>
              <span className="text-sm font-medium">{shortLabel(date, today)}</span>
              <OffDots count={counts[date] ?? 0} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

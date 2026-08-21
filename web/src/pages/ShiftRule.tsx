import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rulesApi } from '../api/rules'
import { STATUS_STYLES, SELECTABLE_STATUSES } from '../lib/status'
import { today } from '../lib/date'
import type { Status } from '../types/api'
import { btnDanger, btnGhost, btnPrimary, card, page, pageBottomPlain } from '../lib/ui'

export function ShiftRule() {
  const queryClient = useQueryClient()
  const [custom, setCustom] = useState<Status[]>(['day', 'day', 'off'])
  const [editingCustom, setEditingCustom] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)

  const presets = useQuery({ queryKey: ['presets'], queryFn: rulesApi.presets })
  const mine = useQuery({ queryKey: ['myRule'], queryFn: rulesApi.mine })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['myRule'] })
    queryClient.invalidateQueries({ queryKey: ['mySchedule'] })
    queryClient.invalidateQueries({ queryKey: ['groupDay'] })
    queryClient.invalidateQueries({ queryKey: ['groupSummary'] })
  }

  const apply = useMutation({
    mutationFn: (body: Parameters<typeof rulesApi.save>[0]) => rulesApi.save(body),
    onSuccess: () => {
      invalidate()
      setEditingCustom(false)
    },
  })

  const stop = useMutation({
    mutationFn: (clearGenerated: boolean) => rulesApi.stop(clearGenerated),
    onSuccess: () => {
      invalidate()
      setConfirmStop(false)
    },
  })

  const rule = mine.data?.rule

  return (
    <div className={`${page} gap-4 p-6 ${pageBottomPlain}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">排班规律</h1>
        <Link to="/me" className="text-sm text-ink-soft">
          返回
        </Link>
      </div>

      <p className="text-sm leading-relaxed text-ink-soft">
        设置一次，未来一年的作息自动填好。你手动改过的日期不会被覆盖。
      </p>

      {rule && (
        <section className={`${card} flex flex-col gap-3`}>
          <div>
            <p className="text-sm text-ink-soft">当前规律</p>
            <p className="mt-0.5 text-lg font-medium">{rule.name}</p>
            {rule.pattern.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {rule.pattern.map((s, i) => (
                  <span
                    key={i}
                    className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[s].soft}`}
                  >
                    {STATUS_STYLES[s].label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {confirmStop ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-soft">已经生成的作息要怎么处理？</p>
              <button
                className={btnGhost}
                disabled={stop.isPending}
                onClick={() => stop.mutate(false)}
              >
                保留已生成的作息
              </button>
              <button
                className={btnDanger}
                disabled={stop.isPending}
                onClick={() => stop.mutate(true)}
              >
                一并清除（手动改过的会保留）
              </button>
              <button className="text-sm text-ink-soft" onClick={() => setConfirmStop(false)}>
                取消
              </button>
            </div>
          ) : (
            <button className={btnGhost} onClick={() => setConfirmStop(true)}>
              停用规律
            </button>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-ink-soft">选一个常见规律</h2>
        {presets.data?.presets.map((p) => (
          <button
            key={p.key}
            disabled={apply.isPending}
            onClick={() => apply.mutate({ type: 'preset', presetKey: p.key, anchorDate: today() })}
            className={`${card} text-left transition active:scale-[0.99] ${
              rule?.presetKey === p.key ? 'ring-2 ring-ink' : ''
            }`}
          >
            <p className="font-medium">{p.name}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{p.desc}</p>
          </button>
        ))}
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <div>
          <h2 className="font-medium">自定义循环</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            按你的实际循环逐天设置，从今天开始重复
          </p>
        </div>

        {editingCustom ? (
          <>
            <div className="flex flex-col gap-1.5">
              {custom.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-12 text-sm text-ink-soft">第 {i + 1} 天</span>
                  <div className="flex flex-1 gap-1">
                    {SELECTABLE_STATUSES.map((option) => (
                      <button
                        key={option}
                        onClick={() =>
                          setCustom(custom.map((v, idx) => (idx === i ? option : v)))
                        }
                        className={`flex-1 rounded-lg py-1.5 text-xs transition ${
                          s === option
                            ? `${STATUS_STYLES[option].soft} ring-1 ring-ink`
                            : 'bg-gray-50 text-ink-soft'
                        }`}
                      >
                        {STATUS_STYLES[option].label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg bg-gray-50 py-2 text-sm disabled:opacity-40"
                disabled={custom.length <= 2}
                onClick={() => setCustom(custom.slice(0, -1))}
              >
                减一天
              </button>
              <button
                className="flex-1 rounded-lg bg-gray-50 py-2 text-sm disabled:opacity-40"
                disabled={custom.length >= 14}
                onClick={() => setCustom([...custom, 'off'])}
              >
                加一天
              </button>
            </div>

            <button
              className={btnPrimary}
              disabled={apply.isPending || !custom.includes('off')}
              onClick={() => apply.mutate({ type: 'custom', pattern: custom, anchorDate: today() })}
            >
              {apply.isPending ? '生成中…' : `应用 ${custom.length} 天循环`}
            </button>
            {!custom.includes('off') && (
              <p className="text-center text-xs text-ink-soft">循环里至少要有一天休息</p>
            )}
            <button className="text-sm text-ink-soft" onClick={() => setEditingCustom(false)}>
              取消
            </button>
          </>
        ) : (
          <button className={btnGhost} onClick={() => setEditingCustom(true)}>
            设置自定义循环
          </button>
        )}
      </section>

      {(apply.error || stop.error) && (
        <p className="text-sm text-red-600">
          {(apply.error ?? stop.error) instanceof Error
            ? (apply.error ?? stop.error)!.message
            : '操作失败'}
        </p>
      )}
    </div>
  )
}

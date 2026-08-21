import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { groupsApi } from '../api/groups'
import { useAuth } from '../hooks/useAuth'
import { btnPrimary, btnGhost, card, input, page } from '../lib/ui'

export function GroupCreate() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<'create' | 'join'>('create')

  const create = useMutation({
    mutationFn: () => groupsApi.create(name.trim()),
    onSuccess: (data) => {
      refresh()
      navigate(`/group/${data.group.id}`, { replace: true })
    },
  })

  const join = useMutation({
    mutationFn: () => groupsApi.join(code.trim()),
    onSuccess: () => {
      refresh()
      navigate('/', { replace: true })
    },
  })

  const active = mode === 'create' ? create : join
  const canSubmit =
    mode === 'create' ? name.trim().length > 0 : code.trim().length > 0

  return (
    <div className={`${page} justify-between p-6`}>
      <div className="flex flex-col gap-5 pt-6">
        <h1 className="text-xl font-semibold">添加群组</h1>

        <div className="flex gap-2">
          <button
            onClick={() => setMode('create')}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              mode === 'create' ? 'bg-ink text-white' : 'bg-white text-ink'
            }`}
          >
            创建新群组
          </button>
          <button
            onClick={() => setMode('join')}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              mode === 'join' ? 'bg-ink text-white' : 'bg-white text-ink'
            }`}
          >
            输入邀请码
          </button>
        </div>

        <div className={card}>
          {mode === 'create' ? (
            <>
              <label className="mb-1.5 block text-sm text-ink-soft">群组名称</label>
              <input
                className={input}
                value={name}
                maxLength={16}
                placeholder="例如：摸鱼小分队"
                onChange={(e) => setName(e.target.value)}
              />
            </>
          ) : (
            <>
              <label className="mb-1.5 block text-sm text-ink-soft">邀请码</label>
              <input
                className={`${input} text-center font-mono tracking-widest`}
                value={code}
                maxLength={6}
                placeholder="6 位邀请码"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoComplete="off"
              />
            </>
          )}
        </div>

        {active.error && (
          <p className="text-sm text-red-600">
            {active.error instanceof Error ? active.error.message : '操作失败'}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button
          className={btnPrimary}
          disabled={!canSubmit || active.isPending}
          onClick={() => (mode === 'create' ? create.mutate() : join.mutate())}
        >
          {active.isPending ? '处理中…' : mode === 'create' ? '创建' : '加入'}
        </button>
        <button className={btnGhost} onClick={() => navigate(-1)}>
          取消
        </button>
      </div>
    </div>
  )
}

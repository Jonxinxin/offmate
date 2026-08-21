import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { groupsApi } from '../api/groups'
import { useAuth } from '../hooks/useAuth'
import { QrCode } from '../components/QrCode'
import type { Visibility } from '../types/api'
import { btnDanger, btnGhost, btnPrimary, card, input, page, pageBottomPlain } from '../lib/ui'

const VISIBILITY_LABELS: Record<Visibility, { title: string; desc: string }> = {
  full: { title: '显示具体班次', desc: '群里能看到你是白班、中班还是晚班' },
  busy_only: { title: '只显示忙闲', desc: '群里只知道你上班还是休息，看不到具体班次' },
  hidden: { title: '完全隐藏', desc: '你的作息对这个群显示为未设置' },
}

export function GroupDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refresh } = useAuth()

  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [copyHint, setCopyHint] = useState<string | null>(null)
  const [confirmDanger, setConfirmDanger] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['group', id],
    queryFn: () => groupsApi.detail(id),
    retry: false,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['group', id] })

  const rename = useMutation({
    mutationFn: () => groupsApi.rename(id, newName.trim()),
    onSuccess: () => {
      setRenaming(false)
      invalidate()
      refresh()
    },
  })

  const refreshInvite = useMutation({
    mutationFn: () => groupsApi.refreshInvite(id),
    onSuccess: invalidate,
  })

  const setVisibility = useMutation({
    mutationFn: (v: Visibility) => groupsApi.setVisibility(id, v),
    onSuccess: invalidate,
  })

  const leave = useMutation({
    mutationFn: () => groupsApi.leave(id),
    onSuccess: () => {
      refresh()
      navigate('/', { replace: true })
    },
  })

  const dissolve = useMutation({
    mutationFn: () => groupsApi.dissolve(id),
    onSuccess: () => {
      refresh()
      navigate('/', { replace: true })
    },
  })

  if (isLoading) {
    return <div className={`${page} p-6 text-sm text-ink-soft`}>加载中…</div>
  }

  if (error || !data) {
    return (
      <div className={`${page} gap-4 p-6 pt-16`}>
        <h1 className="text-xl font-semibold">看不到这个群组</h1>
        <p className="text-sm text-ink-soft">
          它可能已被解散，或者你已不在群里。
        </p>
        <Link to="/" className={btnGhost}>
          回到首页
        </Link>
      </div>
    )
  }

  const { group, inviteUrl } = data
  const isOwner = group.myRole === 'owner'

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopyHint('链接已复制，发到群里就行')
    } catch {
      setCopyHint('复制失败，请长按下方链接手动复制')
    }
  }

  return (
    <div className={`${page} gap-4 p-6 ${pageBottomPlain}`}>
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-ink-soft">
          ← 返回
        </Link>
        <Link to={`/group/${id}/members`} className="text-sm text-ink-soft">
          成员 {group.memberCount}
        </Link>
      </div>

      <section className={card}>
        {renaming ? (
          <div className="flex flex-col gap-3">
            <input
              className={input}
              value={newName}
              maxLength={16}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                className={btnPrimary}
                disabled={newName.trim().length === 0 || rename.isPending}
                onClick={() => rename.mutate()}
              >
                保存
              </button>
              <button className={btnGhost} onClick={() => setRenaming(false)}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{group.name}</h1>
            {isOwner && (
              <button
                className="text-sm text-ink-soft"
                onClick={() => {
                  setNewName(group.name)
                  setRenaming(true)
                }}
              >
                改名
              </button>
            )}
          </div>
        )}
      </section>

      <section className={`${card} flex flex-col items-center gap-4`}>
        <h2 className="self-start font-medium">邀请朋友</h2>
        <QrCode value={inviteUrl} />
        <p className="w-full break-all rounded-lg bg-gray-50 p-3 text-center font-mono text-xs text-ink-soft">
          {inviteUrl}
        </p>
        <button className={btnPrimary} onClick={copyInvite}>
          复制邀请链接
        </button>
        {copyHint && <p className="text-xs text-ink-soft">{copyHint}</p>}

        <div className="w-full border-t border-gray-100 pt-3 text-center">
          <p className="font-mono text-lg tracking-widest">{group.inviteCode}</p>
          <p className="mt-1 text-xs text-ink-soft">
            也可以让对方直接输入这个邀请码
          </p>
        </div>

        {isOwner && (
          <button
            className={btnGhost}
            disabled={refreshInvite.isPending}
            onClick={() => refreshInvite.mutate()}
          >
            {refreshInvite.isPending ? '更换中…' : '更换邀请码（旧的立即失效）'}
          </button>
        )}
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <div>
          <h2 className="font-medium">我在这个群的可见范围</h2>
          <p className="mt-1 text-sm text-ink-soft">
            每个群可以单独设置，互不影响。
          </p>
        </div>
        {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((v) => (
          <button
            key={v}
            onClick={() => setVisibility.mutate(v)}
            className={`rounded-xl border p-3 text-left transition ${
              group.myVisibility === v
                ? 'border-ink bg-gray-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <p className="text-sm font-medium">{VISIBILITY_LABELS[v].title}</p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {VISIBILITY_LABELS[v].desc}
            </p>
          </button>
        ))}
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        {isOwner ? (
          <>
            <div>
              <h2 className="font-medium">解散群组</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                所有成员都会失去这个群，操作无法撤销。大家各自的作息记录不会被删除。
                如果只是想退出，可以先把群主转让给别人。
              </p>
            </div>
            {confirmDanger ? (
              <div className="flex flex-col gap-2">
                <button
                  className={btnDanger}
                  disabled={dissolve.isPending}
                  onClick={() => dissolve.mutate()}
                >
                  {dissolve.isPending ? '解散中…' : '确认解散'}
                </button>
                <button className={btnGhost} onClick={() => setConfirmDanger(false)}>
                  取消
                </button>
              </div>
            ) : (
              <button className={btnDanger} onClick={() => setConfirmDanger(true)}>
                解散群组
              </button>
            )}
          </>
        ) : (
          <>
            <div>
              <h2 className="font-medium">退出群组</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                退出后看不到这个群的作息，你自己的记录会保留。
              </p>
            </div>
            {confirmDanger ? (
              <div className="flex flex-col gap-2">
                <button
                  className={btnDanger}
                  disabled={leave.isPending}
                  onClick={() => leave.mutate()}
                >
                  {leave.isPending ? '退出中…' : '确认退出'}
                </button>
                <button className={btnGhost} onClick={() => setConfirmDanger(false)}>
                  取消
                </button>
              </div>
            ) : (
              <button className={btnDanger} onClick={() => setConfirmDanger(true)}>
                退出群组
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
}

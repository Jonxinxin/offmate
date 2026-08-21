import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { groupsApi } from '../api/groups'
import { authApi } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import { EmojiPicker } from '../components/EmojiPicker'
import { Avatar } from '../components/Avatar'
import { NICKNAME_MAX } from '../lib/constants'
import { ApiError } from '../lib/request'
import { btnGhost, btnPrimary, card, input, page } from '../lib/ui'

/**
 * 邀请落地页 /join/:code —— 朋友从微信点进来的第一屏。
 *
 * 已登录直接加入；未登录则合并"注册 + 入群"为一步，少一次往返。
 */
export function Join() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { me, signIn, refresh } = useAuth()

  const [nickname, setNickname] = useState('')
  const [emoji, setEmoji] = useState<string | null>(null)

  const preview = useQuery({
    queryKey: ['invitePreview', code],
    queryFn: () => groupsApi.preview(code),
    retry: false,
  })

  const joinAsExisting = useMutation({
    mutationFn: () => groupsApi.join(code),
    onSuccess: () => {
      refresh()
      navigate('/', { replace: true })
    },
  })

  const registerAndJoin = useMutation({
    mutationFn: () =>
      authApi.register({ nickname: nickname.trim(), avatarEmoji: emoji, inviteCode: code }),
    onSuccess: (data) => {
      signIn(data.token)
      navigate('/recovery-code', { replace: true, state: { code: data.recoveryCode } })
    },
  })

  if (preview.isLoading) {
    return <div className={`${page} p-6 text-sm text-ink-soft`}>加载中…</div>
  }

  if (preview.error) {
    const message =
      preview.error instanceof ApiError ? preview.error.message : '邀请链接无法打开'
    return (
      <div className={`${page} gap-4 p-6 pt-16`}>
        <h1 className="text-xl font-semibold">{message}</h1>
        <p className="text-sm text-ink-soft">
          可以找邀请你的人重新发一个链接。
        </p>
        <Link to="/" className={btnGhost}>
          回到首页
        </Link>
      </div>
    )
  }

  const group = preview.data!
  const alreadyIn = me?.groups.some((g) => g.name === group.name) ?? false

  return (
    <div className={`${page} justify-between p-6`}>
      <div className="flex flex-col gap-6 pt-10">
        <div>
          <p className="text-sm text-ink-soft">
            {group.ownerNickname} 邀请你加入
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{group.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            已有 {group.memberCount} 人
          </p>
        </div>

        {me ? (
          <div className={`${card} text-sm`}>
            以 <span className="font-medium">{me.user.nickname}</span> 的身份加入
            {alreadyIn && (
              <p className="mt-1 text-ink-soft">你可能已经在这个群里了</p>
            )}
          </div>
        ) : (
          <div className={`${card} flex flex-col gap-5`}>
            <div className="flex items-center gap-4">
              <Avatar nickname={nickname || '?'} emoji={emoji} color="#9CA3AF" size="lg" />
              <div className="flex-1">
                <label className="mb-1.5 block text-sm text-ink-soft">
                  你的昵称
                </label>
                <input
                  className={input}
                  value={nickname}
                  maxLength={NICKNAME_MAX}
                  placeholder="群里的朋友怎么称呼你"
                  onChange={(e) => setNickname(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm text-ink-soft">选个头像（可跳过）</p>
              <EmojiPicker value={emoji} onChange={setEmoji} />
            </div>
          </div>
        )}

        {(joinAsExisting.error || registerAndJoin.error) && (
          <p className="text-sm text-red-600">
            {(joinAsExisting.error ?? registerAndJoin.error) instanceof Error
              ? (joinAsExisting.error ?? registerAndJoin.error)!.message
              : '加入失败'}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {me ? (
          <button
            className={btnPrimary}
            disabled={joinAsExisting.isPending}
            onClick={() => joinAsExisting.mutate()}
          >
            {joinAsExisting.isPending ? '加入中…' : '加入群组'}
          </button>
        ) : (
          <>
            <button
              className={btnPrimary}
              disabled={nickname.trim().length === 0 || registerAndJoin.isPending}
              onClick={() => registerAndJoin.mutate()}
            >
              {registerAndJoin.isPending ? '加入中…' : '加入群组'}
            </button>
            {/*
              微信内置浏览器和系统浏览器的存储互相隔离，同一个人换个入口打开就会
              被当成新访客。这个入口是避免群里出现重复账号的关键，不能藏起来。
            */}
            <Link to="/recovery" className="text-center text-sm text-ink-soft">
              用过 OffMate？用恢复码登录，别重复注册
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/auth'

import { useAuth } from '../hooks/useAuth'
import { EmojiPicker } from '../components/EmojiPicker'
import { Avatar } from '../components/Avatar'
import { NICKNAME_MAX } from '../lib/constants'
import { btnPrimary, card, input, page } from '../lib/ui'

/** 首次进入：填昵称即可开始。邀请码通过 ?code= 携带（M2 接入入群逻辑）。 */
export function Welcome() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [params] = useSearchParams()
  const inviteCode = params.get('code') ?? undefined

  const [nickname, setNickname] = useState('')
  const [emoji, setEmoji] = useState<string | null>(null)

  const register = useMutation({
    mutationFn: () => authApi.register({ nickname: nickname.trim(), avatarEmoji: emoji, inviteCode }),
    onSuccess: (data) => {
      signIn(data.token)
      // 恢复码只在内存里传递到下一页，绝不写入 localStorage
      navigate('/recovery-code', { replace: true, state: { code: data.recoveryCode } })
    },
  })

  const canSubmit = nickname.trim().length > 0 && !register.isPending

  return (
    <div className={`${page} justify-between p-6`}>
      <div className="flex flex-col gap-6 pt-10">
        <div>
          <h1 className="text-2xl font-semibold">OffMate</h1>
          <p className="mt-1 text-sm text-ink-soft">打开就知道今天谁有空</p>
        </div>

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
                placeholder="朋友怎么称呼你"
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

        {register.error && (
          <p className="text-sm text-red-600">
            {register.error instanceof Error ? register.error.message : '创建失败'}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button
          className={btnPrimary}
          disabled={!canSubmit}
          onClick={() => register.mutate()}
        >
          {register.isPending ? '创建中…' : '开始使用'}
        </button>
        <Link to="/recovery" className="text-center text-sm text-ink-soft">
          用过 OffMate？用恢复码登录
        </Link>
      </div>
    </div>
  )
}

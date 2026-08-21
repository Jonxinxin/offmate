import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from '../components/Avatar'
import { EmojiPicker } from '../components/EmojiPicker'
import { Guide } from '../components/Guide'
import { NICKNAME_MAX } from '../lib/constants'
import { btnDanger, btnGhost, btnPrimary, card, input, page, pageBottomTab } from '../lib/ui'

export function Me() {
  const navigate = useNavigate()
  const { me, refresh, logout } = useAuth()
  const user = me?.user

  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [emoji, setEmoji] = useState<string | null>(user?.avatarEmoji ?? null)
  const [newCode, setNewCode] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  const save = useMutation({
    mutationFn: () => authApi.updateMe({ nickname: nickname.trim(), avatarEmoji: emoji }),
    onSuccess: refresh,
  })

  const resetCode = useMutation({
    mutationFn: authApi.resetRecoveryCode,
    onSuccess: (data) => setNewCode(data.recoveryCode),
  })

  const removeAccount = useMutation({
    mutationFn: authApi.deleteMe,
    onSuccess: () => {
      logout()
      navigate('/welcome', { replace: true })
    },
  })

  if (!user) return null

  const dirty = nickname.trim() !== user.nickname || emoji !== user.avatarEmoji

  return (
    <div className={`${page} gap-4 p-6 ${pageBottomTab}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">我的</h1>
        <Link to="/" className="text-sm text-ink-soft">
          返回首页
        </Link>
      </div>

      <section className={`${card} flex flex-col gap-5`}>
        <div className="flex items-center gap-4">
          <Avatar nickname={nickname || user.nickname} emoji={emoji} color={user.avatarColor} size="lg" />
          <div className="flex-1">
            <label className="mb-1.5 block text-sm text-ink-soft">昵称</label>
            <input
              className={input}
              value={nickname}
              maxLength={NICKNAME_MAX}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-ink-soft">头像</p>
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </div>

        <button
          className={btnPrimary}
          disabled={!dirty || nickname.trim().length === 0 || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? '保存中…' : dirty ? '保存' : '已保存'}
        </button>

        {save.error && (
          <p className="text-sm text-red-600">
            {save.error instanceof Error ? save.error.message : '保存失败'}
          </p>
        )}
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-medium">我的群组</h2>
        {me.groups.length === 0 ? (
          <p className="text-sm text-ink-soft">还没有加入任何群组</p>
        ) : (
          <div className="flex flex-col gap-1">
            {me.groups.map((g) => (
              <Link
                key={g.id}
                to={`/group/${g.id}`}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm"
              >
                <span>{g.name}</span>
                <span className="text-xs text-ink-soft">{g.memberCount} 人 ›</span>
              </Link>
            ))}
          </div>
        )}
        <Link to="/group/create" className={btnGhost}>
          创建或加入群组
        </Link>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <div>
          <h2 className="font-medium">使用说明</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            四页看完怎么用，包括恢复码为什么重要。
          </p>
        </div>
        <button className={btnGhost} onClick={() => setShowGuide(true)}>
          查看使用说明
        </button>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <div>
          <h2 className="font-medium">排班规律</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            做五休二、三班倒这类固定规律，设置一次就能自动填满未来一年。
          </p>
        </div>
        <Link to="/rule" className={btnGhost}>
          设置排班规律
        </Link>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <div>
          <h2 className="font-medium">恢复码</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            换手机或换浏览器时用它找回身份。重新生成后，旧的恢复码会立刻失效。
          </p>
        </div>

        {newCode ? (
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="select-all text-center font-mono text-xl font-semibold tracking-widest">
              {newCode}
            </p>
            <p className="mt-2 text-center text-xs text-amber-900">
              请立刻保存，关掉这个页面就看不到了
            </p>
          </div>
        ) : (
          <button
            className={btnGhost}
            disabled={resetCode.isPending}
            onClick={() => resetCode.mutate()}
          >
            {resetCode.isPending ? '生成中…' : '重新生成恢复码'}
          </button>
        )}
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <div>
          <h2 className="font-medium">注销账号</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            删除你的昵称、作息记录和所有群组关系。此操作无法撤销。
          </p>
        </div>

        {confirmDelete ? (
          <div className="flex flex-col gap-2">
            <button
              className={btnDanger}
              disabled={removeAccount.isPending}
              onClick={() => removeAccount.mutate()}
            >
              {removeAccount.isPending ? '删除中…' : '确认删除，我知道无法恢复'}
            </button>
            <button className={btnGhost} onClick={() => setConfirmDelete(false)}>
              取消
            </button>
          </div>
        ) : (
          <button className={btnDanger} onClick={() => setConfirmDelete(true)}>
            注销账号
          </button>
        )}
      </section>

      <Link to="/about" className="pb-6 text-center text-sm text-ink-soft">
        关于与隐私说明
      </Link>

      {showGuide && <Guide onClose={() => setShowGuide(false)} />}
    </div>
  )
}

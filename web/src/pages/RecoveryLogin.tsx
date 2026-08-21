import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/auth'

import { useAuth } from '../hooks/useAuth'
import { btnPrimary, card, input, page } from '../lib/ui'

export function RecoveryLogin() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [code, setCode] = useState('')

  const recover = useMutation({
    mutationFn: () => authApi.recover(code.trim()),
    onSuccess: (data) => {
      signIn(data.token)
      navigate('/', { replace: true })
    },
  })

  return (
    <div className={`${page} justify-between p-6`}>
      <div className="flex flex-col gap-5 pt-10">
        <div>
          <h1 className="text-2xl font-semibold">用恢复码登录</h1>
          <p className="mt-1 text-sm text-ink-soft">
            输入创建身份时保存的那串码
          </p>
        </div>

        <div className={card}>
          <input
            className={`${input} text-center font-mono tracking-widest`}
            value={code}
            placeholder="XXXX-XXXX-XXXX"
            // 恢复码只含大写字母数字，强制大写省去用户切换输入法
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            autoFocus
          />
        </div>

        {recover.error && (
          <p className="text-sm text-red-600">
            {recover.error instanceof Error ? recover.error.message : '登录失败'}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button
          className={btnPrimary}
          disabled={code.trim().length === 0 || recover.isPending}
          onClick={() => recover.mutate()}
        >
          {recover.isPending ? '登录中…' : '登录'}
        </button>
        <Link to="/welcome" className="text-center text-sm text-ink-soft">
          没有恢复码？创建新身份
        </Link>
      </div>
    </div>
  )
}

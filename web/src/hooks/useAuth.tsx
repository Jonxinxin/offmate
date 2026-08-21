import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { getToken, setToken, clearToken, ApiError } from '../lib/request'
import type { MeResult } from '../types/api'

interface AuthState {
  me: MeResult | null
  isLoading: boolean
  /** 本地有 token，但尚未确认它有效 */
  hasToken: boolean
  /** 登录成功后调用：写入存储并驱动界面切换 */
  signIn: (token: string) => void
  logout: () => void
  refresh: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  // token 必须是 React state：localStorage 的变化不会触发重渲染，
  // 只读 localStorage 会导致注册成功后界面停在登录页不动。
  const [token, setTokenState] = useState(() => getToken())

  const { data, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    // 没 token 就不发这个必然 401 的请求
    enabled: token !== null,
    retry: (count, err) =>
      !(err instanceof ApiError && err.code === 'UNAUTHORIZED') && count < 1,
  })

  // token 失效时 request 层已清掉存储，这里同步清掉 state，
  // 否则界面会卡在"加载中"而不是跳回欢迎页。
  useEffect(() => {
    if (error instanceof ApiError && error.code === 'UNAUTHORIZED') {
      setTokenState(null)
    }
  }, [error])

  const value: AuthState = {
    me: data ?? null,
    isLoading: token !== null && isLoading,
    hasToken: token !== null,
    signIn: (next) => {
      setToken(next)
      setTokenState(next)
    },
    logout: () => {
      clearToken()
      setTokenState(null)
      queryClient.clear()
    },
    refresh: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './hooks/useAuth'
import { TabBar } from './components/TabBar'
import { OfflineBanner } from './components/OfflineBanner'
import { Welcome } from './pages/Welcome'
import { RecoveryCode } from './pages/RecoveryCode'
import { RecoveryLogin } from './pages/RecoveryLogin'
import { Join } from './pages/Join'
import { Home } from './pages/Home'
import { MySchedule } from './pages/MySchedule'
import { MemberDetail } from './pages/MemberDetail'
import { Me } from './pages/Me'
import { About } from './pages/About'
import { GroupCreate } from './pages/GroupCreate'
import { GroupDetail } from './pages/GroupDetail'
import { GroupMembers } from './pages/GroupMembers'
import { ShiftRule } from './pages/ShiftRule'
import { HealthCheck } from './pages/HealthCheck'

/** 显示底部导航的三个主页面 */
const TAB_ROUTES = ['/', '/schedule', '/me']

function Loading() {
  return <div className="p-6 text-sm text-ink-soft">加载中…</div>
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, isLoading, hasToken } = useAuth()

  // 有 token 但还在校验时不要闪一下欢迎页
  if (hasToken && isLoading) return <Loading />

  return me ? <>{children}</> : <Navigate to="/welcome" replace />
}

/** 已登录用户误入 /welcome 时送回首页，避免重复注册出第二个账号 */
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { me, isLoading, hasToken } = useAuth()

  if (hasToken && isLoading) return <Loading />
  return me ? <Navigate to="/" replace /> : <>{children}</>
}

/** 老链接 /invite/X 兼容到 /join/X */
function LegacyInviteRedirect() {
  const { code } = useParams()
  return <Navigate to={`/join/${code}`} replace />
}

export function App() {
  const location = useLocation()
  const { me } = useAuth()
  const showTabs = Boolean(me) && TAB_ROUTES.includes(location.pathname)

  return (
    <>
      <OfflineBanner />

      <Routes>
        <Route
          path="/welcome"
          element={
            <RedirectIfAuthed>
              <Welcome />
            </RedirectIfAuthed>
          }
        />
        <Route path="/recovery" element={<RecoveryLogin />} />
        <Route path="/recovery-code" element={<RecoveryCode />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="/invite/:code" element={<LegacyInviteRedirect />} />
        <Route path="/about" element={<About />} />
        <Route path="/health" element={<HealthCheck />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />
        <Route
          path="/schedule"
          element={
            <RequireAuth>
              <MySchedule />
            </RequireAuth>
          }
        />
        <Route
          path="/member/:userId"
          element={
            <RequireAuth>
              <MemberDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/me"
          element={
            <RequireAuth>
              <Me />
            </RequireAuth>
          }
        />
        <Route
          path="/rule"
          element={
            <RequireAuth>
              <ShiftRule />
            </RequireAuth>
          }
        />
        {/* /group/create 写在 /group/:id 之前只是为了可读性；React Router 按静态段
            优先匹配，与书写顺序无关，"create" 不会被当成群组 id。 */}
        <Route
          path="/group/create"
          element={
            <RequireAuth>
              <GroupCreate />
            </RequireAuth>
          }
        />
        <Route
          path="/group/:id"
          element={
            <RequireAuth>
              <GroupDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/group/:id/members"
          element={
            <RequireAuth>
              <GroupMembers />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showTabs && <TabBar />}
    </>
  )
}

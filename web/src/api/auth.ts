import { api } from '../lib/request'
import type { MeResult, RecoverResult, RegisterResult, User } from '../types/api'

export const authApi = {
  register: (input: { nickname: string; avatarEmoji?: string | null; inviteCode?: string }) =>
    api.post<RegisterResult>('/api/auth/register', input),

  recover: (recoveryCode: string) =>
    api.post<RecoverResult>('/api/auth/recover', { recoveryCode }),

  me: () => api.get<MeResult>('/api/auth/me'),

  updateMe: (patch: { nickname?: string; avatarEmoji?: string | null }) =>
    api.patch<{ user: User }>('/api/auth/me', patch),

  resetRecoveryCode: () =>
    api.post<{ recoveryCode: string }>('/api/auth/recovery/reset'),

  deleteMe: () => api.del<{ deleted: boolean }>('/api/auth/me'),
}

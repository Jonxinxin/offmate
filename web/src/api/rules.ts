import { api } from '../lib/request'
import type { Status } from '../types/api'

export interface Preset {
  key: string
  name: string
  desc: string
  pattern: Status[]
}

export interface Rule {
  id: string
  type: 'preset' | 'custom'
  presetKey: string | null
  pattern: Status[]
  anchorDate: string
  name: string
}

export const rulesApi = {
  presets: () => api.get<{ presets: Preset[] }>('/api/rules/presets'),

  mine: () => api.get<{ rule: Rule | null }>('/api/rules/me'),

  save: (body: {
    type: 'preset' | 'custom'
    presetKey?: string
    pattern?: Status[]
    anchorDate?: string
  }) => api.put<{ rule: Rule; generated: number }>('/api/rules/me', body),

  stop: (clearGenerated: boolean) =>
    api.del<{ deleted: boolean }>(`/api/rules/me?clearGenerated=${clearGenerated}`),
}

import { useState } from 'react'
import type { Status, ViewStatus } from '../types/api'
import { SELECTABLE_STATUSES, STATUS_STYLES } from '../lib/status'
import { btnGhost, btnPrimary } from '../lib/ui'
import { formatFull } from '../lib/date'

interface StatusPickerProps {
  date: string
  current: ViewStatus
  currentNote: string | null
  onPick: (status: Status, note: string | null) => void
  onClear: () => void
  onClose: () => void
}

/** 底部弹出的单日状态选择面板 */
export function StatusPicker({
  date,
  current,
  currentNote,
  onPick,
  onClear,
  onClose,
}: StatusPickerProps) {
  const [note, setNote] = useState(currentNote ?? '')

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="关闭"
      />

      {/* pb 里加安全区，避免在刘海屏被底部横条压住 */}
      <div className="relative rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-[480px]">
          <p className="mb-4 text-center text-sm text-ink-soft">{formatFull(date)}</p>

          <div className="grid grid-cols-2 gap-2">
            {SELECTABLE_STATUSES.map((status) => {
              const style = STATUS_STYLES[status]
              const active = current === status

              return (
                <button
                  key={status}
                  onClick={() => onPick(status, note.trim() || null)}
                  className={`flex h-14 items-center justify-center gap-2 rounded-xl border transition active:scale-[0.98] ${
                    active ? 'border-ink bg-gray-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className={`h-3 w-3 rounded-full ${style.dot}`} />
                  <span className="text-base font-medium">{style.label}</span>
                </button>
              )
            })}
          </div>

          <input
            className="mt-3 h-12 w-full rounded-xl border border-gray-200 px-4 text-base outline-none focus:border-gray-400"
            value={note}
            maxLength={30}
            placeholder="备注（可不填，例如：下午 3 点后有空）"
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="mt-3 flex gap-2">
            {current !== 'unset' && (
              <button className={btnGhost} onClick={onClear}>
                清除
              </button>
            )}
            <button className={btnPrimary} onClick={onClose}>
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

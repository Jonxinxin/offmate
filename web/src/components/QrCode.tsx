import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

/** 纯前端生成，不占服务端资源。当面加入时比念邀请码快得多。 */
export function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current) return
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      color: { dark: '#1F2328', light: '#FFFFFF' },
    }).catch(() => {
      // 生成失败时保持画布空白，邀请链接文本仍然可用，不阻断主流程
    })
  }, [value, size])

  return <canvas ref={ref} width={size} height={size} className="rounded-lg" />
}

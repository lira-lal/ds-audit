import { h, JSX } from 'preact'
import type { ViolationType } from './types'

// 전부 16 viewBox. 피그마 plugin/icon 컴포넌트와 같은 경로를 쓴다.

const FILLED: Record<string, string> = {
  컬러: 'M 8 1.6 C 9.7 4 12.9 8.3 12.9 10.8 C 12.9 13.5 10.7 15.4 8 15.4 C 5.3 15.4 3.1 13.5 3.1 10.8 C 3.1 8.3 6.3 4 8 1.6 Z',
  반짝임: 'M 8 1 C 8.8 5.9 10.1 7.2 15 8 C 10.1 8.8 8.8 10.1 8 15 C 7.2 10.1 5.9 8.8 1 8 C 5.9 7.2 7.2 5.9 8 1 Z'
}

const STROKED: Record<string, string> = {
  모서리: 'M 2.9 13.1 L 2.9 6.9 C 2.9 4.8 4.8 2.9 6.9 2.9 L 13.1 2.9',
  간격: 'M 3.7 2.9 L 3.7 13.1 M 12.3 2.9 L 12.3 13.1 M 6.8 8 L 9.2 8',
  크기: 'M 2.9 2.9 L 13.1 2.9 L 13.1 13.1 L 2.9 13.1 Z M 6.3 9.7 L 9.7 6.3',
  컴포넌트: 'M 8 2.5 L 13.5 8 L 8 13.5 L 2.5 8 Z',
  타이포: 'M 3.5 13 L 8 3 L 12.5 13 M 5.3 9.6 L 10.7 9.6',
  이동: 'M 4 12 L 12 4 M 6.3 4 L 12 4 L 12 9.7',
  뒤로: 'M 10 3.2 L 5.2 8 L 10 12.8',
  체크: 'M 3.5 8.5 L 6.5 11.5 L 12.5 4.5'
}

// 톱니바퀴 — 이 6개. 방사선으로 그리면 해처럼 보여서 이가 원에 붙은 외곽선으로 만든다.
function gearPath(): string {
  const cx = 8, cy = 8, N = 6, rOut = 6.5, rRoot = 4.6, tw = 17, tr = 11
  const rad = (d: number) => (d * Math.PI) / 180
  const P = (a: number, r: number) => `${(cx + r * Math.cos(rad(a))).toFixed(2)} ${(cy + r * Math.sin(rad(a))).toFixed(2)}`
  const pts: string[] = []
  for (let i = 0; i < N; i++) {
    const a = i * (360 / N) - 90
    pts.push(P(a - tw, rOut), P(a + tw, rOut), P(a + tw + tr, rRoot), P(a + 360 / N - tw - tr, rRoot))
  }
  const hr = 2.5, k = 0.5523 * hr
  const hole =
    `M ${cx + hr} ${cy} C ${cx + hr} ${cy + k} ${cx + k} ${cy + hr} ${cx} ${cy + hr}` +
    ` C ${cx - k} ${cy + hr} ${cx - hr} ${cy + k} ${cx - hr} ${cy}` +
    ` C ${cx - hr} ${cy - k} ${cx - k} ${cy - hr} ${cx} ${cy - hr}` +
    ` C ${cx + k} ${cy - hr} ${cx + hr} ${cy - k} ${cx + hr} ${cy} Z`
  return 'M ' + pts[0] + ' ' + pts.slice(1).map((p) => 'L ' + p).join(' ') + ' Z ' + hole
}
STROKED.설정 = gearPath()

export type IconName = ViolationType | '이동' | '설정' | '체크' | '뒤로' | '반짝임'

export function Icon({ name, size = 12, color = 'currentColor', width }: {
  name: IconName
  size?: number
  color?: string
  width?: number
}): JSX.Element {
  const filled = FILLED[name]
  const d = filled ?? STROKED[name] ?? STROKED.컴포넌트
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block', flex: 'none' }}>
      <path
        d={d}
        fill={filled ? color : 'none'}
        stroke={filled ? 'none' : color}
        stroke-width={width ?? 1.4}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

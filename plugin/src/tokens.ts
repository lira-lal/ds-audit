// 피그마 Plugin UI 변수 컬렉션과 같은 값. 이름도 같게 맞춘다.
export const C = {
  surfacePage: '#F6F6F6',
  surfaceCard: '#FFFFFF',
  surfaceChip: '#F2F2F2',
  surfaceMuted: '#EFEFEF',
  surfaceSubtle: '#F7F8F9',
  textStrong: '#0A0A0A',
  textBody: '#6B6B6B',
  textMuted: '#8A8A8A',
  textFaint: '#9A9A9A',
  textInverse: '#FFFFFF',
  lineDefault: '#E5E5E5',
  lineHairline: '#D9D9D9',
  actionPrimary: '#000000',
  sev심각: '#D32F2F',
  sev보통: '#E08A00',
  sev경미: '#6B6B6B',
  sev문제없음: '#3D7A45',
  stateOn: '#14AE5C',
  stateIdle: '#B5B5B5'
} as const

/** 심각도 색 10% — 유형 아이콘 배경 */
export function tint(hexColor: string): string {
  return hexColor + '1A' // 10%
}

export const R = { sm: 4, md: 8, lg: 12, full: 100 } as const
export const S = { xxs: 4, xs: 6, sm: 8, md: 12, lg: 16, xl: 24 } as const
export const HAIRLINE = 0.5

export type Sev = '심각' | '보통' | '경미' | '—'
export function sevColor(s: string): string {
  if (s === '심각') return C.sev심각
  if (s === '보통') return C.sev보통
  if (s === '경미') return C.sev경미
  return C.textFaint
}

export const FONT =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

/** plugin/ 텍스트 스타일과 1:1 */
export const T = {
  numHero: { fontSize: 24, fontWeight: 700, lineHeight: 1.2 },
  titlePage: { fontSize: 18, fontWeight: 700, lineHeight: 1.3 },
  titleGroup: { fontSize: 16, fontWeight: 700, lineHeight: 1.35 },
  buttonBar: { fontSize: 14, fontWeight: 600, lineHeight: 1.2 },
  titleItem: { fontSize: 12, fontWeight: 700, lineHeight: 1.35 },
  labelTab: { fontSize: 12, fontWeight: 500, lineHeight: 1.35 },
  bodyItem: { fontSize: 12, fontWeight: 400, lineHeight: 1.35 },
  labelStrong: { fontSize: 10, fontWeight: 700, lineHeight: 1.35 },
  labelMeta: { fontSize: 10, fontWeight: 500, lineHeight: 1.35 },
  bodyDefault: { fontSize: 10, fontWeight: 400, lineHeight: 1.45 },
  buttonSmall: { fontSize: 10, fontWeight: 700, lineHeight: 1.2 },
  labelMicro: { fontSize: 8, fontWeight: 400, lineHeight: 1.35 }
} as const

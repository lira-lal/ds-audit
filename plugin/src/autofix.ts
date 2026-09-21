// 자동 수정 엔진.
//
// 설계 원칙 하나만 지킨다 — 수정은 모델이 아니라 여기서 계산한다.
// 모델은 "어긋났다"까지만 답하고, 어느 노드의 어느 속성을 어느 변수에 연결할지는
// extract가 모은 구조 데이터에서 코드가 직접 뽑는다. 모델이 nodeId나 변수명을
// 지어내면 엉뚱한 노드가 고쳐지기 때문이다.

import type { ExtractedElement, ExtractedFrame } from './extract'
import type { Finding, FixBlocked, FixOutcome, FixPlan, ViolationType } from './types'

/** 로컬 변수 한 건. 값 비교로 "이 값은 이 변수와 같다"를 판정한다. */
export interface VariableEntry {
  id: string
  name: string
  type: 'COLOR' | 'FLOAT'
  /** COLOR는 #rrggbb, FLOAT는 숫자 */
  value: string | number
}

// 어느 속성이 어긋나면 어느 유형인가 — criteria.md의 변경 허용 범위 표와 같은 분류
const FIELD_TYPE: Record<string, ViolationType> = {
  fills: '컬러',
  strokes: '컬러',
  cornerRadius: '모서리',
  topLeftRadius: '모서리',
  topRightRadius: '모서리',
  bottomLeftRadius: '모서리',
  bottomRightRadius: '모서리',
  itemSpacing: '간격',
  paddingLeft: '간격',
  paddingRight: '간격',
  paddingTop: '간격',
  paddingBottom: '간격',
  width: '크기',
  height: '크기'
}

export function fieldToType(field: string): ViolationType | null {
  return FIELD_TYPE[field] ?? null
}

function toHex(c: { r: number; g: number; b: number }): string {
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return '#' + h(c.r) + h(c.g) + h(c.b)
}

/** 파일 안의 로컬 변수를 값 비교가 가능한 형태로 모은다 */
export async function collectVariables(): Promise<VariableEntry[]> {
  const out: VariableEntry[] = []
  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  for (const coll of collections) {
    const modeId = coll.modes[0]?.modeId
    if (!modeId) continue
    for (const id of coll.variableIds) {
      const v = await figma.variables.getVariableByIdAsync(id)
      if (!v) continue
      const raw = v.valuesByMode[modeId]
      if (v.resolvedType === 'COLOR' && raw && typeof raw === 'object' && 'r' in raw) {
        out.push({ id: v.id, name: v.name, type: 'COLOR', value: toHex(raw as RGB) })
      } else if (v.resolvedType === 'FLOAT' && typeof raw === 'number') {
        out.push({ id: v.id, name: v.name, type: 'FLOAT', value: raw })
      }
    }
  }
  return out
}

/** 색 값과 정확히 같은 변수 */
function matchColor(hex: string, vars: VariableEntry[]): VariableEntry | null {
  const target = hex.toLowerCase()
  return vars.find((v) => v.type === 'COLOR' && String(v.value).toLowerCase() === target) ?? null
}

/**
 * 숫자 값에 맞는 변수.
 * 정확히 같은 값을 먼저 찾고, 없으면 후보군 안에서 가장 가까운 것을 고른다.
 * 가장 가까운 것은 차이가 2 이내일 때만 인정한다 — 그보다 멀면 의도한 다른 값일 수 있다.
 */
function matchNumber(value: number, vars: VariableEntry[], prefix: string): { v: VariableEntry; exact: boolean } | null {
  const pool = vars.filter((v) => v.type === 'FLOAT' && v.name.indexOf(prefix) === 0)
  const exact = pool.find((v) => v.value === value)
  if (exact) return { v: exact, exact: true }
  let best: VariableEntry | null = null
  let bestGap = Infinity
  for (const v of pool) {
    const gap = Math.abs((v.value as number) - value)
    if (gap < bestGap) { bestGap = gap; best = v }
  }
  if (best && bestGap <= 2) return { v: best, exact: false }
  return null
}

const RADIUS_FIELDS = ['cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']
const GAP_FIELDS = ['itemSpacing', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom']

/**
 * 판정 결과와 구조 데이터를 맞춰 수정 계획을 세운다.
 * findings의 nodeId로 element를 찾고, 그 element의 bindings 중
 * 변수에 연결되지 않은(bound:false) 값이 등록 변수와 맞아떨어지면 수정 대상이다.
 */
export function planFixes(
  frame: ExtractedFrame,
  findings: Finding[],
  vars: VariableEntry[]
): { fixes: FixPlan[]; blocked: FixBlocked[] } {
  const byId = new Map<string, ExtractedElement>()
  for (const el of frame.elements) byId.set(el.nodeId, el)

  const fixes: FixPlan[] = []
  const blocked: FixBlocked[] = []

  for (const f of findings) {
    if (f.심각도 === '—') continue
    const el = byId.get(f.nodeId)
    if (!el) {
      blocked.push({ nodeId: f.nodeId, 요소명: f.요소명, 사유: '구조 데이터에서 해당 노드를 찾지 못했습니다' })
      continue
    }

    // 직접 그린 요소는 인스턴스로 바꿔야 하는데, 바꾸면 안의 내용이 사라진다
    if (el.kind === 'frame' || el.kind === 'shape') {
      blocked.push({
        nodeId: f.nodeId,
        요소명: f.요소명,
        사유: '인스턴스로 바꾸면 안의 내용이 사라집니다'
      })
      continue
    }

    let found = 0
    for (const field of Object.keys(el.bindings)) {
      const b = el.bindings[field]
      if (b.bound) continue // 이미 변수에 연결됨

      const type = fieldToType(field)
      if (!type) continue

      if (field === 'fills' || field === 'strokes') {
        const hex = paintHex(b.value)
        if (!hex) continue
        const hit = matchColor(hex, vars)
        if (!hit) continue
        fixes.push({ nodeId: el.nodeId, 요소명: f.요소명, 유형: '컬러', field, variableName: hit.name, 현재값: hex, 목표값: hit.name })
        found++
      } else if (RADIUS_FIELDS.indexOf(field) !== -1) {
        if (typeof b.value !== 'number') continue
        const hit = matchNumber(b.value, vars, 'radius/')
        if (!hit) continue
        fixes.push({ nodeId: el.nodeId, 요소명: f.요소명, 유형: '모서리', field, variableName: hit.v.name, 현재값: String(b.value), 목표값: `${hit.v.name} (${hit.v.value})` })
        found++
      } else if (GAP_FIELDS.indexOf(field) !== -1) {
        if (typeof b.value !== 'number') continue
        const prefix = field === 'itemSpacing' ? 'Space/' : 'Padding/'
        const hit = matchNumber(b.value, vars, prefix)
        if (!hit) continue
        fixes.push({ nodeId: el.nodeId, 요소명: f.요소명, 유형: '간격', field, variableName: hit.v.name, 현재값: String(b.value), 목표값: `${hit.v.name} (${hit.v.value})` })
        found++
      }
    }

    if (found === 0) {
      blocked.push({ nodeId: f.nodeId, 요소명: f.요소명, 사유: '값과 맞아떨어지는 등록 변수가 없습니다' })
    }
  }

  return { fixes, blocked }
}

function paintHex(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  const first = value[0] as { type?: string; color?: { r: number; g: number; b: number } } | undefined
  if (!first || first.type !== 'SOLID' || !first.color) return null
  return toHex(first.color)
}

/** 계획을 실제로 적용한다. 한 건 실패해도 나머지는 계속 간다. */
export async function applyFixes(plans: FixPlan[]): Promise<FixOutcome[]> {
  const out: FixOutcome[] = []
  const varCache = new Map<string, Variable>()

  for (const plan of plans) {
    try {
      const node = await figma.getNodeByIdAsync(plan.nodeId)
      if (!node) { out.push({ nodeId: plan.nodeId, ok: false, message: '노드를 찾을 수 없습니다' }); continue }

      let variable = varCache.get(plan.variableName) ?? null
      if (!variable) {
        const all = await figma.variables.getLocalVariablesAsync()
        variable = all.find((v) => v.name === plan.variableName) ?? null
        if (variable) varCache.set(plan.variableName, variable)
      }
      if (!variable) { out.push({ nodeId: plan.nodeId, ok: false, message: `변수 ${plan.variableName}를 찾을 수 없습니다` }); continue }

      if (plan.field === 'fills' || plan.field === 'strokes') {
        const target = node as GeometryMixin
        const current = plan.field === 'fills' ? target.fills : target.strokes
        if (!Array.isArray(current)) { out.push({ nodeId: plan.nodeId, ok: false, message: '색을 읽을 수 없습니다' }); continue }
        const next = current.map((p) =>
          p.type === 'SOLID' ? figma.variables.setBoundVariableForPaint(p, 'color', variable as Variable) : p
        )
        if (plan.field === 'fills') target.fills = next
        else target.strokes = next
      } else {
        // 숫자 속성은 필드명 그대로 바인딩한다
        ;(node as SceneNode).setBoundVariable(plan.field as VariableBindableNodeField, variable)
      }
      out.push({ nodeId: plan.nodeId, ok: true })
    } catch (e) {
      out.push({ nodeId: plan.nodeId, ok: false, message: e instanceof Error ? e.message : String(e) })
    }
  }
  return out
}

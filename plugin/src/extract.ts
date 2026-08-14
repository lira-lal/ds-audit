// 노드 트리를 SKILL.md의 평탄화 규칙대로 걸러서 LLM 판정용 구조 데이터로 만든다.
// 판정 자체(유사품인지 등)는 절대 여기서 안 한다 — 구조 신호만 뽑는다.

export interface VariableRef {
  bound: true
  name: string
}
export interface RawValue {
  bound: false
  value: unknown
}
export type FieldBinding = VariableRef | RawValue

export interface ExtractedElement {
  nodeId: string
  name: string
  kind: 'instance' | 'frame' | 'shape' | 'text'
  위치힌트: string
  geometry: { width: number; height: number }
  resize?: { horizontal?: string; vertical?: string }
  mainComponent?: string
  overriddenFields?: string[]
  bindings: Record<string, FieldBinding>
  childNames?: string[]
  textPreview?: string
  textNoBindingCaveat?: boolean
  note?: string
}

export interface ExtractedFrame {
  frameName: string
  fileKey: string
  nodeId: string
  elements: ExtractedElement[]
  skippedForSize: boolean
}

const STYLE_FIELDS = ['fills', 'strokes', 'cornerRadius', 'itemSpacing', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'] as const

const variableNameCache = new Map<string, string>()

async function resolveVariableName(variableId: string): Promise<string> {
  const cached = variableNameCache.get(variableId)
  if (cached) return cached
  const variable = await figma.variables.getVariableByIdAsync(variableId)
  const name = variable ? variable.name : variableId
  variableNameCache.set(variableId, name)
  return name
}

async function readBindings(node: SceneNode): Promise<Record<string, FieldBinding>> {
  const bindings: Record<string, FieldBinding> = {}
  const boundVariables = (node as unknown as { boundVariables?: Record<string, unknown> }).boundVariables
  for (const field of STYLE_FIELDS) {
    if (!(field in node)) continue
    const raw = boundVariables?.[field]
    if (!raw) {
      const value = (node as unknown as Record<string, unknown>)[field]
      if (value !== undefined) bindings[field] = { bound: false, value }
      continue
    }
    if (Array.isArray(raw)) {
      // fills/strokes: 배열의 각 항목이 VariableAlias | undefined
      const names: string[] = []
      for (const entry of raw) {
        if (entry && typeof entry === 'object' && 'id' in entry) {
          names.push(await resolveVariableName((entry as { id: string }).id))
        }
      }
      if (names.length > 0) bindings[field] = { bound: true, name: names.join(', ') }
      else {
        const value = (node as unknown as Record<string, unknown>)[field]
        bindings[field] = { bound: false, value }
      }
    } else if (typeof raw === 'object' && 'id' in raw) {
      bindings[field] = { bound: true, name: await resolveVariableName((raw as { id: string }).id) }
    }
  }
  return bindings
}

// 오토레이아웃 부모 안에서 width/height가 FILL·HUG면 화면·콘텐츠 크기에 맞춰 자동으로 정해지는 값이라
// "고정값 직접 변경"이 아니다 — 이 정보가 없으면 overriddenFields의 width/height만 보고
// 반응형 크기 변경을 고정값 오버라이드로 오판하게 된다.
function readResizeMode(node: SceneNode): { horizontal?: string; vertical?: string } | undefined {
  const n = node as unknown as { layoutSizingHorizontal?: string; layoutSizingVertical?: string }
  if (n.layoutSizingHorizontal === undefined && n.layoutSizingVertical === undefined) return undefined
  return { horizontal: n.layoutSizingHorizontal, vertical: n.layoutSizingVertical }
}

function isPureLayout(node: SceneNode): boolean {
  if (node.type !== 'FRAME' && node.type !== 'GROUP') return false
  if ('children' in node && node.children.length === 0) return false
  const hasFill = 'fills' in node && Array.isArray(node.fills) && node.fills.some((f) => f.visible !== false)
  const hasStroke = 'strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0
  const hasEffect = 'effects' in node && Array.isArray(node.effects) && node.effects.some((e) => e.visible !== false)
  const hasRadius = 'cornerRadius' in node && typeof node.cornerRadius === 'number' && node.cornerRadius > 0
  return !hasFill && !hasStroke && !hasEffect && !hasRadius
}

function isMask(node: SceneNode): boolean {
  return 'isMask' in node && (node as { isMask: boolean }).isMask === true
}

const MAX_ELEMENTS = 200

export async function extractFrame(root: SceneNode, fileKey: string): Promise<ExtractedFrame> {
  const elements: ExtractedElement[] = []
  let skippedForSize = false

  async function walk(node: SceneNode, 위치힌트: string, isRoot: boolean): Promise<void> {
    if (elements.length >= MAX_ELEMENTS) {
      skippedForSize = true
      return
    }
    if (isMask(node)) return
    if (node.type === 'SLICE' || node.type === 'CONNECTOR' || node.type === 'STICKY') return

    if (node.type === 'INSTANCE') {
      const mainComponent = await node.getMainComponentAsync()
      const overrides = node.overrides ?? []
      const ownOverride = overrides.find((o) => o.id === node.id)
      elements.push({
        nodeId: node.id,
        name: node.name,
        kind: 'instance',
        위치힌트,
        geometry: { width: node.width, height: node.height },
        resize: readResizeMode(node),
        mainComponent: mainComponent ? mainComponent.name : undefined,
        overriddenFields: ownOverride?.overriddenFields as string[] | undefined,
        bindings: await readBindings(node)
      })
      // 평탄화: 인스턴스 하위로는 안 내려간다.
      return
    }

    if (node.type === 'TEXT') {
      const boundVariables = (node as unknown as { boundVariables?: Record<string, unknown> }).boundVariables
      const hasCharBinding = Boolean(boundVariables && 'characters' in boundVariables)
      elements.push({
        nodeId: node.id,
        name: node.name,
        kind: 'text',
        위치힌트,
        geometry: { width: node.width, height: node.height },
        bindings: await readBindings(node),
        textPreview: node.characters.slice(0, 40),
        textNoBindingCaveat: !hasCharBinding,
        note: 'characters 오버라이드는 Figma API 제약으로 boundVariables에 안 잡힘 — 텍스트 값 자체의 변수 연결 여부는 확인 불가'
      })
      return
    }

    if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      // 검수 대상으로 선택한 루트 프레임 자신은 판정 대상이 아니다 — 순수 컨테이너로 취급하고 자식만 본다.
      if (isRoot || isPureLayout(node)) {
        if ('children' in node) {
          for (const child of node.children) await walk(child, 위치힌트, false)
        }
        return
      }
      const childNames = 'children' in node ? node.children.map((c) => c.name) : []
      elements.push({
        nodeId: node.id,
        name: node.name,
        kind: 'frame',
        위치힌트,
        geometry: { width: node.width, height: node.height },
        resize: readResizeMode(node),
        bindings: await readBindings(node),
        childNames
      })
      if ('children' in node) {
        for (const child of node.children) await walk(child, `${위치힌트} > ${node.name}`, false)
      }
      return
    }

    // 나머지 (RECTANGLE, ELLIPSE, VECTOR, STAR, POLYGON, LINE, BOOLEAN_OPERATION 등) — 스타일 값을 가진 도형
    elements.push({
      nodeId: node.id,
      name: node.name,
      kind: 'shape',
      위치힌트,
      geometry: { width: node.width, height: node.height },
      resize: readResizeMode(node),
      bindings: await readBindings(node)
    })
  }

  await walk(root, '최상단', true)

  return {
    frameName: root.name,
    fileKey,
    nodeId: root.id,
    elements,
    skippedForSize
  }
}

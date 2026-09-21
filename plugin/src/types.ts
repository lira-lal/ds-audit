export type ModelId = 'claude-opus-5' | 'claude-sonnet-5'

/**
 * 위반 영역. 어느 속성이 어긋났는지로 정해진다.
 * 심각도(얼마나 급한가)와는 다른 축이다.
 */
export type ViolationType = '컬러' | '모서리' | '간격' | '크기' | '타이포' | '컴포넌트'

export interface Finding {
  요소명: string
  위치: string
  nodeId: string
  출처: string
  /** 한 요소가 여러 영역에서 동시에 어긋날 수 있다. 대표 유형은 첫 번째 */
  유형: ViolationType[]
  결과: string
  유사기존: string
  차이점: string
  액션: string
  심각도: '심각' | '보통' | '경미' | '—'
}

export interface Summary {
  문제없음: number
  심각: number
  보통: number
  경미: number
  예외: number
  확인불가: number
}

export interface UpdateSuggestion {
  대상파일: string
  제안: string
  상태: string
}

/**
 * 자동 수정 한 건. 모델이 아니라 플러그인이 구조 데이터에서 직접 계산한다.
 * 모델이 nodeId나 변수명을 지어내면 엉뚱한 노드를 고치게 되므로 여기로 넘기지 않는다.
 */
export interface FixPlan {
  nodeId: string
  요소명: string
  유형: ViolationType
  /** 고칠 속성 — fills · strokes · cornerRadius · paddingLeft · itemSpacing … */
  field: string
  /** 연결할 로컬 변수 이름 */
  variableName: string
  현재값: string
  목표값: string
}

/** 자동 수정이 안 되는 경우, 왜 안 되는지 */
export interface FixBlocked {
  nodeId: string
  요소명: string
  사유: string
}

export interface FixOutcome {
  nodeId: string
  ok: boolean
  message?: string
}

export interface AuditResult {
  frameName: string
  fileKey: string
  nodeId: string
  findings: Finding[]
  summary: Summary
  updateSuggestions: UpdateSuggestion[]
  /** 플러그인이 계산한 자동 수정 계획 */
  fixes: FixPlan[]
  /** 자동 수정이 불가한 항목과 그 사유 */
  blocked: FixBlocked[]
  savedAt: string
}

export interface SaveModelMessage {
  type: 'save-model'
  model: ModelId
}

export interface TestConnectionMessage {
  type: 'test-connection'
}

export interface RunAuditMessage {
  type: 'run-audit'
}

export interface FocusNodeMessage {
  type: 'focus-node'
  nodeId: string
}

export interface ApplyFixesMessage {
  type: 'apply-fixes'
  /** 비우면 이번 결과의 수정 가능한 건 전부 */
  nodeIds?: string[]
}

export interface GoBackMessage {
  type: 'go-back'
}

export type UiToMainMessage =
  | SaveModelMessage
  | TestConnectionMessage
  | RunAuditMessage
  | FocusNodeMessage
  | ApplyFixesMessage
  | GoBackMessage

export interface InitMessage {
  type: 'init'
  model: ModelId
  selection: string[]
}

export interface SelectionChangedMessage {
  type: 'selection-changed'
  selection: string[]
}

export interface AuditStartedMessage {
  type: 'audit-started'
}

export interface AuditResultMessage {
  type: 'audit-result'
  results: AuditResult[]
}

export interface AuditErrorMessage {
  type: 'audit-error'
  message: string
}

export interface TestConnectionResultMessage {
  type: 'test-connection-result'
  ok: boolean
  message: string
}

/** 프레임을 하나씩 처리하므로 어디까지 됐는지 알린다 */
export interface AuditProgressMessage {
  type: 'audit-progress'
  done: number
  total: number
  currentFrame: string
}

export interface FixResultMessage {
  type: 'fix-result'
  outcomes: FixOutcome[]
  results: AuditResult[]
}

export type MainToUiMessage =
  | InitMessage
  | SelectionChangedMessage
  | AuditStartedMessage
  | AuditProgressMessage
  | AuditResultMessage
  | AuditErrorMessage
  | TestConnectionResultMessage
  | FixResultMessage

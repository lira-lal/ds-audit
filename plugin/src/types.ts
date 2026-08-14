export type ModelId = 'claude-opus-5' | 'claude-sonnet-5'

export interface Finding {
  요소명: string
  위치: string
  nodeId: string
  출처: string
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

export interface PreviousItemStatus {
  요소명: string
  이전심각도: string
  상태: '해소' | '미해소' | '확인 필요'
  근거: string
}

export interface AuditResult {
  frameName: string
  fileKey: string
  nodeId: string
  findings: Finding[]
  summary: Summary
  updateSuggestions: UpdateSuggestion[]
  previousItemsStatus?: PreviousItemStatus[]
  newFindings?: Finding[]
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
  reAudit?: boolean
}

export interface RequestHistoryMessage {
  type: 'request-history'
}

export interface FocusNodeMessage {
  type: 'focus-node'
  nodeId: string
}

export type UiToMainMessage =
  | SaveModelMessage
  | TestConnectionMessage
  | RunAuditMessage
  | RequestHistoryMessage
  | FocusNodeMessage

export interface InitMessage {
  type: 'init'
  model: ModelId
  selectionSummary: string
  historyKeys: string[]
  hasPreviousForSelection: boolean
}

export interface SelectionChangedMessage {
  type: 'selection-changed'
  selectionSummary: string
  historyKeys: string[]
  hasPreviousForSelection: boolean
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

export interface HistoryResultMessage {
  type: 'history-result'
  history: AuditResult[]
}

export type MainToUiMessage =
  | InitMessage
  | SelectionChangedMessage
  | AuditStartedMessage
  | AuditResultMessage
  | AuditErrorMessage
  | TestConnectionResultMessage
  | HistoryResultMessage

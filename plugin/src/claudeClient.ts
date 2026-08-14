// Figma 플러그인 메인 스레드(code.ts)에서만 호출한다.
// Anthropic API를 직접 호출하지 않는다 — 대신 사용자 로컬에서 떠 있는
// relay-server(../../relay-server)에 fetch로 요청을 보내고, 그 서버가
// `claude -p`(Claude Code CLI, 이미 로그인된 구독)를 실행해서 결과를 돌려준다.
// 그래서 API 키가 필요 없고 구독 사용량으로 처리된다.

import type { AuditResult, Finding, ModelId, PreviousItemStatus, Summary, UpdateSuggestion } from './types'
import { SYSTEM_PROMPT } from './promptData.generated'

const RELAY_SERVER_URL = 'http://localhost:8787'

interface JudgeInput {
  model: ModelId
  extractedFrameJson: string
  fileKey: string
  nodeId: string
  frameName: string
  previousResult?: AuditResult
}

interface RawStructuredResult {
  findings: Finding[]
  summary: Summary
  updateSuggestions: UpdateSuggestion[]
  previousItemsStatus?: PreviousItemStatus[]
  newFindings?: Finding[]
}

interface HealthResponse {
  loggedIn: boolean
  email?: string
  authMethod?: string
  subscriptionType?: string
  error?: string
}

interface JudgeResponse {
  text?: string
  subtype?: string
  isError?: boolean
  error?: string
}

// fetch 실패 시 던져지는 값이 항상 Error 인스턴스라는 보장이 없다(Figma 플러그인 런타임에서는
// 특히 그렇다) — String(e)만 쓰면 "[object Object]"가 나올 수 있어 여기서 방어적으로 문자열화한다.
export function describeError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

// claude -p는 output_config.format 같은 강제 스키마가 없어서, 지시를 따르더라도
// 마크다운 코드펜스나 앞뒤 설명이 섞여 나올 수 있다 — 첫 { 부터 마지막 } 까지만 뽑는다.
function extractJson(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('응답에서 JSON을 찾을 수 없다: ' + text.slice(0, 300))
  }
  return text.slice(start, end + 1)
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${RELAY_SERVER_URL}/health`)
    const data = (await res.json()) as HealthResponse
    if (!res.ok || !data.loggedIn) {
      return { ok: false, message: data.error ?? 'claude 로그인이 안 되어 있다. 터미널에서 claude 실행 후 로그인해달라.' }
    }
    return { ok: true, message: `${data.email ?? '알 수 없음'} (${data.subscriptionType ?? data.authMethod ?? ''})` }
  } catch (e) {
    return {
      ok: false,
      message: `로컬 서버(${RELAY_SERVER_URL})에 연결 못함 — relay-server를 실행했는지 확인해달라. (${describeError(e)})`
    }
  }
}

export async function judgeFrame(input: JudgeInput): Promise<AuditResult> {
  const userContent = input.previousResult
    ? `이전 검수 결과(JSON):\n${JSON.stringify(input.previousResult, null, 2)}\n\n재검수 대상 프레임 데이터(JSON):\n${input.extractedFrameJson}\n\n위 데이터로 재검수해라. previousItemsStatus와 newFindings 둘 다 채워라.`
    : `검수 대상 프레임 데이터(JSON):\n${input.extractedFrameJson}`

  let res: Response
  try {
    res = await fetch(`${RELAY_SERVER_URL}/judge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: userContent,
        model: input.model
      })
    })
  } catch (e) {
    throw new Error(`로컬 서버(${RELAY_SERVER_URL})에 연결 못함 — relay-server를 실행했는지 확인해달라. (${describeError(e)})`)
  }

  const data = (await res.json().catch(() => ({}))) as JudgeResponse
  if (!res.ok) {
    throw new Error(`로컬 서버 오류: ${data.error ?? res.status}`)
  }
  if (data.subtype && data.subtype !== 'success') {
    throw new Error(`claude -p 실패 (${data.subtype}): ${data.text ?? data.error ?? ''}`)
  }
  if (!data.text) {
    throw new Error('claude -p 응답이 비어있다.')
  }

  const parsed = JSON.parse(extractJson(data.text)) as RawStructuredResult

  return {
    frameName: input.frameName,
    fileKey: input.fileKey,
    nodeId: input.nodeId,
    findings: parsed.findings,
    summary: parsed.summary,
    updateSuggestions: parsed.updateSuggestions,
    previousItemsStatus: parsed.previousItemsStatus,
    newFindings: parsed.newFindings,
    savedAt: '' // code.ts에서 new Date().toISOString()으로 채운다
  }
}

export function toMarkdownTable(result: AuditResult): string {
  const header = '| 요소명 | 위치 | 출처 | 결과 | 유사 기존 | 차이점 | 액션 | 심각도 |\n|---|---|---|---|---|---|---|---|'
  const rows = result.findings
    .map((f) => `| ${f.요소명} | ${f.위치} | ${f.출처} | ${f.결과} | ${f.유사기존} | ${f.차이점} | ${f.액션} | ${f.심각도} |`)
    .join('\n')
  const s = result.summary
  const summaryLine = `문제없음 ${s.문제없음} / 심각 ${s.심각} / 보통 ${s.보통} / 경미 ${s.경미} / 예외 ${s.예외} / 확인불가 ${s.확인불가}`
  const suggestHeader = '| 대상 파일 | 제안 | 상태 |\n|---|---|---|'
  const suggestRows = result.updateSuggestions.length
    ? result.updateSuggestions.map((u) => `| ${u.대상파일} | ${u.제안} | ${u.상태} |`).join('\n')
    : ''
  const suggestBlock = result.updateSuggestions.length ? `${suggestHeader}\n${suggestRows}` : '제안 없음'

  return `${header}\n${rows}\n\n${summaryLine}\n\n${suggestBlock}\n`
}

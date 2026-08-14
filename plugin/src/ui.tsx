import { h, JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import {
  Button,
  Container,
  Divider,
  Dropdown,
  DropdownOption,
  IconButton,
  IconInfo16,
  LoadingIndicator,
  render,
  Tabs,
  Text,
  VerticalSpace
} from '@create-figma-plugin/ui'

import type { AuditResult, Finding, MainToUiMessage, ModelId, UiToMainMessage } from './types'

const MODEL_OPTIONS: Array<DropdownOption> = [
  { value: 'claude-opus-5', text: 'Claude Opus 5 (권장 — 판단력)' },
  { value: 'claude-sonnet-5', text: 'Claude Sonnet 5 (비용 절감)' }
]

function postToMain(message: UiToMainMessage): void {
  parent.postMessage({ pluginMessage: message }, '*')
}

function severityColor(severity: string): string {
  return severity === '심각' ? '#d32f2f' : severity === '보통' ? '#e08a00' : severity === '경미' ? '#6b6b6b' : '#999'
}

const SEVERITY_RANK: Record<string, number> = { 심각: 0, 보통: 1, 경미: 2 }
function severityRank(severity: string): number {
  return SEVERITY_RANK[severity] ?? 3
}
function sortBySeverity(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => severityRank(a.심각도) - severityRank(b.심각도))
}

const STATUS_RANK: Record<string, number> = { 미해소: 0, '확인 필요': 1, 해소: 2 }
function sortByStatus<T extends { 상태: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (STATUS_RANK[a.상태] ?? 3) - (STATUS_RANK[b.상태] ?? 3))
}

interface ComponentGroup {
  name: string
  items: Finding[]
}

// 같은 컴포넌트(요소명)의 여러 인스턴스를 한 그룹으로 묶는다 — 그룹 순서는 그룹 안에서 가장 심각한 항목 기준.
function groupByComponent(findings: Finding[]): ComponentGroup[] {
  const order: string[] = []
  const map = new Map<string, Finding[]>()
  for (const f of findings) {
    if (!map.has(f.요소명)) {
      map.set(f.요소명, [])
      order.push(f.요소명)
    }
    map.get(f.요소명)!.push(f)
  }
  return order
    .map((name) => ({ name, items: sortBySeverity(map.get(name) as Finding[]) }))
    .sort((a, b) => severityRank(a.items[0].심각도) - severityRank(b.items[0].심각도))
}

const EMPTY_VALUES = new Set(['—', '', '-'])
const isFilled = (v: string | undefined) => v !== undefined && !EMPTY_VALUES.has(v)

function BulletLine({ children }: { children: JSX.Element | JSX.Element[] }): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <span style={{ color: '#c5c5c5' }}>•</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

function FindingCard({ f }: { f: Finding }): JSX.Element {
  return (
    <div
      style={{
        border: '1px solid var(--figma-color-border, #e5e5e5)',
        borderRadius: 6,
        padding: 12,
        marginBottom: 8
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <Text>
          <b>{f.요소명}</b>
        </Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isFilled(f.nodeId) && (
            <span
              style={{ color: '#0d99ff', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
              onClick={() => postToMain({ type: 'focus-node', nodeId: f.nodeId })}
            >
              이동
            </span>
          )}
          <span style={{ color: severityColor(f.심각도), fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>
            {f.심각도}
          </span>
        </div>
      </div>
      <Text style={{ color: '#999' }}>
        {f.위치} · {f.출처}
      </Text>
      <VerticalSpace space="small" />
      <BulletLine>
        <Text>{f.결과}</Text>
      </BulletLine>
      {isFilled(f.유사기존) && (
        <div>
          <VerticalSpace space="extraSmall" />
          <BulletLine>
            <Text style={{ color: '#999' }}>유사 기존: {f.유사기존}</Text>
          </BulletLine>
        </div>
      )}
      {isFilled(f.차이점) && (
        <div>
          <VerticalSpace space="extraSmall" />
          <BulletLine>
            <Text>차이점: {f.차이점}</Text>
          </BulletLine>
        </div>
      )}
      {isFilled(f.액션) && (
        <div>
          <VerticalSpace space="extraSmall" />
          <BulletLine>
            <Text style={{ fontWeight: 600 }}>액션: {f.액션}</Text>
          </BulletLine>
        </div>
      )}
    </div>
  )
}

function PreviousItemCard({
  요소명,
  이전심각도,
  상태,
  근거
}: {
  요소명: string
  이전심각도: string
  상태: string
  근거: string
}): JSX.Element {
  return (
    <div
      style={{
        border: '1px solid var(--figma-color-border, #e5e5e5)',
        borderRadius: 6,
        padding: 12,
        marginBottom: 8
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <Text>
          <b>{요소명}</b>
        </Text>
        <Text style={{ color: '#999', whiteSpace: 'nowrap' }}>이전: {이전심각도}</Text>
      </div>
      <VerticalSpace space="small" />
      <BulletLine>
        <Text style={{ fontWeight: 600 }}>{상태}</Text>
      </BulletLine>
      <VerticalSpace space="extraSmall" />
      <BulletLine>
        <Text>{근거}</Text>
      </BulletLine>
    </div>
  )
}

function CriteriaPanel(): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontWeight: 600 }}>판정 기준</Text>
        <IconButton onClick={() => setOpen((v) => !v)}>
          <IconInfo16 />
        </IconButton>
      </div>
      {open && (
        <div
          style={{
            border: '1px solid var(--figma-color-border, #e5e5e5)',
            borderRadius: 6,
            padding: 12,
            marginTop: 4,
            marginBottom: 8
          }}
        >
          <Text style={{ fontWeight: 600 }}>심각도</Text>
          <VerticalSpace space="extraSmall" />
          <Text style={{ color: '#999' }}>
            심각 — 시스템 원칙을 깬 것, 반드시 수정 (색·글꼴·모서리를 변수 연결 없이 값 직접 입력)
          </Text>
          <VerticalSpace space="extraSmall" />
          <Text style={{ color: '#999' }}>
            보통 — 고쳐야 하나 급하지 않음 (_deprecated 컴포넌트 사용 / 유사품 있는데 직접 그림 / 크기 고정값·여백 변경 /
            색·글꼴·모서리를 다른 등록된 변수로 교체)
          </Text>
          <VerticalSpace space="extraSmall" />
          <Text style={{ color: '#999' }}>경미 — 기록만 (_wip 컴포넌트 사용 / 유사품 없는데 직접 그림)</Text>
          <VerticalSpace space="extraSmall" />
          <Text style={{ color: '#999' }}>예외 — exceptions.md에 등록되어 승인된 항목</Text>
          <VerticalSpace space="extraSmall" />
          <Text style={{ color: '#999' }}>확인불가 — 구조 데이터를 읽지 못해 판정을 내릴 수 없음</Text>
          <VerticalSpace space="small" />
          <Text style={{ fontWeight: 600 }}>판정 순서 (위에서부터, 맞는 항목이 나오면 멈춤)</Text>
          <VerticalSpace space="extraSmall" />
          <Text style={{ color: '#999' }}>
            예외 등록 확인 → 라이브러리 컴포넌트 인스턴스인지 → _deprecated 여부 → _wip 여부 → 값 변경 여부
            (변경됐다면 변수 연결 없이 직접 입력했는지, 아니면 다른 등록된 변수로 교체했는지로 심각도 구분) →
            (인스턴스가 아니면) 유사품 존재 여부 (근거 2개 이상 일치 시만 인정)
          </Text>
        </div>
      )}
    </div>
  )
}

function ComponentGroupBlock({ group }: { group: ComponentGroup }): JSX.Element {
  return (
    <div style={{ marginBottom: 12 }}>
      <Text style={{ fontWeight: 600 }}>
        {group.name} <span style={{ color: '#999', fontWeight: 400 }}>({group.items.length}건)</span>
      </Text>
      <VerticalSpace space="extraSmall" />
      {group.items.map((f, i) => (
        <FindingCard key={i} f={f} />
      ))}
    </div>
  )
}

function ResultsTable({ result }: { result: AuditResult }): JSX.Element {
  return (
    <div>
      <Text>
        <b>{result.frameName}</b> — {new Date(result.savedAt).toLocaleString()}
      </Text>
      <VerticalSpace space="small" />
      <Text>
        문제없음 {result.summary.문제없음} / 심각 {result.summary.심각} / 보통 {result.summary.보통} / 경미{' '}
        {result.summary.경미} / 예외 {result.summary.예외} / 확인불가 {result.summary.확인불가}
      </Text>
      <VerticalSpace space="medium" />
      {groupByComponent(result.findings).map((g, i) => (
        <ComponentGroupBlock key={i} group={g} />
      ))}
      {result.previousItemsStatus && result.previousItemsStatus.length > 0 && (
        <div>
          <VerticalSpace space="medium" />
          <Text>
            <b>이전 항목 처리 결과</b>
          </Text>
          <VerticalSpace space="small" />
          {sortByStatus(result.previousItemsStatus).map((p, i) => (
            <PreviousItemCard key={i} 요소명={p.요소명} 이전심각도={p.이전심각도} 상태={p.상태} 근거={p.근거} />
          ))}
        </div>
      )}
      {result.newFindings && result.newFindings.length > 0 && (
        <div>
          <VerticalSpace space="medium" />
          <Text>
            <b>신규 발생 항목</b>
          </Text>
          <VerticalSpace space="small" />
          {groupByComponent(result.newFindings).map((g, i) => (
            <ComponentGroupBlock key={i} group={g} />
          ))}
        </div>
      )}
      <VerticalSpace space="medium" />
      <Button
        secondary
        fullWidth
        onClick={() => {
          const md = toMarkdown(result)
          const blob = new Blob([md], { type: 'text/markdown' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${new Date(result.savedAt).toISOString().slice(0, 10)}_${result.frameName}.md`
          a.click()
          URL.revokeObjectURL(url)
        }}
      >
        마크다운으로 내보내기
      </Button>
    </div>
  )
}

function toMarkdown(result: AuditResult): string {
  const header = '| 요소명 | 위치 | 출처 | 결과 | 유사 기존 | 차이점 | 액션 | 심각도 |\n|---|---|---|---|---|---|---|---|'
  const rows = groupByComponent(result.findings)
    .flatMap((g) => g.items)
    .map((f) => `| ${f.요소명} | ${f.위치} | ${f.출처} | ${f.결과} | ${f.유사기존} | ${f.차이점} | ${f.액션} | ${f.심각도} |`)
    .join('\n')
  const s = result.summary
  const summaryLine = `문제없음 ${s.문제없음} / 심각 ${s.심각} / 보통 ${s.보통} / 경미 ${s.경미} / 예외 ${s.예외} / 확인불가 ${s.확인불가}`
  return `${header}\n${rows}\n\n${summaryLine}\n`
}

function Plugin(): JSX.Element {
  const [tab, setTab] = useState<string>('run')
  const [model, setModel] = useState<ModelId>('claude-opus-5')
  const [selectionSummary, setSelectionSummary] = useState('(선택 없음)')
  const [hasPrevious, setHasPrevious] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [results, setResults] = useState<AuditResult[]>([])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as MainToUiMessage | undefined
      if (!msg) return
      switch (msg.type) {
        case 'init':
          setModel(msg.model)
          setSelectionSummary(msg.selectionSummary)
          setHasPrevious(msg.hasPreviousForSelection)
          break
        case 'selection-changed':
          setSelectionSummary(msg.selectionSummary)
          setHasPrevious(msg.hasPreviousForSelection)
          break
        case 'audit-started':
          setLoading(true)
          setErrorMessage(null)
          break
        case 'audit-result':
          setLoading(false)
          setResults(msg.results)
          setTab('result')
          break
        case 'audit-error':
          setLoading(false)
          setErrorMessage(msg.message)
          break
        case 'test-connection-result':
          setTestMessage(msg.ok ? `성공: ${msg.message}` : `실패: ${msg.message}`)
          break
      }
    }
    window.addEventListener('message', handler)
    postToMain({ type: 'request-history' })
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <Container space="medium">
      <VerticalSpace space="small" />
      <Tabs
        value={tab}
        onValueChange={setTab}
        options={[
          { value: 'run', children: '실행' },
          { value: 'settings', children: '설정' },
          { value: 'result', children: '결과' }
        ]}
      />
      <VerticalSpace space="small" />

      {tab === 'run' && (
        <div>
          <Text>선택된 프레임: {selectionSummary}</Text>
          <VerticalSpace space="small" />
          <Text style={{ color: '#999' }}>
            로컬 relay-server가 켜져 있어야 한다 (터미널: cd relay-server && npm start)
          </Text>
          <VerticalSpace space="small" />
          <Button fullWidth disabled={loading} loading={loading} onClick={() => postToMain({ type: 'run-audit' })}>
            검수 시작
          </Button>
          {hasPrevious && (
            <div>
              <VerticalSpace space="small" />
              <Button
                secondary
                fullWidth
                disabled={loading}
                onClick={() => postToMain({ type: 'run-audit', reAudit: true })}
              >
                이전 실행과 재검수
              </Button>
            </div>
          )}
          {loading && (
            <div>
              <VerticalSpace space="small" />
              <LoadingIndicator />
            </div>
          )}
          {errorMessage && (
            <div>
              <VerticalSpace space="small" />
              <Text style={{ color: '#d32f2f' }}>{errorMessage}</Text>
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div>
          <Text>
            <b>연결 방식</b>
          </Text>
          <VerticalSpace space="extraSmall" />
          <Text style={{ color: '#999' }}>
            이 플러그인은 API 키 대신 로컬 relay-server를 통해 이미 로그인된 Claude Code 구독으로 검수를
            처리한다. 검수 전에 터미널에서 아래를 실행해달라:
          </Text>
          <VerticalSpace space="extraSmall" />
          <Text style={{ color: '#999', wordBreak: 'break-all' }}>cd relay-server && npm start</Text>
          <VerticalSpace space="medium" />
          <Divider />
          <VerticalSpace space="medium" />
          <Text>모델</Text>
          <VerticalSpace space="extraSmall" />
          <Dropdown
            options={MODEL_OPTIONS}
            value={model}
            onValueChange={(v) => {
              const m = v as ModelId
              setModel(m)
              postToMain({ type: 'save-model', model: m })
            }}
          />
          <VerticalSpace space="medium" />
          <Divider />
          <VerticalSpace space="medium" />
          <Button secondary onClick={() => postToMain({ type: 'test-connection' })}>
            연결 테스트
          </Button>
          {testMessage && (
            <div>
              <VerticalSpace space="small" />
              <Text>{testMessage}</Text>
            </div>
          )}
        </div>
      )}

      {tab === 'result' && (
        <div>
          <CriteriaPanel />
          <VerticalSpace space="small" />
          {results.length === 0 ? (
            <Text>아직 검수 결과가 없다.</Text>
          ) : (
            results.map((r, i) => (
              <div key={`${r.nodeId}-${r.savedAt}`}>
                {i > 0 && (
                  <div>
                    <VerticalSpace space="medium" />
                    <Divider />
                    <VerticalSpace space="medium" />
                  </div>
                )}
                <ResultsTable result={r} />
              </div>
            ))
          )}
        </div>
      )}

      <VerticalSpace space="medium" />
    </Container>
  )
}

export default render(Plugin)

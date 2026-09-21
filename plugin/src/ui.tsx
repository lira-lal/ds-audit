import { Fragment, h, JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { render } from '@create-figma-plugin/ui'

import { Icon } from './icons'
import { C, FONT, HAIRLINE, R, S, T, sevColor, tint } from './tokens'
import type { AuditResult, Finding, FixPlan, MainToUiMessage, ModelId, UiToMainMessage, ViolationType } from './types'

function post(message: UiToMainMessage): void {
  parent.postMessage({ pluginMessage: message }, '*')
}

// ── 위반 유형 → 화면 문구. criteria.md의 판정과 1:1로 붙는다.
const TYPE_TITLE: Record<ViolationType, string> = {
  컬러: '컬러 변수 미사용',
  모서리: '모서리 변수 미사용',
  간격: '간격 변수 미사용',
  크기: '고정 크기 직접 입력',
  타이포: '텍스트 스타일 미사용',
  컴포넌트: '컴포넌트 미사용'
}
const TYPE_PREFIX: Record<ViolationType, string> = {
  컬러: '배경색', 모서리: '모서리', 간격: '여백', 크기: '크기', 타이포: '글꼴', 컴포넌트: ''
}

const SEV_ORDER = ['심각', '보통', '경미']
const rank = (s: string) => { const i = SEV_ORDER.indexOf(s); return i < 0 ? 9 : i }

// ─────────────────────────────── 부품

function Block({ children, gap = S.sm }: { children: preact.ComponentChildren; gap?: number }): JSX.Element {
  return (
    <div style={{ background: C.surfaceCard, borderRadius: R.md, padding: 14, display: 'flex', flexDirection: 'column', gap }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: preact.ComponentChildren }): JSX.Element {
  return <div style={{ ...T.labelStrong, color: C.textMuted }}>{children}</div>
}

function IconButton({ name, onClick, label }: { name: ' 설정' | '설정' | '뒤로'; onClick: () => void; label: string }): JSX.Element {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: R.md, background: C.surfaceCard,
        border: `${HAIRLINE}px solid ${C.lineHairline}`, display: 'flex',
        alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none'
      }}
    >
      <Icon name={name.trim() as '설정' | '뒤로'} size={14} color={C.textStrong} />
    </button>
  )
}

function BarButton({ kind, label, onClick, disabled, grow = true, icon }: {
  kind: 'primary' | 'subtle'
  label: string
  onClick?: () => void
  disabled?: boolean
  grow?: boolean
  icon?: boolean
}): JSX.Element {
  const primary = kind === 'primary'
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        flex: grow ? 1 : 'none', minWidth: grow ? 0 : 107, height: 48, borderRadius: R.lg, border: 'none',
        background: primary ? C.actionPrimary : C.surfaceSubtle,
        color: primary ? C.textInverse : C.textStrong,
        opacity: disabled ? 0.35 : 1, cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...T.buttonBar
      }}
    >
      {icon && <Icon name="반짝임" size={13} color={C.textInverse} />}
      {label}
    </button>
  )
}

function BottomBar({ children }: { children: preact.ComponentChildren }): JSX.Element {
  return (
    <div style={{ flex: 'none', background: C.surfaceCard, padding: S.lg, display: 'flex', gap: 10 }}>{children}</div>
  )
}

function TypeChip({ type, sev }: { type: ViolationType; sev: string }): JSX.Element {
  const col = sevColor(sev)
  return (
    <div style={{
      width: 20, height: 20, borderRadius: R.sm, background: tint(col),
      display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none'
    }}>
      <Icon name={type} size={11} color={col} />
    </div>
  )
}

function ValueChip({ children }: { children: preact.ComponentChildren }): JSX.Element {
  return (
    <span style={{
      background: C.surfaceChip, borderRadius: R.sm, padding: '2px 6px',
      ...T.bodyDefault, color: C.textBody, whiteSpace: 'nowrap'
    }}>{children}</span>
  )
}

function ListItem({ f, fix, blockedReason, last }: {
  f: Finding
  fix?: FixPlan
  blockedReason?: string
  last: boolean
}): JSX.Element {
  const type = (f.유형 && f.유형[0]) || '컴포넌트'
  return (
    <div style={{
      display: 'flex', gap: S.lg, alignItems: 'center', padding: '16px 0',
      borderBottom: last ? 'none' : `${HAIRLINE}px solid ${C.lineHairline}`
    }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: S.xs }}>
        <div style={{ display: 'flex', gap: S.sm, alignItems: 'center' }}>
          <TypeChip type={type} sev={f.심각도} />
          <span style={{ ...T.titleItem, color: C.textStrong, whiteSpace: 'nowrap' }}>{TYPE_TITLE[type]}</span>
          <span
            onClick={() => post({ type: 'focus-node', nodeId: f.nodeId })}
            style={{ display: 'inline-flex', gap: 4, alignItems: 'center', cursor: 'pointer', minWidth: 0 }}
          >
            <span style={{ ...T.labelMeta, color: C.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.요소명}
            </span>
            <Icon name="이동" size={6} color={C.textFaint} width={1} />
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', ...T.bodyDefault, color: C.textBody }}>
          {fix ? (
            <>
              {TYPE_PREFIX[fix.유형] && <span>{TYPE_PREFIX[fix.유형]}</span>}
              <ValueChip>{fix.현재값}</ValueChip>
              <span>→</span>
              <ValueChip>{fix.목표값}</ValueChip>
            </>
          ) : (
            <span>{f.차이점 && f.차이점 !== '—' ? f.차이점 : f.결과}</span>
          )}
        </div>

        {!fix && blockedReason && (
          <div style={{ ...T.labelMeta, color: C.textFaint }}>자동 수정할 수 없어요 — {blockedReason}</div>
        )}
      </div>

      <button
        onClick={fix ? () => post({ type: 'apply-fixes', nodeIds: [f.nodeId] }) : undefined}
        disabled={!fix}
        style={{
          width: 42, height: 28, borderRadius: R.md, border: 'none', flex: 'none',
          background: fix ? C.actionPrimary : C.surfaceMuted,
          color: fix ? C.textInverse : C.textFaint,
          cursor: fix ? 'pointer' : 'default', ...T.buttonSmall
        }}
      >
        {fix ? 'fix' : '수동'}
      </button>
    </div>
  )
}

// ─────────────────────────────── 화면

function PrepareScreen({ selection, model, serverOk, loading, progress, error, onStart, onSettings }: {
  selection: string[]
  model: ModelId
  serverOk: boolean | null
  loading: boolean
  progress: { done: number; total: number; currentFrame: string } | null
  error: string | null
  onStart: () => void
  onSettings: () => void
}): JSX.Element {
  const empty = selection.length === 0
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: `12px ${S.lg}px`, display: 'flex', flexDirection: 'column', gap: S.lg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.md }}>
          <div style={{ flex: 1, ...T.titlePage, color: C.actionPrimary }}>검수 준비</div>
          <IconButton name="설정" label="설정" onClick={onSettings} />
        </div>

        <SectionLabel>검수 대상</SectionLabel>
        {loading ? (
          <Block gap={10}>
            <div style={{ ...T.titleItem, color: C.textStrong }}>
              {progress ? `${progress.total}개 프레임을 대조하고 있습니다.` : '대조하고 있습니다.'}
            </div>
            <div style={{ height: 6, borderRadius: 3, background: C.surfaceChip, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: C.actionPrimary }} />
            </div>
            {progress && progress.currentFrame && (
              <div style={{ ...T.bodyDefault, color: C.textBody }}>{progress.currentFrame} 진행 중</div>
            )}
          </Block>
        ) : empty ? (
          <Block>
            <div style={{ ...T.titleItem, color: C.textStrong }}>선택된 프레임이 없습니다.</div>
            <div style={{ ...T.bodyDefault, color: C.textBody }}>
              캔버스에서 검수할 프레임을 하나 이상 선택해 주세요. 여러 개를 한 번에 고를 수 있어요.
            </div>
          </Block>
        ) : (
          <Block gap={10}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ ...T.numHero, color: C.actionPrimary }}>{selection.length}</span>
              <span style={{ ...T.bodyDefault, color: C.textMuted }}>개 프레임 선택됨</span>
            </div>
            <div style={{ height: 1, background: C.lineDefault }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {selection.map((n, i) => (
                <div key={i} style={{ ...T.bodyItem, color: C.textStrong, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</div>
              ))}
            </div>
          </Block>
        )}

        <SectionLabel>실행 환경</SectionLabel>
        <Block gap={10}>
          <StatusRow on={serverOk !== false} text={serverOk === false ? '릴레이 서버에 연결하지 못했습니다.' : '릴레이 서버 연결됨'} />
          <StatusRow on={false} text={model === 'claude-opus-5' ? 'Claude Opus 5' : 'Claude Sonnet 5'} action="변경" onAction={onSettings} />
          {error && (
            <div style={{ ...T.bodyDefault, color: C.sev심각 }}>{error}</div>
          )}
          {serverOk === false && (
            <div style={{ background: C.surfaceChip, borderRadius: R.sm, padding: '6px 8px', ...T.bodyDefault, color: C.textBody, wordBreak: 'break-all' }}>
              cd relay-server &amp;&amp; npm start
            </div>
          )}
        </Block>
      </div>

      <BottomBar>
        <BarButton
          kind="primary"
          label={loading ? '검수 중…' : serverOk === false ? '다시 시도' : '검수 시작'}
          disabled={loading || empty}
          onClick={onStart}
        />
      </BottomBar>
    </>
  )
}

function StatusRow({ on, text, action, onAction }: { on: boolean; text: string; action?: string; onAction?: () => void }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: on ? C.stateOn : C.stateIdle, flex: 'none' }} />
      <span style={{ flex: 1, ...T.bodyDefault, color: C.textStrong }}>{text}</span>
      {action && <span onClick={onAction} style={{ ...T.bodyDefault, color: C.textMuted, cursor: 'pointer' }}>{action}</span>}
    </div>
  )
}

function SettingsScreen({ model, onModel, onBack, onTest, testResult }: {
  model: ModelId
  onModel: (m: ModelId) => void
  onBack: () => void
  onTest: () => void
  testResult: { ok: boolean; message: string } | null
}): JSX.Element {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: `12px ${S.lg}px`, display: 'flex', flexDirection: 'column', gap: S.lg }}>
      <div style={{ display: 'flex', paddingBottom: 2 }}>
        <IconButton name="뒤로" label="뒤로" onClick={onBack} />
      </div>
      <div style={{ ...T.titlePage, color: C.actionPrimary }}>설정</div>

      <SectionLabel>연결 방식</SectionLabel>
      <Block>
        <div style={{ ...T.bodyDefault, color: C.textBody }}>
          API 키 없이, 이미 로그인된 Claude Code 구독으로 검수합니다. 시안 데이터는 이 맥 밖으로 나가지 않아요.
        </div>
        <div style={{ background: C.surfaceChip, borderRadius: R.sm, padding: '6px 8px', ...T.bodyDefault, color: C.textBody, wordBreak: 'break-all' }}>
          cd relay-server &amp;&amp; npm start
        </div>
      </Block>

      <SectionLabel>모델</SectionLabel>
      <Block gap={0}>
        {([
          ['claude-opus-5', 'Claude Opus 5', '판단력 우선 · 권장'],
          ['claude-sonnet-5', 'Claude Sonnet 5', '비용 절감']
        ] as Array<[ModelId, string, string]>).map(([id, name, desc], i) => (
          <div
            key={id}
            onClick={() => onModel(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer',
              borderTop: i > 0 ? `${HAIRLINE}px solid ${C.lineDefault}` : 'none'
            }}
          >
            <span style={{
              width: 14, height: 14, borderRadius: '50%', flex: 'none',
              border: model === id ? `4px solid ${C.actionPrimary}` : `1px solid ${C.lineHairline}`,
              background: C.surfaceCard
            }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', ...T.bodyItem, fontWeight: model === id ? 700 : 400, color: C.textStrong }}>{name}</span>
              <span style={{ display: 'block', ...T.labelMeta, color: C.textFaint }}>{desc}</span>
            </span>
          </div>
        ))}
      </Block>

      <SectionLabel>연결 상태</SectionLabel>
      <Block gap={10}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: testResult?.ok ? C.stateOn : C.stateIdle, flex: 'none' }} />
          <span style={{ flex: 1, ...T.bodyDefault, color: C.textStrong, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {testResult ? testResult.message : '아직 확인하지 않았어요'}
          </span>
          <button
            onClick={onTest}
            style={{
              height: 28, padding: '0 12px', borderRadius: R.md, border: 'none', flex: 'none',
              background: C.actionPrimary, color: C.textInverse, cursor: 'pointer', ...T.bodyDefault, fontWeight: 600
            }}
          >
            연결 테스트
          </button>
        </div>
        {testResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: S.xs }}>
            <Icon name="체크" size={12} color={testResult.ok ? C.stateOn : C.sev심각} />
            <span style={{ ...T.bodyDefault, color: testResult.ok ? C.stateOn : C.sev심각 }}>
              {testResult.ok ? '연결 성공' : '연결 실패'}
            </span>
          </div>
        )}
      </Block>
    </div>
  )
}

function ResultScreen({ results, active, onActive, onSettings, onFixAll, onClose, fixedCount }: {
  results: AuditResult[]
  active: number
  onActive: (i: number) => void
  onSettings: () => void
  onFixAll: () => void
  onClose: () => void
  fixedCount: number | null
}): JSX.Element {
  const r = results[active]
  const fixByNode = new Map<string, FixPlan>()
  for (const p of r.fixes) if (!fixByNode.has(p.nodeId)) fixByNode.set(p.nodeId, p)
  const blockedByNode = new Map<string, string>()
  for (const b of r.blocked) blockedByNode.set(b.nodeId, b.사유)

  const groups: Array<[string, Finding[]]> = []
  for (const sev of SEV_ORDER) {
    const items = r.findings.filter((f) => f.심각도 === sev).sort((a, b) => rank(a.심각도) - rank(b.심각도))
    if (items.length) groups.push([sev, items])
  }
  const fixable = r.fixes.length
  const total = r.findings.length
  const when = new Date(r.savedAt)
  const meta = `${when.getMonth() + 1}월 ${when.getDate()}일 ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')} · 프레임 ${results.length}개`

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: `12px ${S.lg}px`, display: 'flex', flexDirection: 'column', gap: S.xl }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: S.xl }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: S.md }}>
            <div style={{ flex: 1, ...T.titlePage, color: C.actionPrimary }}>검수 결과</div>
            <IconButton name="설정" label="설정" onClick={onSettings} />
          </div>
          <div style={{ ...T.bodyDefault, color: C.textMuted, marginTop: -16 }}>{meta}</div>

          {results.length > 1 && (
            <div style={{ borderBottom: `${HAIRLINE}px solid ${C.lineDefault}`, display: 'flex', gap: 20 }}>
              {results.map((x, i) => {
                const on = i === active
                return (
                  <div key={i} onClick={() => onActive(i)} style={{
                    paddingBottom: 9, cursor: 'pointer',
                    borderBottom: on ? `2px solid ${C.actionPrimary}` : '2px solid transparent',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    <span style={{ ...T.labelTab, fontWeight: on ? 700 : 500, color: on ? C.textStrong : C.textFaint, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {x.frameName}
                    </span>
                    <span style={{ background: C.surfaceMuted, borderRadius: R.full, padding: '1px 6px', ...T.labelStrong, color: x.findings.length ? C.textStrong : C.textFaint }}>
                      {x.findings.length}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', border: `${HAIRLINE}px solid ${C.lineDefault}`, borderRadius: R.md, background: C.surfaceCard, overflow: 'hidden' }}>
            {([['심각', r.summary.심각, C.sev심각], ['보통', r.summary.보통, C.sev보통], ['경미', r.summary.경미, null], ['문제없음', r.summary.문제없음, null]] as Array<[string, number, string | null]>).map(([label, n, col], i) => (
              <div key={label} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                borderLeft: i > 0 ? `${HAIRLINE}px solid ${C.lineDefault}` : 'none'
              }}>
                <span style={{ flex: 1, ...T.labelMicro, color: col ?? C.textMuted }}>{label}</span>
                <span style={{ ...T.labelStrong, color: col ?? (n > 0 ? C.textStrong : C.textFaint) }}>{n}</span>
              </div>
            ))}
          </div>
        </div>

        {fixedCount !== null && (
          <Block gap={6}>
            <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
              <Icon name="체크" size={14} color={C.sev문제없음} width={1.8} />
              <span style={{ ...T.titleItem, color: C.textStrong }}>{fixedCount}건을 수정했습니다.</span>
            </div>
            <div style={{ ...T.bodyDefault, color: C.textBody }}>
              되돌리려면 Cmd+Z를 누르세요.{total > 0 ? ` 남은 ${total}건은 직접 판단해야 해요.` : ''}
            </div>
          </Block>
        )}

        {groups.length === 0 ? (
          <Block>
            <div style={{ ...T.titleItem, color: C.textStrong }}>어긋난 곳이 없습니다.</div>
            <div style={{ ...T.bodyDefault, color: C.textBody }}>
              모든 요소가 라이브러리 컴포넌트를 쓰고 있고, 값도 등록된 변수에 연결돼 있어요.
            </div>
          </Block>
        ) : (
          groups.map(([sev, items]) => (
            <div key={sev} style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
              <div style={{ ...T.titleGroup, color: sevColor(sev), padding: '0 4px' }}>{sev}</div>
              <div style={{ background: C.surfaceCard, borderRadius: R.md, padding: '0 14px' }}>
                {items.map((f, i) => (
                  <ListItem
                    key={f.nodeId + i}
                    f={f}
                    fix={fixByNode.get(f.nodeId)}
                    blockedReason={blockedByNode.get(f.nodeId)}
                    last={i === items.length - 1}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <BottomBar>
        {fixable > 0 && <BarButton kind="primary" icon label={`자동 수정 (${fixable}건)`} onClick={onFixAll} />}
        <BarButton kind="subtle" label="종료" grow={fixable === 0} onClick={onClose} />
      </BottomBar>
    </>
  )
}

// ─────────────────────────────── 본체

function Plugin(): JSX.Element {
  const [screen, setScreen] = useState<'prepare' | 'settings' | 'result'>('prepare')
  const [prev, setPrev] = useState<'prepare' | 'result'>('prepare')
  const [model, setModel] = useState<ModelId>('claude-opus-5')
  const [selection, setSelection] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; currentFrame: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [serverOk, setServerOk] = useState<boolean | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [results, setResults] = useState<AuditResult[]>([])
  const [active, setActive] = useState(0)
  const [fixedCount, setFixedCount] = useState<number | null>(null)

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as MainToUiMessage | undefined
      if (!msg) return
      switch (msg.type) {
        case 'init':
          setModel(msg.model); setSelection(msg.selection); break
        case 'selection-changed':
          setSelection(msg.selection); break
        case 'audit-started':
          setLoading(true); setError(null); setProgress(null); setFixedCount(null); break
        case 'audit-progress':
          setProgress({ done: msg.done, total: msg.total, currentFrame: msg.currentFrame }); break
        case 'audit-result':
          setLoading(false); setProgress(null); setResults(msg.results); setActive(0); setServerOk(true); setScreen('result'); break
        case 'audit-error':
          setLoading(false); setProgress(null); setError(msg.message)
          if (msg.message.indexOf('연결') !== -1) setServerOk(false)
          break
        case 'test-connection-result':
          setTestResult({ ok: msg.ok, message: msg.message }); setServerOk(msg.ok); break
        case 'fix-result': {
          const ok = msg.outcomes.filter((o) => o.ok).length
          setResults(msg.results); setFixedCount(ok); break
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const openSettings = () => { setPrev(screen === 'result' ? 'result' : 'prepare'); setScreen('settings') }

  return (
    <div style={{
      width: '100%', height: '100vh', background: C.surfacePage, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', color: C.textStrong, boxSizing: 'border-box'
    }}>
      {screen === 'prepare' && (
        <PrepareScreen
          selection={selection} model={model} serverOk={serverOk}
          loading={loading} progress={progress} error={error}
          onStart={() => post({ type: 'run-audit' })}
          onSettings={openSettings}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          model={model}
          onModel={(m) => { setModel(m); post({ type: 'save-model', model: m }) }}
          onBack={() => setScreen(prev)}
          onTest={() => post({ type: 'test-connection' })}
          testResult={testResult}
        />
      )}
      {screen === 'result' && results.length > 0 && (
        <ResultScreen
          results={results} active={active} onActive={setActive}
          onSettings={openSettings}
          onFixAll={() => post({ type: 'apply-fixes' })}
          onClose={() => { setResults([]); setFixedCount(null); setScreen('prepare'); post({ type: 'go-back' }) }}
          fixedCount={fixedCount}
        />
      )}
    </div>
  )
}

export default render(Plugin)

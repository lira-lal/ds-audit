import { showUI } from '@create-figma-plugin/utilities'
import { extractFrame } from './extract'
import { applyFixes, collectVariables, planFixes } from './autofix'
import { describeError, judgeFrame, testConnection } from './claudeClient'
import type {
  AuditResult,
  FixPlan,
  InitMessage,
  MainToUiMessage,
  ModelId,
  SelectionChangedMessage,
  Summary,
  UiToMainMessage
} from './types'

const MODEL_STORAGE_KEY = 'model'
const DEFAULT_MODEL: ModelId = 'claude-opus-5'

/** 마지막 검수 결과. 자동 수정은 이 결과를 기준으로 적용한다. */
let lastResults: AuditResult[] = []

function post(message: MainToUiMessage): void {
  figma.ui.postMessage(message)
}

/** 선택한 프레임 이름 목록. 화면이 개수와 목록을 따로 쓰므로 배열로 넘긴다. */
function selection(): string[] {
  return figma.currentPage.selection.map((n) => n.name)
}

function sendSelectionChanged(): void {
  const message: SelectionChangedMessage = { type: 'selection-changed', selection: selection() }
  post(message)
}

async function init(): Promise<void> {
  const model = (await figma.clientStorage.getAsync(MODEL_STORAGE_KEY)) ?? DEFAULT_MODEL
  const message: InitMessage = { type: 'init', model, selection: selection() }
  post(message)
}

async function runAudit(): Promise<void> {
  const targets = figma.currentPage.selection
  if (targets.length === 0) {
    post({ type: 'audit-error', message: '검수할 프레임을 하나 이상 선택해 주세요.' })
    return
  }
  const model = (await figma.clientStorage.getAsync(MODEL_STORAGE_KEY)) ?? DEFAULT_MODEL
  const fileKey = figma.fileKey ?? '(local)'

  post({ type: 'audit-started' })

  // 값 비교용 변수 목록은 프레임마다 다시 읽을 이유가 없다
  const vars = await collectVariables()

  const results: AuditResult[] = []
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]
    post({ type: 'audit-progress', done: i, total: targets.length, currentFrame: target.name })
    try {
      const extracted = await extractFrame(target, fileKey)
      if (extracted.skippedForSize) {
        figma.notify(`${target.name}: 프레임이 커서 일부 요소는 건너뛰었습니다.`)
      }

      const result = await judgeFrame({
        model,
        extractedFrameJson: JSON.stringify(extracted),
        fileKey,
        nodeId: target.id,
        frameName: target.name
      })
      result.savedAt = new Date().toISOString()

      // 판정은 모델이, 수정 계획은 여기서
      const planned = planFixes(extracted, result.findings, vars)
      result.fixes = planned.fixes
      result.blocked = planned.blocked

      results.push(result)
    } catch (e) {
      figma.notify(`${target.name} 검수 실패: ${describeError(e)}`)
    }
  }

  if (results.length === 0) {
    post({ type: 'audit-error', message: '선택한 프레임을 모두 검수하지 못했습니다.' })
    return
  }

  post({ type: 'audit-progress', done: targets.length, total: targets.length, currentFrame: '' })
  lastResults = results
  post({ type: 'audit-result', results })
}

function recountSummary(findings: AuditResult['findings'], before: Summary): Summary {
  const next: Summary = { ...before, 심각: 0, 보통: 0, 경미: 0 }
  for (const f of findings) {
    if (f.심각도 === '심각') next.심각++
    else if (f.심각도 === '보통') next.보통++
    else if (f.심각도 === '경미') next.경미++
  }
  return next
}

/**
 * 수정을 적용한 뒤 결과에서 고쳐진 항목을 덜어낸다.
 * 다시 검수하지 않는 이유: 고친 항목이 더 이상 위반이 아니라는 건 추론이 아니라
 * 방금 우리가 한 일이라 확실하다. 재판정에 다시 비용을 쓸 이유가 없다.
 */
async function handleApplyFixes(nodeIds?: string[]): Promise<void> {
  const wanted = nodeIds && nodeIds.length ? new Set(nodeIds) : null
  const plans: FixPlan[] = []
  for (const r of lastResults) {
    for (const p of r.fixes) {
      if (!wanted || wanted.has(p.nodeId)) plans.push(p)
    }
  }
  if (plans.length === 0) {
    post({ type: 'fix-result', outcomes: [], results: lastResults })
    return
  }

  const outcomes = await applyFixes(plans)
  const fixedNodes = new Set(outcomes.filter((o) => o.ok).map((o) => o.nodeId))

  lastResults = lastResults.map((r) => {
    const findings = r.findings.filter((f) => !fixedNodes.has(f.nodeId))
    return {
      ...r,
      findings,
      fixes: r.fixes.filter((p) => !fixedNodes.has(p.nodeId)),
      summary: recountSummary(findings, r.summary)
    }
  })

  const failed = outcomes.filter((o) => !o.ok).length
  if (failed > 0) figma.notify(`${failed}건은 수정하지 못했습니다.`)
  post({ type: 'fix-result', outcomes, results: lastResults })
}

export default function (): void {
  showUI({ width: 480, height: 720 })

  figma.on('selectionchange', () => sendSelectionChanged())

  figma.ui.onmessage = async (msg: UiToMainMessage) => {
    try {
      switch (msg.type) {
        case 'save-model':
          await figma.clientStorage.setAsync(MODEL_STORAGE_KEY, msg.model)
          break
        case 'test-connection': {
          const result = await testConnection()
          post({ type: 'test-connection-result', ...result })
          break
        }
        case 'run-audit':
          await runAudit()
          break
        case 'apply-fixes':
          await handleApplyFixes(msg.nodeIds)
          break
        case 'go-back':
          lastResults = []
          sendSelectionChanged()
          break
        case 'focus-node': {
          const node = await figma.getNodeByIdAsync(msg.nodeId)
          if (!node || !('x' in node)) {
            figma.notify('해당 요소를 찾을 수 없습니다 — 이후 편집으로 삭제됐을 수 있습니다.')
            break
          }
          const sceneNode = node as SceneNode
          let ancestor: BaseNode | null = sceneNode
          while (ancestor && ancestor.type !== 'PAGE') ancestor = ancestor.parent
          if (ancestor && ancestor.type === 'PAGE' && ancestor.id !== figma.currentPage.id) {
            await figma.setCurrentPageAsync(ancestor as PageNode)
          }
          figma.currentPage.selection = [sceneNode]
          figma.viewport.scrollAndZoomIntoView([sceneNode])
          break
        }
      }
    } catch (e) {
      post({ type: 'audit-error', message: describeError(e) })
    }
  }

  init().catch(() => {})
}

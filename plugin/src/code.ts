import { showUI } from '@create-figma-plugin/utilities'
import { extractFrame } from './extract'
import { describeError, judgeFrame, testConnection } from './claudeClient'
import type {
  AuditResult,
  InitMessage,
  MainToUiMessage,
  ModelId,
  SelectionChangedMessage,
  UiToMainMessage
} from './types'

const MODEL_STORAGE_KEY = 'model'
const DEFAULT_MODEL: ModelId = 'claude-opus-5'

function historyStorageKey(fileKey: string, nodeId: string): string {
  return `history:${fileKey}:${nodeId}`
}

async function listHistoryKeys(): Promise<string[]> {
  const keys = await figma.clientStorage.keysAsync()
  return keys.filter((k) => k.startsWith('history:'))
}

function post(message: MainToUiMessage): void {
  figma.ui.postMessage(message)
}

function selectionSummary(): string {
  const selection = figma.currentPage.selection
  if (selection.length === 0) return '(선택 없음)'
  return selection.map((n) => n.name).join(', ')
}

async function hasPreviousForCurrentSelection(): Promise<boolean> {
  const selection = figma.currentPage.selection
  if (selection.length === 0) return false
  const fileKey = figma.fileKey ?? '(local)'
  for (const node of selection) {
    const stored = await figma.clientStorage.getAsync(historyStorageKey(fileKey, node.id))
    if (stored) return true
  }
  return false
}

async function sendSelectionChanged(): Promise<void> {
  const message: SelectionChangedMessage = {
    type: 'selection-changed',
    selectionSummary: selectionSummary(),
    historyKeys: await listHistoryKeys(),
    hasPreviousForSelection: await hasPreviousForCurrentSelection()
  }
  post(message)
}

async function init(): Promise<void> {
  const model = (await figma.clientStorage.getAsync(MODEL_STORAGE_KEY)) ?? DEFAULT_MODEL
  const message: InitMessage = {
    type: 'init',
    model,
    selectionSummary: selectionSummary(),
    historyKeys: await listHistoryKeys(),
    hasPreviousForSelection: await hasPreviousForCurrentSelection()
  }
  post(message)
}

async function runAudit(reAudit?: boolean): Promise<void> {
  const selection = figma.currentPage.selection
  if (selection.length === 0) {
    post({ type: 'audit-error', message: '프레임을 하나 이상 선택해달라.' })
    return
  }
  const model = (await figma.clientStorage.getAsync(MODEL_STORAGE_KEY)) ?? DEFAULT_MODEL
  const fileKey = figma.fileKey ?? '(local)'

  post({ type: 'audit-started' })

  // 선택한 프레임(시안) 각각을 별도로 검수한다 — 하나로 합쳐서 판정하면 시안 구분이 사라진다.
  const results: AuditResult[] = []
  for (const target of selection) {
    try {
      const extracted = await extractFrame(target, fileKey)
      if (extracted.skippedForSize) {
        figma.notify(`${target.name}: 프레임이 커서 일부 요소는 건너뛰었다.`)
      }

      let previousResult: AuditResult | undefined
      if (reAudit) {
        const stored = await figma.clientStorage.getAsync(historyStorageKey(fileKey, target.id))
        if (stored) previousResult = stored as AuditResult
      }

      const result = await judgeFrame({
        model,
        extractedFrameJson: JSON.stringify(extracted),
        fileKey,
        nodeId: target.id,
        frameName: target.name,
        previousResult
      })
      result.savedAt = new Date().toISOString()

      await figma.clientStorage.setAsync(historyStorageKey(fileKey, target.id), result)
      results.push(result)
    } catch (e) {
      figma.notify(`${target.name} 검수 실패: ${describeError(e)}`)
    }
  }

  if (results.length === 0) {
    post({ type: 'audit-error', message: '선택한 프레임을 모두 검수하지 못했다.' })
    return
  }

  post({ type: 'audit-result', results })
  await sendSelectionChanged()
}

export default function (): void {
  showUI({ width: 480, height: 720 })

  figma.on('selectionchange', () => {
    sendSelectionChanged().catch(() => {})
  })

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
          await runAudit(msg.reAudit)
          break
        case 'request-history': {
          const historyKeys = await listHistoryKeys()
          const history = (
            await Promise.all(historyKeys.map((k) => figma.clientStorage.getAsync(k)))
          ).filter(Boolean) as AuditResult[]
          post({ type: 'history-result', history })
          break
        }
        case 'focus-node': {
          const node = await figma.getNodeByIdAsync(msg.nodeId)
          if (!node || !('x' in node)) {
            figma.notify('해당 요소를 찾을 수 없다 — 이후 편집으로 삭제됐을 수 있다.')
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

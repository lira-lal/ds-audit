import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LAST_JUDGE_LOG = resolve(__dirname, 'last-judge.json')

const PORT = 8787
const EXEC_OPTS = { maxBuffer: 20 * 1024 * 1024, timeout: 180000 }

function runClaude(args) {
  return new Promise((resolve) => {
    const child = execFile('claude', args, EXEC_OPTS, (error, stdout, stderr) => {
      resolve({ error, stdout: stdout ?? '', stderr: stderr ?? '' })
    })
    // stdin을 안 닫으면 claude CLI가 추가 입력을 기다리며 멈춘다.
    child.stdin?.end()
  })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function sendJson(res, status, body) {
  withCors(res)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function handleHealth(res) {
  const { error, stdout, stderr } = await runClaude(['auth', 'status'])
  if (error && !stdout) {
    sendJson(res, 500, { loggedIn: false, error: stderr || error.message })
    return
  }
  try {
    sendJson(res, 200, JSON.parse(stdout))
  } catch {
    sendJson(res, 500, { loggedIn: false, error: 'claude auth status 출력 파싱 실패: ' + stdout.slice(0, 300) })
  }
}

async function handleJudge(req, res) {
  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch {
    sendJson(res, 400, { error: '요청 본문이 JSON이 아니다.' })
    return
  }

  const { systemPrompt, userPrompt, model } = body
  if (!userPrompt || !model) {
    sendJson(res, 400, { error: 'userPrompt와 model이 필요하다.' })
    return
  }

  const args = ['-p', userPrompt, '--output-format', 'json', '--tools', '', '--model', model]
  if (systemPrompt) args.push('--system-prompt', systemPrompt)

  const { error, stdout, stderr } = await runClaude(args)

  // 결과가 이상할 때 바로 원본을 볼 수 있도록 마지막 요청/응답을 파일로 남긴다.
  const logBody = {
    at: new Date().toISOString(),
    request: { systemPrompt, userPrompt, model },
    rawStdout: stdout,
    rawStderr: stderr,
    execError: error ? error.message : null
  }
  writeFile(LAST_JUDGE_LOG, JSON.stringify(logBody, null, 2), 'utf-8').catch(() => {})

  if (error && !stdout) {
    sendJson(res, 500, { error: stderr || error.message })
    return
  }

  try {
    const cliResult = JSON.parse(stdout)
    sendJson(res, 200, {
      text: cliResult.result,
      subtype: cliResult.subtype,
      isError: cliResult.is_error
    })
  } catch {
    sendJson(res, 500, { error: 'claude -p 출력 파싱 실패: ' + stdout.slice(0, 500) })
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    withCors(res)
    res.writeHead(204)
    res.end()
    return
  }
  if (req.method === 'GET' && req.url === '/health') {
    await handleHealth(res)
    return
  }
  if (req.method === 'POST' && req.url === '/judge') {
    await handleJudge(req, res)
    return
  }
  sendJson(res, 404, { error: 'not found' })
})

server.listen(PORT, () => {
  console.log(`ds-audit relay server: http://localhost:${PORT} 에서 대기 중`)
  console.log('이 창을 켜둔 채로 Figma 플러그인을 사용해달라.')
})

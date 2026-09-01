# DS Audit

피그마 시안이 디자인 시스템을 따르는지 대조해서, 어긋난 요소를 심각도와 함께 짚어주는 검수 도구.

**Figma 플러그인**으로 쓰거나, **Claude Code 스킬**로 터미널에서 쓸 수 있다. 둘 다 같은 판정 기준(`criteria.md`)과 같은 컴포넌트 목록(`data/`)을 근거로 판정한다.

<br>

## 어떻게 동작하나

```
┌─────────────────────────┐
│  Figma 플러그인          │  프레임 선택 → 노드 트리에서
│  (plugin/)              │  구조 신호만 추출 (판정 안 함)
└───────────┬─────────────┘
            │  POST http://localhost:8787/judge
            ▼
┌─────────────────────────┐
│  릴레이 서버             │  claude -p --output-format json
│  (relay-server/)        │  --tools '' --model <선택한 모델>
└───────────┬─────────────┘
            │
            ▼
      Claude Code CLI  ←── 이미 로그인된 구독 사용
            │
            ▼  판정 결과 JSON
┌─────────────────────────┐
│  플러그인 UI             │  심각도별 표시 · 클릭하면 해당 노드로 포커스
└─────────────────────────┘
```

**API 키가 필요 없다.** Anthropic API를 직접 부르지 않고, 로컬 릴레이 서버가 이미 로그인된 Claude Code CLI를 실행한다. 그래서 별도 키 발급 없이 기존 구독 사용량으로 처리된다.

시안 데이터는 로컬 릴레이 서버(`localhost:8787`)만 거친다. 플러그인 매니페스트의 `networkAccess.allowedDomains` 는 `none` 이라 외부로 나가는 경로가 없다.

<br>

## Figma 플러그인으로 쓰기

### 1. 데이터 파일 채우기

빌드 시 `data/` 와 `criteria.md` 내용이 시스템 프롬프트로 구워지므로(`npm run bake`), **빌드 전에 먼저 채운다.**

`data/components.md` 의 변수 표가 비어 있다. Claude Code에서:

```
라이브러리 변수 목록 뽑아줘
https://figma.com/design/{라이브러리 링크}
```

나온 표를 `data/components.md` 의 변수 절에 붙인다.

### 2. 플러그인 빌드

```bash
cd plugin
npm install
npm run build
```

`npm run build` 는 두 단계다.

| 단계 | 하는 일 |
|---|---|
| `npm run bake` | `criteria.md` + `data/*.md` → `src/promptData.generated.ts` 로 시스템 프롬프트 생성 |
| `build-figma-plugin` | `manifest.json` 과 `build/main.js`, `build/ui.js` 생성 |

`manifest.json` 과 `promptData.generated.ts` 는 빌드 산출물이라 git에 없다. **빌드를 돌려야 생긴다.**

개발 중에는 `npm run watch` 로 자동 재빌드.

### 3. Figma에 불러오기

Figma **데스크톱 앱**에서 (브라우저는 개발 플러그인 로드가 안 된다):

```
Plugins → Development → Import plugin from manifest…
→ plugin/manifest.json 선택
```

### 4. 릴레이 서버 켜기

검수를 돌리기 전에 별도 터미널에서 띄워둔다. 이게 안 켜져 있으면 플러그인이 판정을 못 한다.

```bash
cd relay-server
npm start          # localhost:8787
```

Claude CLI가 로그인돼 있어야 한다. 플러그인 UI의 **연결 테스트** 버튼이 `/health` 로 `claude auth status` 를 확인해준다.

### 5. 검수

1. 캔버스에서 검수할 프레임을 선택한다 (여러 개 선택 가능)
2. 플러그인에서 모델을 고른다 — **Opus 5**(권장, 판단력) 또는 **Sonnet 5**(비용 절감)
3. **검수 시작** 실행

<br>

## 플러그인 기능

| 기능 | 설명 |
|---|---|
| **선택 연동** | 캔버스 선택이 바뀌면 플러그인이 대상을 자동으로 따라간다 |
| **여러 프레임 일괄 검수** | 선택한 프레임을 순서대로 처리 |
| **심각도별 결과** | 심각 · 보통 · 경미 · 예외 · 확인불가 로 분류, 요약 카운트 제공 |
| **노드 포커스** | 결과 행을 클릭하면 캔버스의 해당 요소로 이동 (다른 페이지면 페이지까지 전환) |
| **검수 이력** | `figma.clientStorage` 에 파일·노드 단위로 저장 |
| **재검수 비교** | 이전 결과와 대조해 **해소 / 미해소 / 확인 필요** 판정 + 신규 발생 항목 분리 |

프레임이 크면 요소 200개까지만 추출하고 나머지는 건너뛴다 (건너뛴 경우 Figma 알림으로 알려준다).

<br>

## 판정 기준

`.claude/skills/ds-audit/references/criteria.md` 가 유일한 기준 문서다. 플러그인과 스킬이 같은 파일을 쓴다.

핵심 판정 축:

- **출처** — 라이브러리 인스턴스인가, 직접 그렸는가
- **오버라이드** — 인스턴스의 값을 임의로 고쳤는가 (`overriddenFields`)
- **변수 바인딩** — 스타일 값이 변수에 연결됐는가, 직접 입력했는가 (`bindings`)
- **크기** — 고정값 직접 입력인가, 오토레이아웃의 FILL·HUG로 자동 결정된 값인가 (`resize`)
- **유사품** — 직접 그린 것이 기존 컴포넌트와 겹치는가 (근거 2개 이상 필요)

오탐이 나오면 `criteria.md` 를 고치고 **`npm run bake` 를 다시 돌린다.** 프롬프트가 빌드 시점에 구워지기 때문에, 기준만 고치고 재빌드하지 않으면 플러그인 동작은 그대로다. `SKILL.md` 는 실행 순서만 담고 있어 자주 손대지 않는다.

<br>

## Claude Code 스킬로 쓰기

플러그인 없이 터미널에서 쓰는 방식. 결과는 `output/` 에 마크다운으로 저장된다.

### 실행

```bash
cd ~/NewRoot/Docs/원티드_ai네이티브/ds
claude
```

`.claude/` 가 있는 폴더에서 실행해야 스킬이 인식된다. `/mcp` 에 Figma가 있어야 검수가 된다.

### 검수

```
이 프레임 검수해줘
https://figma.com/design/{프레임 링크}
```

판정 기준·출력 형식·저장 위치는 `SKILL.md` 에 있으므로 매번 말하지 않는다.

### 재검수

```
수정했어. 이전 결과랑 비교해서 재검수해줘
output/2026-08-13_컴포넌트.md
https://figma.com/design/{같은 프레임 링크}
```

<br>

## 프로젝트 구조

```
ds/
├── plugin/                        Figma 플러그인
│   ├── src/
│   │   ├── code.ts                메인 스레드 (선택 감지, 검수 실행, 이력 저장)
│   │   ├── ui.tsx                 플러그인 UI (Preact)
│   │   ├── extract.ts             노드 트리 → 구조 데이터 (판정 안 함)
│   │   ├── claudeClient.ts        릴레이 서버 호출 + 응답 파싱
│   │   └── types.ts
│   ├── scripts/
│   │   └── bake-prompt-data.ts    criteria + data → 시스템 프롬프트
│   └── package.json               figma-plugin 매니페스트 설정
│
├── relay-server/
│   └── server.js                  /health, /judge — claude CLI 실행 (port 8787)
│
├── .claude/skills/ds-audit/
│   ├── SKILL.md                   실행 순서
│   └── references/criteria.md     판정 기준 (플러그인·스킬 공용)
│
├── data/
│   ├── components.md              컴포넌트 목록 + 변수 표
│   ├── naming.md                  네이밍 규칙
│   └── exceptions.md              승인된 예외
│
└── output/                        스킬 검수 결과 (마크다운)
```

<br>

## 검증 기대값

만들어둔 4개 프레임에서 아래대로 나오는지 확인한다. 프레임별로 각각 검수를 돌린다.

| 프레임 | 나와야 할 결과 |
|---|---|
| 컴포넌트 | 문제 없음 |
| 인스턴스/컬러변경 | 컴포넌트 값을 임의로 고침 · 심각 |
| 인스턴스/디테치 | 있는 걸 직접 그림 · 보통 |
| 인스턴스/디테치/컬러변경 | 있는 걸 직접 그림 + 값 직접 입력 · 심각 |

### 아직 검증 안 되는 항목

| 항목 | 추가할 것 |
|---|---|
| 값 변경 · 보통 | 인스턴스 하나의 높이만 고정값으로 변경 |
| 없는 걸 직접 그림 | 아무것과도 안 닮은 도형 하나 |
| 없어질 컴포넌트 | `_deprecated/card/legacy` 만들어 배치 |
| 확정 대기 | `_wip/card/promo` 만들어 배치 |
| **유사품 판정 (어려운 케이스)** | 사각형 + 제목 + 캡션을 직접 그리고 레이어명을 `아이템` 으로 지정 |

마지막 항목이 가장 중요하다. 디테치 케이스는 레이어명이 그대로 남아 근거 3개가 일치하므로 쉬운 문제다. 실제 중복 제작은 처음부터 다르게 그릴 때 생긴다.

<br>

## 안 될 때

### 플러그인

| 증상 | 원인 |
|---|---|
| Figma 플러그인 목록에 없음 | `npm run build` 안 돌려서 `manifest.json` 이 없음 |
| Import 메뉴가 안 보임 | 브라우저에서 열었음 — 데스크톱 앱이어야 한다 |
| 연결 실패 / 검수 무반응 | 릴레이 서버가 안 켜져 있음 (`cd relay-server && npm start`) |
| 연결 테스트에서 로그인 실패 | Claude CLI 미로그인 — `claude auth status` 확인 |
| 기준을 고쳤는데 결과가 그대로 | `npm run bake` 재실행 안 함 (프롬프트는 빌드 시점에 구워진다) |
| 응답 파싱 실패 | 모델이 JSON 앞뒤에 설명을 붙임 — 재시도하거나 모델 변경 |
| 큰 프레임에서 일부 요소 누락 | 요소 200개 상한 |

### 스킬

| 증상 | 원인 |
|---|---|
| 스킬을 안 씀 | `.claude/` 가 없는 폴더에서 실행함 |
| 피그마를 못 읽음 | `/mcp` 에 Figma 없음 |
| 목록이 비었다고 함 | `data/components.md` 경로 확인 |

### 판정 품질

| 증상 | 원인 |
|---|---|
| 전부 "직접 그림"으로 나옴 | 인스턴스로 배치했는지 확인 |
| 유사품을 못 찾음 | 용도 필드가 부실함 |
| 엉뚱한 것을 유사품으로 잡음 | 구분 기준 칸 보강 |
| 컨테이너·텍스트까지 지적됨 | `SKILL.md` 평탄화 규칙 확인 |

<br>

## 유료 전환 시

`references/criteria.md` 의 "임시 조건 — 무료 플랜" 절만 삭제한다. 라이브러리 파일과 시안 파일을 분리한 원래 스펙으로 돌아간다.

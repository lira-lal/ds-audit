# 네이밍 규칙

---

## 대원칙

| 원칙 | 내용 |
|---|---|
| 언어 | 영문 소문자. 한글 혼용 금지 |
| 구분자 | 슬래시 `/` 만. 하이픈·언더바·공백 금지 (상태 프리픽스 제외) |
| 계층 | 2단 원칙. 3단은 꼭 필요할 때만 |
| 일관성 | 같은 개념은 항상 같은 단어. `btn` / `button` 혼용 금지 |

이 원칙은 컴포넌트 이름에 적용한다. 변수는 실제 라이브러리 관례를 그대로 표준으로 삼는다 — 카테고리 프리픽스 대문자, 세부 토큰에 언더바 허용. 아래 변수 절 참조.

---

## 컴포넌트

```
{그룹}/{이름}
```

변형은 이름에 넣지 않는다. Variant 속성으로 처리한다.

| 올바름 | 잘못됨 |
|---|---|
| `button/filled` + `size` 속성 | `button/filled/large` |

### 현재 그룹

| 그룹 | 담는 것 |
|---|---|
| `container` | 화면 래퍼 |
| `bar` | 상단·하단 고정 바 |
| `button` | 버튼류 |
| `tab` | 콘텐츠 전환 탭 |
| `icon` | 아이콘 |
| `card` | 항목 단위 블록 |
| `thumbnail` | 이미지 자리, 목록 섹션 |

### 이름 짓는 기준

용도로 짓는다. 생김새로 짓지 않는다.

| 올바름 | 잘못됨 | 이유 |
|---|---|---|
| `button/filled` | `button/black` | 색이 바뀌면 이름이 틀림 |
| `card/default` | `card/round` | 모양은 부수적 |

### Variant 속성

속성명은 소문자, 값은 첫 글자 대문자.

| 속성 | 값 |
|---|---|
| `size` | `Sm` `Md` `Lg` |
| `state` | `Default` `Hover` `Pressed` `Disabled` |
| `type` | 컴포넌트별 정의 |

같은 개념에 다른 속성명을 쓰지 않는다.

---

## 상태 프리픽스

컴포넌트 이름 맨 앞. 변수에는 붙이지 않는다.

| 상태 | 프리픽스 | 예시 |
|---|---|---|
| 확정 | 없음 | `button/filled` |
| 작업중 | `_wip/` | `_wip/card/promo` |
| 폐기예정 | `_deprecated/` | `_deprecated/card/legacy` |

언더바로 시작해 Assets 패널에서 따로 묶인다.

유료 플랜으로 전환하면 페이지 위치가 상태의 원본이 되고, 프리픽스는 보조 표시가 된다. 둘이 어긋나면 검수에서 상태 불일치 경고가 뜬다.

---

## 변수

컴포넌트와 다른 규칙을 쓴다. 카테고리는 대문자로 시작하고, 세부 토큰에 언더바를 허용한다. 색·간격·패딩은 역할이 아니라 카테고리 + 스케일 단계로 짓는다 — 현재 라이브러리에 역할 기반 이름(`color/text/primary` 등)은 없다.

```
{Category}/{token}
```

### 색

| 변수명 | 값 |
|---|---|
| `Neutral/0` | #000000 |
| `Neutral/10` | #151515 |
| `Neutral/60` | #a5a5a5 |
| `Neutral/80` | #d1d1d1 |
| `Neutral/90` | #f2f2f2 |
| `Neutral/100` | #ffffff |

숫자가 작을수록 어둡다. 중간 단계가 필요하면 기존 값 사이 숫자로 끼워 넣는다 (예: `Neutral/50`).

### 타이포그래피

```
{역할}/{크기}
```

| 변수명 | 값 |
|---|---|
| `headline/small` | 24px |
| `title/small` | 16px |
| `label/large` | 18px |
| `label/small` | 14px |

### 간격 (Space)

```
Space/gap_{크기}
```

`Space/gap_xs`(4) `Space/gap_m`(8) `Space/gap_l`(12) `Space/gap_xl`(16) `Space/gap_xxl`(24)

### 패딩 (Padding)

```
Padding/{방향}_{크기}
```

방향은 `Horizontal` `Vertical`.

`Padding/Horizontal_s`(12) `Padding/Horizontal_m`(16) `Padding/Horizontal_xl`(24) `Padding/Vertical_xl`(8)

### 모서리

```
radius/radius_{크기}
```

`radius/radius_s`(12) `radius/radius_m`(18)

값과 이름이 어긋나면 안 된다. 값을 바꾸려면 새 변수를 만들고, 기존 변수의 값만 갈아치우지 않는다.

---

## 시안 프레임

```
{화면}/{세부}
```

`payment/cardRegister` · `mypage/profile`

검수 출력 파일명이 여기서 나온다.

---

## 금지

| 금지 | 예시 |
|---|---|
| 한글·영문 혼용 | `button/기본` |
| 공백 | `bottom navigation` |
| 하이픈·언더바 (상태 프리픽스 제외) | `button-filled` |
| 그룹명 반복 | `button/button` |
| 축약 남용 | `btn` `txt` |
| 숫자만으로 구분 | `button/1` |
| 버전 표기 | `card/defaultV2` — 폐기예정으로 처리 |
| 작성자 표시 | `card/default_lira` |
| 붙여쓰기로 계층 무시 | `thumbnailList` → `thumbnail/list` |

---

## 검수와의 연결

| 규칙 위반 | 검수 결과 |
|---|---|
| 상태 프리픽스와 실제 상태 불일치 | 상태 불일치 · 판정 보류 |
| 이름 규칙 이탈 | 이름 규칙 이탈 · 경미 |
| 변수 없이 값 직접 입력 | 값 직접 입력 · 심각 |

시안에서 직접 그린 요소도 용도를 알 수 있게 이름을 지어두면 유사품 판정 정확도가 올라간다.

# 컴포넌트 목록

라이브러리 스냅샷. 유사품 판정의 기준이다.

마지막 갱신 — 2026-08-13 (수동 작성)

---

## 목록

| 컴포넌트명 | 용도 | 변형 | 상태 | 대체 컴포넌트 | 구분 기준 |
|---|---|---|---|---|---|
| container/screen | 화면 최상위 래퍼. 좌우 여백과 배경만 담당 | — | 확정 | — | 시각 요소 없음. 레이아웃 전용 |
| bar/top | 상단 고정 바. 뒤로가기·제목·우측 액션 | — | 확정 | — | 화면당 1개. 화면 상단에만 위치 |
| bar/bottom | 하단 고정 탭. 최상위 메뉴 간 화면 이동 | — | 확정 | — | tab/item과 달리 화면 자체를 바꿈. 화면당 1개, 하단 고정 |
| icon/default | 단독 아이콘. 의미 전달·장식 | — | 확정 | — | button/icon과 달리 탭 동작 없음 |
| button/filled | 배경이 채워진 버튼. 화면의 주요 행동 유도 | 색상, 상태 | 확정 | — | 배경 있음. 화면당 1~2개 |
| button/text | 배경 없는 텍스트 버튼. 부차 행동 | 상태 | 확정 | — | 배경 없고 여백 작음. 취소·더보기·건너뛰기 등 |
| button/icon | 아이콘만 있는 버튼. 공간이 좁은 곳의 행동 | 상태 | 확정 | — | 라벨 없음. 주로 bar/top 안에서 사용 |
| tab/item | 같은 화면 안에서 콘텐츠 영역 전환 | 상태 | 확정 | — | bar/bottom과 달리 화면 이동 아님. 콘텐츠 위쪽에 위치 |
| thumbnail/default | 이미지 자리 사각형 | — | 확정 | — | 텍스트 없음. card/default의 내부 부품 |
| card/default | 썸네일 + 제목 + 캡션으로 항목 하나를 표현 | — | 확정 | — | 단독 사용 가능. thumbnail을 포함하고 텍스트가 있음 |
| thumbnail/list | 섹션 제목 + card 여러 개 묶음 | — | 확정 | — | card 복수 포함. 섹션 단위 블록 |

---

## 형제 관계

유사품 판정에서 혼동되기 쉬운 조합. 구분 기준을 우선 참조한다.

| 조합 | 결정적 차이 |
|---|---|
| bar/bottom ↔ tab/item | 이동 범위 — 화면 전환 vs 콘텐츠 전환 |
| icon/default ↔ button/icon | 탭 가능 여부 |
| thumbnail/default ↔ card/default ↔ thumbnail/list | 포함 관계 — 부품 / 항목 / 섹션 |
| button/filled ↔ button/text | 배경 유무, 행동의 중요도 |

---

## 변수

라이브러리 페이지 컴포넌트 11개 스캔 결과. 값 바인딩 위치(텍스트색/배경/테두리 등)까지는 확인 안 됨 — 용도는 "확인 필요"로 둔다.

| 변수명 | 값 | 용도 |
|---|---|---|
| `Neutral/0` | #000000 | 확인 필요 |
| `Neutral/10` | #151515 | 확인 필요 |
| `Neutral/60` | #a5a5a5 | 확인 필요 |
| `Neutral/80` | #d1d1d1 | 확인 필요 |
| `Neutral/90` | #f2f2f2 | 확인 필요 |
| `Neutral/100` | #ffffff | 확인 필요 |
| `headline/small` | 24px | 확인 필요 |
| `title/small` | 16px | 확인 필요 |
| `label/large` | 18px | 확인 필요 |
| `label/small` | 14px | 확인 필요 |
| `Space/gap_xs` | 4 | 확인 필요 |
| `Space/gap_m` | 8 | 확인 필요 |
| `Space/gap_l` | 12 | 확인 필요 |
| `Space/gap_xl` | 16 | 확인 필요 |
| `Space/gap_xxl` | 24 | 확인 필요 |
| `Padding/Horizontal_s` | 12 | 확인 필요 |
| `Padding/Horizontal_m` | 16 | 확인 필요 |
| `Padding/Horizontal_xl` | 24 | 확인 필요 |
| `Padding/Vertical_xl` | 8 | 확인 필요 |
| `radius/radius_s` | 12 | 확인 필요 |
| `radius/radius_m` | 18 | 확인 필요 |

명명 규칙은 naming.md 변수 절 참조 (라이브러리 실측 기준으로 갱신됨).

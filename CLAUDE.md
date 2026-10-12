# CLAUDE.md — 브라우저 기반 미니 영상 편집기

## 프로젝트 개요

- 브라우저에서만 동작하는 미니 영상 편집기 (서버 없음, 모든 처리는 클라이언트)
- 목적: 프론트엔드 개발자 포트폴리오(이직용) + 개발 과정 기록(블로그/개인 브랜딩)
- 따라서 "동작하는 결과물"만큼 코드 품질, 구조, 설명 가능성이 중요하다
- 사용자: 영상 클립을 올려 자르고, 배치하고, 텍스트를 얹어 mp4로 내보내는 일반 사용자

## 기술 스택

- React 18+ / TypeScript (strict 모드) / Vite
  - TypeScript는 6.0.x로 고정: typescript-eslint가 `<6.1`만 지원 (지원 범위가 넓어지면 업그레이드)
- 패키지 매니저: pnpm
- 상태 관리: Zustand
- 스타일: Tailwind CSS + shadcn/ui (new-york-v4 스타일, Radix 기반, 아이콘 lucide-react)
  - 컴포넌트 소스는 `src/components/ui/`에 복사해 소유한다 (`components.json`). 이 환경에서는 레지스트리(ui.shadcn.com)가 막혀 GitHub 원본에서 수동 설치했다
  - 색은 `src/index.css`의 CSS 변수 토큰만 쓴다 (`bg-primary`, `text-muted-foreground` 등). 편집기 고유 토큰: `panel`, `stage`(프리뷰 바탕), `warning`, `clip`, `text-item`, `selection`, `playhead`. 팔레트 색(`neutral-800`, `sky-500` 등)을 직접 쓰지 않는다
  - 라이트·다크 테마: 기본은 시스템 설정, 헤더 버튼으로 전환하고 `localStorage`에 기억한다 (`features/theme/`). 첫 화면 깜빡임을 막으려고 `index.html`의 인라인 스크립트가 렌더 전에 `<html>`의 `.dark`를 정한다
  - `ui/`를 고친 곳은 `// 편집기 수정:` 주석을 단다 (비활성 버튼도 title 툴팁 표시, Progress의 aria-valuenow 누락 수정, Slider 이름을 thumb에 연결, Alert `warning` variant)
- 프리뷰 렌더링: Canvas 2D (`<video>` 태그를 화면에 직접 쓰지 않고 프레임을 캔버스에 그림)
- 디코딩/인코딩: WebCodecs API
- 디먹싱/디코딩 관리: mediabunny (MPL-2.0, 수정 없이 의존성으로 사용). 시간 단위가 초이므로 `engine/media/videoSource.ts` 경계에서 μs로 변환
  - 용량이 커서 동적 import로 첫 화면 번들에서 분리, 영상 컨테이너(MP4·MOV·WebM·MKV)만 등록
- mp4 먹싱·인코딩: mediabunny (`Output` + `Mp4OutputFormat` + `CanvasSource`). 코덱은 H.264 → VP9 → AV1 중 인코딩 가능한 첫 코덱, 영상만(소리 없음)
- WebCodecs 미지원 브라우저 대응: 기능 감지 + 안내 메시지 (`engine/capabilities.ts`, `features/compat/`). ffmpeg.wasm은 쓰지 않는다: 프리뷰 디코딩도 WebCodecs에 의존해 내보내기만 대체해서는 편집할 수 없고, 약 30MB wasm과 COOP/COEP 헤더가 필요하다
- 로컬 저장: IndexedDB (idb 라이브러리)
- 테스트: Vitest + Testing Library (핵심 로직), 필요 시 Playwright
- 품질: ESLint + Prettier
- 배포: Vercel (`vercel.json`: Vite 프리셋, `/assets/*` 장기 캐시, 보안 헤더) + GitHub Actions CI(typecheck·lint·format·test·build)

## 핵심 설계 원칙

- **시간 단위 통일**: 내부 시간은 마이크로초 정수(WebCodecs timestamp와 동일). 화면 표시할 때만 변환한다. 부동소수점 초 단위 계산 금지.
- **데이터 모델이 단일 진실 공급원**: 프리뷰와 타임라인은 모두 `Project` 상태에서 파생된다. 프리뷰는 `render(project, time)` 형태의 순수 함수로 설계한다.
  - "무엇을 그릴지"는 `core/composition.ts`의 `resolveLayers(project, time)`(순수 함수), "어떻게 그릴지"(디코딩·캔버스)는 `engine/render/PreviewRenderer`가 담당
  - 재생 시계와 rAF 루프는 `engine/playback/PlaybackEngine`(시계·rAF·렌더러 주입, React 무관). store와의 연결은 `features/preview/playback.ts`에서만 한다
  - 재생 중 매 프레임 바뀌는 `currentTime`은 React 훅으로 구독하지 않고 `playbackStore.subscribe`로 DOM을 직접 갱신한다
- **모든 편집은 커맨드로**: 상태를 바꾸는 편집 동작은 반드시 커맨드를 `projectStore.dispatch(command)`로 실행한다. 컴포넌트에서 store를 직접 수정하지 않는다. (undo/redo 구현의 기반)
  - 커맨드는 Project를 받아 새 Project를 반환하는 순수 함수: `Command { label; execute(project): Project; undo(project): Project }` (`core/commands/`)
  - React·Zustand 없이 테스트할 수 있고, Zustand의 불변 업데이트와 맞물린다
  - 같은 대상의 연속 편집(텍스트 입력, 슬라이더 등)은 커맨드에 `mergeKey`를 주어 1초 안에 이어지면 히스토리 한 항목으로 합친다 (undo 한 번에 처음 값으로)
  - 히스토리는 실패에 안전하다: 커맨드가 예외를 던지면 Project·히스토리를 바꾸지 않고 `false`를 반환한다. 최근 200개까지만 보관한다
  - undo 대상은 Project 편집뿐이다. 줌·스크롤·선택·스냅 설정·플레이헤드는 화면 상태라 undo 대상이 아니다
  - undo/redo 단축키(Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, Ctrl+Y)는 입력칸에서도 앱 히스토리를 대상으로 하고, 드래그·트리밍 중에는 무시한다
  - 새 편집 커맨드를 만들면 `core/commands/undoRedo.test.ts`의 왕복 테스트 표에 추가한다
  - 삭제 커맨드는 원래 배열 위치에 되돌린다. 빈 트랙만 지울 수 있고 마지막 비디오 트랙은 지울 수 없다 (`canRemoveTrack`)
- **직렬화 불가 데이터는 Project 밖에**: 원본 `File`, 썸네일 object URL 등은 `mediaStore`에 assetId로 보관한다. Project는 IndexedDB에 그대로 저장할 수 있는 순수 데이터만 갖는다.
- **저장과 복원**: Project는 IndexedDB에 자동 저장(500ms 디바운스)하고, 원본 파일·썸네일은 가져올 때 한 번 저장한다 (`lib/projectRepository.ts`의 `ProjectRepository` 인터페이스 뒤에 idb 구현, 테스트는 메모리 구현).
  - 페이지를 떠날 때 저장되지 않은 변경은 `localStorage`에 동기 백업하고, 시작 시 IndexedDB 저장본과 백업 중 더 최근 것을 복원한다 (비동기 IndexedDB는 언로드 중에 끝나지 못할 수 있다)
  - 저장본은 `unknown`으로 읽어 `parsePersistedRecord`로 검증한다(형식·참조 무결성·`schemaVersion`). 실패하면 빈 프로젝트로 시작하고 저장본은 지우지 않는다
  - 복원·새 프로젝트는 편집이 아니므로 커맨드 대신 `projectStore.loadProject`로 교체하고 히스토리를 비운다. 복원이 끝나기 전에는 편집기를 그리지 않는다
  - undo 히스토리·줌·선택·플레이헤드는 저장하지 않는다. 시작 시 Project가 참조하지 않는 원본 파일은 지운다
- **UI와 로직 분리**: 타임라인 계산(스냅, 충돌 검사, 좌표↔시간 변환)은 React와 무관한 순수 함수로 `core/`에 두고 테스트한다.
- **타임라인 항목 일반화**: 클립과 텍스트는 `core/timelineItem.ts`의 `TimelineItem { id, trackId, start, end }`로 다룬다. 배치·이동·트리밍·자르기·스냅·가상화는 모두 이 형태로 계산한다. 영상·이미지 클립은 비디오 트랙에만, 텍스트는 텍스트 트랙에만 놓인다.
- **텍스트 좌표**: `style.x`, `style.y`는 텍스트 **중심**의 위치, `fontSize`와 함께 출력 해상도 기준 px. 여러 줄(`\n`) 가운데 정렬, 시스템 한글 글꼴 + 글자 크기 비례 외곽선으로 그린다 (`engine/render/textLayout.ts`, 그리기와 프리뷰 클릭 판정이 같은 측정을 쓴다).
- **SRT 자막**: 자막은 별도 모델 없이 텍스트 오버레이다 (`core/subtitles/`). 편집은 기존 텍스트 편집(인스펙터·트리밍·이동)을 그대로 쓴다.
  - 가져오기: 에셋 패널 가져오기·드롭에서 `.srt`(확장자로 판별)를 받아 새 텍스트 트랙에 넣는다. 파서는 관대하게(BOM·CRLF·번호 생략·`.` 구분자·서식 태그 제거) 읽고 잘못된 블록만 건너뛴다
  - 시각은 프레임 경계로 맞추고(최소 1프레임), 겹치는 자막은 구간 분할로 위 트랙에 나누며 화면에서도 트랙마다 두 줄 높이씩 위에 놓는다. 트랙 추가와 자막 추가는 `자막 가져오기` 커맨드 하나(undo 한 번)
  - 저장: 모든 텍스트를 시작 순으로 SRT(UTF-8 BOM, CRLF)로 내려받는다. 텍스트 안의 빈 줄은 블록 구분자라 뺀다
- **이미지 클립 타이밍**: 이미지는 원본 길이 제한이 없고 어느 시각이나 같은 그림이므로, 트리밍·자르기 후 항상 `inPoint = 0`, `outPoint = 길이`로 정규화한다. 최소 클립 길이는 1프레임.
- **편집 위치 보정**: 드롭·이동·트리밍 위치는 스냅(모든 트랙의 클립 경계, 플레이헤드, 0 / 화면 기준 8px / Alt로 일시 해제) → 스냅되지 않으면 프레임 경계로 반올림 → 빈자리·이웃 제한 순으로 결정한다. 클릭 탐색 위치도 프레임 경계로 맞춘다 (재생 중 시각은 제외).
- **키보드 단축키**: `features/shortcuts/keymap.ts`의 `resolveShortcut`(순수 함수)로 키 → 동작을 정한다. Space 재생, Delete/Backspace 삭제, S 자르기, Ctrl/Cmd+Z·Shift+Ctrl/Cmd+Z·Ctrl+Y undo/redo.
  - 글자 키는 `key`가 영문자면 그대로, 아니면(한글 배열 'ㄴ' 등) `code`(`KeyS`)로 판단한다
  - 입력칸(텍스트·숫자·색상·select·contenteditable)에서는 undo/redo 외 단축키를 가로채지 않는다. 한글 조합 중·키 반복(undo/redo 제외)·드래그 중에는 무시한다
  - 툴바 버튼과 단축키는 `features/timeline/actions.ts`의 같은 함수를 쓴다
- **내보내기**: `engine/export/exportVideo.ts`가 프레임마다 `resolveLayers` → `drawLayers`(프리뷰와 공용)로 출력 해상도 `OffscreenCanvas`에 그려 인코딩한다.
  - 프리뷰는 늦은 프레임을 건너뛰지만 내보내기는 `ClipFrameReader`로 필요한 프레임을 기다린다 (클립마다 리더, 끝나면 해제)
  - 시작 시점의 Project를 고정해 쓰고, 내보내는 동안 모달 뒤 편집기는 `inert`이며 단축키도 막는다. 취소는 `AbortController`
- **트랙 순서**: `order`가 큰 트랙이 프리뷰에서 위에 그려지고, 타임라인에서도 위에 표시한다 (V1이 맨 아래). 새 트랙은 맨 위에 추가된다.
- **드래그 중에는 Project를 바꾸지 않는다**: 드래그 중 상태는 `timelineStore`(화면 상태)에만 두고 미리보기를 그린다. 놓을 때 커맨드를 한 번 실행해 히스토리에 한 항목만 남긴다.
- **성능**: 타임라인은 보이는 영역만 렌더링한다. 재생 루프는 `requestAnimationFrame` 기반, 재생 중 React 리렌더를 최소화한다.
  - 타임라인은 기본 스크롤을 쓰고 `renderTimeRange()`(보이는 영역 ± 화면 1개 폭, 화면 폭 절반 단위로 정렬)에 걸치는 클립·눈금만 그린다. 드래그·트리밍 중인 클립은 범위 밖이어도 그린다
  - 드래그 위치는 화면 좌표 차이가 아니라 내용 영역 기준 시각(`grabOffset`)으로 계산한다 (자동 스크롤·줌과 무관하게 정확)
  - 줌 범위 2~1000px/s, Ctrl/Cmd+휠·핀치는 포인터 아래 시각을 고정한다

## 데이터 모델 (초안)

```ts
type Microseconds = number;

interface Asset {       // 업로드된 원본 파일
  id: string;
  type: 'video' | 'image' | 'audio';
  name: string;
  duration: Microseconds; // 이미지는 기본값 사용
  width?: number;
  height?: number;
}

interface Clip {        // 타임라인 위에 놓인 조각
  id: string;
  assetId: string;
  trackId: string;
  start: Microseconds;      // 타임라인상 시작 위치
  inPoint: Microseconds;    // 원본에서 사용 시작 지점
  outPoint: Microseconds;   // 원본에서 사용 끝 지점
}

interface TextOverlay {
  id: string;
  trackId: string;
  start: Microseconds;
  duration: Microseconds;
  text: string;               // 여러 줄 허용 (\n)
  style: { fontSize: number; color: string; x: number; y: number }; // 출력 해상도 기준 px, (x, y)는 중심
}

interface Track {
  id: string;
  kind: 'video' | 'text' | 'audio';
  order: number;
}

interface Project {
  id: string;
  name: string;
  width: number;   // 출력 해상도 (기본 1920x1080)
  height: number;
  fps: number;     // 기본 30
  tracks: Track[];
  clips: Clip[];
  overlays: TextOverlay[];
  assets: Asset[];
}
```

필요하면 수정을 제안하되, 변경 이유를 먼저 설명할 것.

## 폴더 구조 (초안)

```
src/
  core/        # 순수 로직: 시간 변환, 스냅, 충돌 검사, 커맨드
  engine/      # 디코딩, 프레임 렌더링, 재생 루프, 내보내기
  store/       # Zustand store, 히스토리(undo/redo)
  features/
    timeline/
    preview/
    assets/
    inspector/
    export/
  components/  # 공용 UI (ui/: shadcn/ui 컴포넌트)
  lib/         # IndexedDB 등 외부 연동 래퍼
docs/
  devlog/      # 개발 기록 (블로그 글감)
```

## 개발 로드맵 (4주 MVP)

### 1주차 — 기본 골격과 재생

- [x] 프로젝트 세팅 (Vite, TS strict, ESLint/Prettier, Tailwind, Vitest)
- [x] 영상·이미지 업로드 → 에셋 패널에 표시 (썸네일, 길이)
- [x] 에셋을 타임라인에 드래그해서 클립 배치
- [x] 재생/일시정지, 플레이헤드와 프리뷰 동기화, 타임라인 클릭으로 탐색

**완료 기준**: 클립 2개 이상을 순서대로 이어서 끊김 없이 재생할 수 있다

### 2주차 — 타임라인 편집

- [x] 클립 이동 (같은 트랙 / 트랙 간)
- [x] 클립 양 끝 드래그로 트리밍, 플레이헤드 위치에서 자르기(split)
- [x] 스냅 (클립 경계, 플레이헤드)
- [x] 타임라인 줌 인/아웃, 가로 스크롤

**완료 기준**: 클립 100개 배치 상태에서도 드래그가 부드럽다

### 3주차 — 텍스트와 편집 히스토리

- [x] 텍스트 오버레이 추가, 인스펙터에서 스타일 수정, 프리뷰에서 위치 드래그
- [x] undo/redo (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z), 커맨드 패턴 기반
- [x] 키보드 단축키 (스페이스 재생, Delete 삭제, S 자르기)
- [x] IndexedDB 자동 저장 및 새로고침 후 복원

**완료 기준**: 모든 편집 동작이 undo/redo 가능하다

### 4주차 — 내보내기와 마무리

- [x] WebCodecs로 mp4 내보내기, 진행률 표시, 취소
- [x] 미지원 브라우저 대응(ffmpeg.wasm) 또는 안내 메시지
- [x] Vercel 배포 (설정·CI 준비 완료, Vercel에서 저장소 Import만 하면 배포됨)
- [x] README 정리: 데모 GIF(`docs/assets/demo.gif`), 아키텍처 다이어그램, 기술적 의사결정, 실행 방법

**완료 기준**: 30초 분량 프로젝트를 1080p mp4로 내보낼 수 있다

### 이후 확장 후보 (하나만 골라 킬러 기능으로)

- [x] **SRT 자막 불러오기/편집** ← 선택: 텍스트 오버레이·커맨드·내보내기 구조를 그대로 쓰고, 오디오가 필요한 무음 컷이나 클립 겹침 모델을 바꿔야 하는 디졸브보다 범위가 분명하다
- 전환 효과 (페이드, 디졸브)
- AI 기반 자동 컷 편집 (무음 구간 제거 등)

## MVP 범위 밖

- 백엔드, 로그인, 클라우드 저장
- 오디오 파형 편집, 다중 오디오 믹싱, 오디오 재생·내보내기 (내보내기는 영상만)
- 모바일 레이아웃 (데스크톱 우선)

## 작업 규칙 (Claude에게)

- 큰 기능은 구현 전에 계획(변경할 파일, 접근 방식)을 먼저 보여주고 확인 받을 것
- 한 번에 하나의 체크리스트 항목만 작업하고, 끝나면 로드맵 체크박스를 갱신할 것
- 새 라이브러리 추가는 이유와 대안을 설명하고 승인 받은 뒤 진행
- `core/`의 순수 로직에는 반드시 테스트를 작성
- `any` 사용 금지, 타입은 명시적으로
- 커밋은 기능 단위로, Conventional Commits 형식 (`feat:`, `fix:`, `refactor:` 등)
- 기술적으로 까다로웠던 문제를 해결하면 `docs/devlog/YYYY-MM-DD-주제.md`에 짧게 기록: 문제 상황 → 시도한 방법 → 최종 해결책 → 배운 점 (블로그 글감으로 사용)
- 설계를 바꾸게 되면 이 파일의 해당 섹션도 함께 갱신

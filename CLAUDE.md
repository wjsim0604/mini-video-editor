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
- 스타일: Tailwind CSS
- 프리뷰 렌더링: Canvas 2D (`<video>` 태그를 화면에 직접 쓰지 않고 프레임을 캔버스에 그림)
- 디코딩/인코딩: WebCodecs API
- mp4 먹싱 라이브러리는 최신 유지보수 상태를 확인한 뒤 제안하고 승인 받기
- WebCodecs 미지원 브라우저 대응: ffmpeg.wasm (멀티스레드 사용 시 COOP/COEP 헤더 필요)
- 로컬 저장: IndexedDB (idb 라이브러리)
- 테스트: Vitest + Testing Library (핵심 로직), 필요 시 Playwright
- 품질: ESLint + Prettier
- 배포: Vercel

## 핵심 설계 원칙

- **시간 단위 통일**: 내부 시간은 마이크로초 정수(WebCodecs timestamp와 동일). 화면 표시할 때만 변환한다. 부동소수점 초 단위 계산 금지.
- **데이터 모델이 단일 진실 공급원**: 프리뷰와 타임라인은 모두 `Project` 상태에서 파생된다. 프리뷰는 `render(project, time)` 형태의 순수 함수로 설계한다.
- **모든 편집은 커맨드로**: 상태를 바꾸는 편집 동작은 반드시 커맨드를 `projectStore.dispatch(command)`로 실행한다. 컴포넌트에서 store를 직접 수정하지 않는다. (undo/redo 구현의 기반)
  - 커맨드는 Project를 받아 새 Project를 반환하는 순수 함수: `Command { label; execute(project): Project; undo(project): Project }` (`core/commands/`)
  - React·Zustand 없이 테스트할 수 있고, Zustand의 불변 업데이트와 맞물린다
- **직렬화 불가 데이터는 Project 밖에**: 원본 `File`, 썸네일 object URL 등은 `mediaStore`에 assetId로 보관한다. Project는 IndexedDB에 그대로 저장할 수 있는 순수 데이터만 갖는다.
- **UI와 로직 분리**: 타임라인 계산(스냅, 충돌 검사, 좌표↔시간 변환)은 React와 무관한 순수 함수로 `core/`에 두고 테스트한다.
- **성능**: 타임라인은 보이는 영역만 렌더링한다. 재생 루프는 `requestAnimationFrame` 기반, 재생 중 React 리렌더를 최소화한다.

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
  text: string;
  style: { fontSize: number; color: string; x: number; y: number };
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
  components/  # 공용 UI
  lib/         # IndexedDB 등 외부 연동 래퍼
docs/
  devlog/      # 개발 기록 (블로그 글감)
```

## 개발 로드맵 (4주 MVP)

### 1주차 — 기본 골격과 재생

- [x] 프로젝트 세팅 (Vite, TS strict, ESLint/Prettier, Tailwind, Vitest)
- [x] 영상·이미지 업로드 → 에셋 패널에 표시 (썸네일, 길이)
- [x] 에셋을 타임라인에 드래그해서 클립 배치
- [ ] 재생/일시정지, 플레이헤드와 프리뷰 동기화, 타임라인 클릭으로 탐색

**완료 기준**: 클립 2개 이상을 순서대로 이어서 끊김 없이 재생할 수 있다

### 2주차 — 타임라인 편집

- [ ] 클립 이동 (같은 트랙 / 트랙 간)
- [ ] 클립 양 끝 드래그로 트리밍, 플레이헤드 위치에서 자르기(split)
- [ ] 스냅 (클립 경계, 플레이헤드)
- [ ] 타임라인 줌 인/아웃, 가로 스크롤

**완료 기준**: 클립 100개 배치 상태에서도 드래그가 부드럽다

### 3주차 — 텍스트와 편집 히스토리

- [ ] 텍스트 오버레이 추가, 인스펙터에서 스타일 수정, 프리뷰에서 위치 드래그
- [ ] undo/redo (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z), 커맨드 패턴 기반
- [ ] 키보드 단축키 (스페이스 재생, Delete 삭제, S 자르기)
- [ ] IndexedDB 자동 저장 및 새로고침 후 복원

**완료 기준**: 모든 편집 동작이 undo/redo 가능하다

### 4주차 — 내보내기와 마무리

- [ ] WebCodecs로 mp4 내보내기, 진행률 표시, 취소
- [ ] 미지원 브라우저 대응(ffmpeg.wasm) 또는 안내 메시지
- [ ] Vercel 배포
- [ ] README 정리: 데모 GIF, 아키텍처 다이어그램, 기술적 의사결정, 실행 방법

**완료 기준**: 30초 분량 프로젝트를 1080p mp4로 내보낼 수 있다

### 이후 확장 후보 (하나만 골라 킬러 기능으로)

- SRT 자막 불러오기/편집
- 전환 효과 (페이드, 디졸브)
- AI 기반 자동 컷 편집 (무음 구간 제거 등)

## MVP 범위 밖

- 백엔드, 로그인, 클라우드 저장
- 오디오 파형 편집, 다중 오디오 믹싱
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

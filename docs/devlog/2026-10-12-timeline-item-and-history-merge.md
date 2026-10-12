# 텍스트를 넣기 전에: 타임라인 항목 일반화와 히스토리 합치기

## 문제 상황

3주차에 텍스트 오버레이를 추가하려고 보니, 2주차에 만든 배치·이동·트리밍·자르기·스냅·가상화가 모두 `Clip`
전용이었다(`clip.start`, `clipEnd(clip)`, `project.clips`). 텍스트를 위해 같은 로직을 한 벌 더 만들면
"클립은 빈자리에 붙는데 텍스트는 겹친다" 같은 불일치가 생기고, 버그도 두 배가 된다.

또 인스펙터에서 글자를 입력할 때마다 커맨드를 실행하면 "안녕하세요" 다섯 글자가 히스토리 다섯 항목이 되어,
3주차 undo가 한 글자씩 되돌아가게 된다.

## 1. 공통 TimelineItem으로 일반화

```ts
type TimelineItem =
  | { kind: 'clip'; id; trackId; start; end; clip: Clip }
  | { kind: 'text'; id; trackId; start; end; overlay: TextOverlay };
```

- 타임라인 계산은 모두 `{ start, end }` 구간으로 하고, 결과를 되돌릴 때만 종류별로 처리한다(`withItemSpan`).
  클립은 시작이 움직인 만큼 `inPoint`도 옮기고, 이미지는 `inPoint 0`으로 정규화하고, 텍스트는 `start/duration`을 바꾼다.
- `React.memo`가 깨지지 않도록 `WeakMap`으로 같은 Clip/TextOverlay 객체에는 같은 item 객체를 돌려준다.
- **리팩터링 커밋을 따로 분리**하고 타임라인 UI 테스트(41개)를 한 줄도 고치지 않은 채 통과시키는 것으로 동작이 바뀌지 않았음을 확인했다.

리팩터링 중 테스트가 버그 하나를 잡았다. 이동 커맨드에서 트리밍용 `withItemSpan`을 재사용했더니,
클립을 옮기면 원본 사용 구간(`inPoint`)까지 같이 밀렸다. "이동은 위치만, 트리밍은 구간과 원본 범위를 함께"라는
의미 차이를 함수 하나로 합치려다 생긴 실수다. 이동은 `trackId/start`만 바꾸도록 분리했다.

## 2. mergeKey로 연속 편집 합치기

```ts
interface Command {
  label;
  mergeKey?: string;
  execute(p): Project;
  undo(p): Project;
}

// store.dispatch: 직전 커맨드와 mergeKey가 같고 1초 이내면
past[past.length - 1] = mergeCommands(previous, command); // execute는 새 것, undo는 처음 것
```

- `mergeKey`에는 바꾸는 필드까지 넣는다(`overlay:abc:text`, `overlay:abc:x,y`). 내용 입력과 색상 변경은 서로 합쳐지지 않는다.
- undo/redo가 일어나면 합치기 상태를 초기화해, 되돌린 뒤 새로 입력한 내용이 이전 항목에 붙지 않게 했다.
- 합친 커맨드의 undo는 첫 커맨드의 undo라서 "안녕하세요"를 한 번에 되돌리면 원래 "텍스트"로 돌아간다.
- 시계를 `createProjectStore(project, now)`로 주입해 1초 경계를 테스트로 확인했다.

## 배운 점

- 비슷한 기능이 두 번째로 필요해지는 순간이 일반화의 적기다. 첫 번째 구현에 테스트가 있으면 리팩터링을 안심하고 할 수 있다.
- 히스토리의 단위는 "실행한 함수 호출"이 아니라 "사용자가 생각하는 편집 한 번"이다.

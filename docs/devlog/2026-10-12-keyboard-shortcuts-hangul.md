# 한글 키보드에서도 동작하는 단축키 만들기

## 문제 상황

`S`(자르기), `Ctrl/Cmd+Z`(실행 취소) 같은 단축키를 `event.key`로 판단하도록 만들었는데,
한글 입력 상태에서 `S` 키를 누르면 `event.key`가 `'ㄴ'`으로 들어온다. 한국어 사용자는 대부분 한/영 전환을 신경 쓰지 않고
단축키를 누르므로, "가끔 단축키가 안 먹는" 편집기가 된다.

함께 정리해야 할 문제가 몇 가지 더 있었다.

- 인스펙터 입력칸에서 띄어쓰기를 치면 재생이 시작되고, `s`를 치면 클립이 잘린다.
- 버튼에 포커스가 있는 상태에서 `Space`를 누르면 브라우저가 버튼을 클릭해, 재생 토글과 버튼 동작이 함께 일어난다.
- 한글 조합 중인 키 입력, 키를 누르고 있어 반복되는 입력(스페이스를 꾹 누르면 재생/정지가 연속으로 바뀜).

## 시도한 방법

1. **`event.code`만 사용**: 물리 키 위치라 한글 배열 문제는 사라지지만, AZERTY(프랑스어) 배열에서는
   `W`가 적힌 키가 `KeyZ`라서 `Ctrl+W`(탭 닫기 위치)가 실행 취소가 된다. 키에 적힌 글자와 동작이 어긋난다.
2. **`key` 우선 + `code` 대체**: `key`가 영문자면 그대로 쓰고, 영문자가 아닐 때(한글 자모 등)만 `code`의
   `Key[A-Z]`에서 글자를 얻는다.

```ts
export function letterOf(event: Pick<KeyboardEvent, 'key' | 'code'>): string | null {
  if (/^[a-z]$/i.test(event.key)) return event.key.toLowerCase();
  const match = /^Key([A-Z])$/.exec(event.code);
  return match?.[1]?.toLowerCase() ?? null;
}
```

## 최종 해결

- 키 → 동작 변환은 `resolveShortcut(event)` 순수 함수로 분리하고, `'ㄴ' + KeyS → split`, `'ㅋ' + Ctrl + KeyZ → undo`,
  `'w' + Ctrl + KeyZ(AZERTY) → 없음`을 테스트로 고정했다.
- 입력칸 판별(`isTypingTarget`): textarea, select, contenteditable, 텍스트류 input(숫자·색상 포함)에서는 `Space`·`S`·`Backspace`를
  가로채지 않는다. 슬라이더·체크박스는 제외. undo/redo만 입력칸에서도 앱 히스토리를 대상으로 한다.
- `event.isComposing`(한글 조합 중)과 `event.repeat`(undo/redo 제외)은 무시한다.
- 단축키로 처리하는 경우에만 `preventDefault()`를 호출해 포커스된 버튼의 `Space` 클릭과 페이지 스크롤을 막았다.
  실제 Chromium에서 "텍스트" 버튼에 포커스를 둔 채 `Space`를 눌러 텍스트가 추가되지 않고 재생만 토글되는 것을 확인했다.

## 배운 점

- `key`는 "무슨 글자인가", `code`는 "어느 자리의 키인가"다. 단축키는 글자를 기준으로 하되, 글자가 영문이 아닐 때만 자리를 본다.
- 단축키는 "언제 동작하지 않아야 하는가"(입력 중, 조합 중, 반복, 드래그 중)를 정하는 일이 더 크다.

export type ShortcutAction = 'undo' | 'redo' | 'togglePlay' | 'delete' | 'split';

export type ShortcutEvent = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'
>;

/**
 * 글자 키를 영문 소문자로. key가 영문자면 그대로 쓰고, 아니면(한글 입력 상태에서 S가 'ㄴ'으로 오는 경우 등)
 * 물리 키 위치(code: 'KeyS')로 판단한다. key를 먼저 보는 이유는 AZERTY 등 다른 배열에서
 * 글자 위치가 달라도 적힌 글자대로 동작하게 하기 위해서다.
 */
export function letterOf(event: Pick<KeyboardEvent, 'key' | 'code'>): string | null {
  if (/^[a-z]$/i.test(event.key)) {
    return event.key.toLowerCase();
  }
  const match = /^Key([A-Z])$/.exec(event.code);
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * 키 입력을 앱 동작으로 바꾼다. Mac(Cmd)과 Windows/Linux(Ctrl)를 모두 받는다.
 * - undo: Ctrl/Cmd+Z / redo: Shift+Ctrl/Cmd+Z, Ctrl/Cmd+Y
 * - 재생/일시정지: Space / 삭제: Delete, Backspace / 자르기: S
 */
export function resolveShortcut(event: ShortcutEvent): ShortcutAction | null {
  if (event.altKey) {
    return null;
  }
  const letter = letterOf(event);
  if (event.ctrlKey || event.metaKey) {
    if (letter === 'z') {
      return event.shiftKey ? 'redo' : 'undo';
    }
    if (letter === 'y' && !event.shiftKey) {
      return 'redo';
    }
    return null;
  }
  if (event.shiftKey) {
    return null;
  }
  if (event.key === ' ' || event.code === 'Space') {
    return 'togglePlay';
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    return 'delete';
  }
  if (letter === 's') {
    return 'split';
  }
  return null;
}

/** 입력칸에 포커스가 있어도 동작하는 단축키 (앱 히스토리 대상) */
export function worksWhileTyping(action: ShortcutAction): boolean {
  return action === 'undo' || action === 'redo';
}

/** 텍스트처럼 키 입력을 받는 요소가 아닌 input 종류 */
const NON_TYPING_INPUTS = new Set([
  'range',
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'file',
]);

/**
 * 키 입력을 그대로 받아야 하는 대상인지. 이 대상에서는 띄어쓰기·s·Backspace가 글자 입력이므로
 * 단축키로 가로채지 않는다. 슬라이더·체크박스 등은 해당하지 않는다.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  return target instanceof HTMLInputElement && !NON_TYPING_INPUTS.has(target.type);
}

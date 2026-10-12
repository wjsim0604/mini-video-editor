export type ShortcutAction = 'undo' | 'redo';

export type ShortcutEvent = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'
>;

/**
 * 키 입력을 앱 동작으로 바꾼다. Mac(Cmd)과 Windows/Linux(Ctrl)를 모두 받는다.
 * - undo: Ctrl/Cmd+Z
 * - redo: Shift+Ctrl/Cmd+Z, Ctrl/Cmd+Y
 */
export function resolveShortcut(event: ShortcutEvent): ShortcutAction | null {
  const mod = event.ctrlKey || event.metaKey;
  if (!mod || event.altKey) {
    return null;
  }
  // Shift를 누르면 key가 대문자로 오므로 소문자로 비교한다
  const key = event.key.toLowerCase();
  if (key === 'z') {
    return event.shiftKey ? 'redo' : 'undo';
  }
  if (key === 'y' && !event.shiftKey) {
    return 'redo';
  }
  return null;
}

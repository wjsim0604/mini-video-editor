import { describe, expect, it } from 'vitest';
import { resolveShortcut, type ShortcutEvent } from './keymap.ts';

function key(value: string, modifiers: Partial<ShortcutEvent> = {}): ShortcutEvent {
  return {
    key: value,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...modifiers,
  };
}

describe('resolveShortcut', () => {
  it.each([
    ['Ctrl+Z', key('z', { ctrlKey: true }), 'undo'],
    ['Cmd+Z', key('z', { metaKey: true }), 'undo'],
    ['Shift+Ctrl+Z', key('Z', { ctrlKey: true, shiftKey: true }), 'redo'],
    ['Shift+Cmd+Z', key('Z', { metaKey: true, shiftKey: true }), 'redo'],
    ['Ctrl+Y', key('y', { ctrlKey: true }), 'redo'],
  ] as const)('%s → %s', (_, event, expected) => {
    expect(resolveShortcut(event)).toBe(expected);
  });

  it.each([
    ['Z만', key('z')],
    ['Alt+Ctrl+Z', key('z', { ctrlKey: true, altKey: true })],
    ['Shift+Ctrl+Y', key('Y', { ctrlKey: true, shiftKey: true })],
    ['Ctrl+X', key('x', { ctrlKey: true })],
  ] as const)('%s는 동작 없음', (_, event) => {
    expect(resolveShortcut(event)).toBeNull();
  });
});

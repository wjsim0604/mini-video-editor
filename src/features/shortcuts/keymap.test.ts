import { describe, expect, it } from 'vitest';
import { isTypingTarget, letterOf, resolveShortcut, type ShortcutEvent } from './keymap.ts';

function key(value: string, modifiers: Partial<ShortcutEvent> = {}): ShortcutEvent {
  return {
    key: value,
    code: '',
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
    ['Space', key(' ', { code: 'Space' }), 'togglePlay'],
    ['Delete', key('Delete'), 'delete'],
    ['Backspace', key('Backspace'), 'delete'],
    ['S', key('s', { code: 'KeyS' }), 'split'],
  ] as const)('%s → %s', (_, event, expected) => {
    expect(resolveShortcut(event)).toBe(expected);
  });

  it.each([
    ['한글 배열의 S(ㄴ)', key('ㄴ', { code: 'KeyS' }), 'split'],
    ['한글 배열의 Ctrl+Z(ㅋ)', key('ㅋ', { code: 'KeyZ', ctrlKey: true }), 'undo'],
    ['AZERTY의 Z 자리(W 글자)는 글자대로', key('w', { code: 'KeyZ', ctrlKey: true }), null],
  ] as const)('%s → %s', (_, event, expected) => {
    expect(resolveShortcut(event)).toBe(expected);
  });

  it.each([
    ['Z만', key('z')],
    ['Alt+Ctrl+Z', key('z', { ctrlKey: true, altKey: true })],
    ['Shift+Ctrl+Y', key('Y', { ctrlKey: true, shiftKey: true })],
    ['Ctrl+S (브라우저 저장)', key('s', { ctrlKey: true })],
    ['Shift+S', key('S', { shiftKey: true })],
    ['Alt+Space', key(' ', { altKey: true })],
  ] as const)('%s는 동작 없음', (_, event) => {
    expect(resolveShortcut(event)).toBeNull();
  });
});

describe('letterOf', () => {
  it('영문자는 key, 그 외에는 code로 판단한다', () => {
    expect(letterOf({ key: 'S', code: 'KeyS' })).toBe('s');
    expect(letterOf({ key: 'ㄴ', code: 'KeyS' })).toBe('s');
    expect(letterOf({ key: ' ', code: 'Space' })).toBeNull();
  });
});

describe('isTypingTarget', () => {
  function element(html: string): Element | null {
    const container = document.createElement('div');
    container.innerHTML = html;
    return container.firstElementChild;
  }

  it('텍스트를 입력받는 요소', () => {
    expect(isTypingTarget(element('<textarea></textarea>'))).toBe(true);
    expect(isTypingTarget(element('<input type="text">'))).toBe(true);
    expect(isTypingTarget(element('<input type="number">'))).toBe(true);
    expect(isTypingTarget(element('<input type="color">'))).toBe(true);
    expect(isTypingTarget(element('<select></select>'))).toBe(true);
  });

  it('슬라이더·버튼·일반 요소는 아니다', () => {
    expect(isTypingTarget(element('<input type="range">'))).toBe(false);
    expect(isTypingTarget(element('<button></button>'))).toBe(false);
    expect(isTypingTarget(element('<div></div>'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

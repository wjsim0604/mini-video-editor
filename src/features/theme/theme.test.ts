import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, currentTheme, resolveTheme, setTheme, THEME_STORAGE_KEY } from './theme.ts';

describe('resolveTheme', () => {
  it('저장된 선택을 시스템 설정보다 우선한다', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('저장된 값이 없거나 잘못되면 시스템 설정을 따른다', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
    expect(resolveTheme('blue', true)).toBe('dark');
  });
});

describe('setTheme', () => {
  afterEach(() => {
    localStorage.clear();
    applyTheme('light');
  });

  it('html의 dark 클래스와 color-scheme을 바꾸고 선택을 기억한다', () => {
    setTheme('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(currentTheme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    setTheme('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(currentTheme()).toBe('light');
  });
});

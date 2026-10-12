export type Theme = 'light' | 'dark';

/** localStorage 키. index.html의 초기 스크립트와 같은 값을 쓴다 */
export const THEME_STORAGE_KEY = 'mini-video-editor:theme';

/** 저장된 선택이 있으면 그것을, 없으면 밝은 테마를 쓴다 */
export function resolveTheme(stored: string | null): Theme {
  return stored === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function currentTheme(root: HTMLElement = document.documentElement): Theme {
  return root.classList.contains('dark') ? 'dark' : 'light';
}

/** 테마를 바꾸고 기억한다. 저장할 수 없는 환경(사생활 보호 모드 등)에서도 전환은 된다 */
export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 저장 실패는 무시한다 (다음 방문 때 밝은 테마로 시작한다)
  }
}

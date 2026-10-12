import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { currentTheme, setTheme, type Theme } from './theme.ts';

/** 헤더의 라이트/다크 전환 버튼 */
export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => currentTheme());
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'light' ? '밝은 테마로 전환' : '어두운 테마로 전환';

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={() => {
        setTheme(next);
        setThemeState(next);
      }}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}

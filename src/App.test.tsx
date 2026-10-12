import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.tsx';

describe('App', () => {
  it('편집기의 기본 영역을 렌더링한다', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Mini Video Editor' })).toBeInTheDocument();
    for (const name of ['에셋', '프리뷰', '인스펙터', '타임라인']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });
});

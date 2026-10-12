import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompatibilityBanner } from './CompatibilityBanner.tsx';

describe('CompatibilityBanner', () => {
  it('모든 기능을 쓸 수 있으면 보이지 않는다', () => {
    render(
      <CompatibilityBanner
        capabilities={{ secureContext: true, videoDecoding: true, videoEncoding: true }}
      />,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('쓸 수 없는 기능과 권장 브라우저를 안내하고, 닫을 수 있다', () => {
    render(
      <CompatibilityBanner
        capabilities={{ secureContext: true, videoDecoding: false, videoEncoding: false }}
      />,
    );

    const banner = screen.getByRole('alert', { name: '브라우저 호환성 안내' });
    expect(banner).toHaveTextContent('영상 가져오기와 미리보기');
    expect(banner).toHaveTextContent('최신 Chrome 또는 Edge');

    fireEvent.click(screen.getByRole('button', { name: '호환성 안내 닫기' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

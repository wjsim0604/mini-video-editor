import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAddAssetCommand } from '@/core/commands/addAsset.ts';
import { createAddClipCommand } from '@/core/commands/addClip.ts';
import { DEFAULT_VIDEO_TRACK_ID } from '@/core/project.ts';
import { playbackStore } from '@/store/playbackStore.ts';
import { projectStore } from '@/store/projectStore.ts';
import { PlaybackControls } from './PlaybackControls.tsx';
import { playbackEngine } from './playback.ts';

function addClip(duration: number) {
  const { dispatch } = projectStore.getState();
  dispatch(createAddAssetCommand({ id: 'a', type: 'video', name: 'a.mp4', duration }));
  dispatch(
    createAddClipCommand({
      id: 'c',
      assetId: 'a',
      trackId: DEFAULT_VIDEO_TRACK_ID,
      start: 0,
      inPoint: 0,
      outPoint: duration,
    }),
  );
}

describe('PlaybackControls', () => {
  beforeEach(() => {
    projectStore.setState(projectStore.getInitialState(), true);
    playbackStore.setState(playbackStore.getInitialState(), true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('빈 프로젝트에서는 재생 버튼이 비활성화된다', () => {
    render(<PlaybackControls />);

    expect(screen.getByRole('button', { name: '재생' })).toBeDisabled();
  });

  it('재생 버튼을 누르면 엔진의 재생을 토글한다', () => {
    addClip(3_000_000);
    const toggle = vi.spyOn(playbackEngine, 'toggle').mockImplementation(() => undefined);
    render(<PlaybackControls />);

    fireEvent.click(screen.getByRole('button', { name: '재생' }));

    expect(toggle).toHaveBeenCalledOnce();
  });

  it('재생 중이면 일시정지 버튼을 보여준다', () => {
    render(<PlaybackControls />);

    act(() => {
      playbackStore.setState({ isPlaying: true });
    });

    expect(screen.getByRole('button', { name: '일시정지' })).toBeInTheDocument();
  });

  it('현재 시각과 전체 길이를 타임코드로 표시한다', () => {
    addClip(65_000_000);
    render(<PlaybackControls />);

    act(() => {
      playbackStore.setState({ currentTime: 1_500_000 });
    });

    expect(screen.getByTestId('current-timecode')).toHaveTextContent('00:00:01:15');
    expect(screen.getByText(/00:01:05:00/)).toBeInTheDocument();
  });
});

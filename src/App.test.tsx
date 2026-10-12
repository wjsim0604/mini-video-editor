import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAddAssetCommand } from '@/core/commands/addAsset.ts';
import { createAddClipCommand } from '@/core/commands/addClip.ts';
import { DEFAULT_VIDEO_TRACK_ID } from '@/core/project.ts';
import { playbackEngine } from '@/features/preview/playback.ts';
import { playbackStore } from '@/store/playbackStore.ts';
import { projectStore } from '@/store/projectStore.ts';
import { timelineStore } from '@/store/timelineStore.ts';
import App from './App.tsx';

function project() {
  return projectStore.getState().project;
}

function pressUndo() {
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
}

function pressRedo() {
  fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true });
}

describe('App', () => {
  beforeEach(() => {
    projectStore.setState(projectStore.getInitialState(), true);
    timelineStore.setState(timelineStore.getInitialState(), true);
    playbackStore.setState(playbackStore.getInitialState(), true);
    playbackEngine.seek(0);
  });

  it('편집기의 기본 영역을 렌더링한다', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Mini Video Editor' })).toBeInTheDocument();
    for (const name of ['에셋', '프리뷰', '인스펙터', '타임라인']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });

  describe('undo/redo', () => {
    it('되돌릴 편집이 없으면 버튼이 비활성화된다', () => {
      render(<App />);

      expect(screen.getByRole('button', { name: '실행 취소' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '다시 실행' })).toBeDisabled();
    });

    it('텍스트 추가 → 입력 → 단축키로 한 단계씩 되돌리고 다시 실행한다', () => {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: '텍스트' }));
      const textarea = screen.getByLabelText('내용');
      fireEvent.change(textarea, { target: { value: '안' } });
      fireEvent.change(textarea, { target: { value: '안녕' } });

      expect(screen.getByRole('button', { name: '실행 취소' })).toHaveAttribute(
        'title',
        '실행 취소: 텍스트 수정 (Ctrl/Cmd+Z)',
      );

      // 연속 입력은 한 번에 되돌아간다
      pressUndo();
      expect(project().overlays[0]?.text).toBe('텍스트');
      expect(screen.getByLabelText('내용')).toHaveValue('텍스트');

      // 텍스트 추가(트랙 포함)를 되돌리면 선택도 해제된다
      pressUndo();
      expect(project().overlays).toEqual([]);
      expect(project().tracks.map((track) => track.kind)).toEqual(['video']);
      expect(timelineStore.getState().selectedItemId).toBeNull();
      expect(screen.getByText('편집할 항목을 선택하세요')).toBeInTheDocument();

      pressRedo();
      expect(project().overlays[0]?.text).toBe('텍스트');
      fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
      expect(project().overlays[0]?.text).toBe('안녕');
      expect(screen.getByRole('button', { name: '다시 실행' })).toBeDisabled();
    });

    it('헤더 버튼으로도 되돌리고 다시 실행한다', () => {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: '텍스트' }));

      fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
      expect(project().overlays).toEqual([]);

      fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));
      expect(project().overlays).toHaveLength(1);
    });

    it('입력칸에 포커스가 있어도 앱 히스토리를 되돌린다', () => {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: '텍스트' }));
      const textarea = screen.getByLabelText('내용');
      fireEvent.change(textarea, { target: { value: '바뀜' } });
      textarea.focus();

      fireEvent.keyDown(textarea, { key: 'z', metaKey: true });

      expect(project().overlays[0]?.text).toBe('텍스트');
    });

    it('클립을 끄는 중에는 단축키를 무시한다', () => {
      const { dispatch } = projectStore.getState();
      dispatch(
        createAddAssetCommand({ id: 'a', type: 'video', name: 'a.mp4', duration: 4_000_000 }),
      );
      dispatch(
        createAddClipCommand({
          id: 'c',
          assetId: 'a',
          trackId: DEFAULT_VIDEO_TRACK_ID,
          start: 0,
          inPoint: 0,
          outPoint: 4_000_000,
        }),
      );
      render(<App />);
      const clip = screen.getByRole('listitem', { name: '클립 a.mp4' });

      fireEvent.pointerDown(clip, { button: 0, pointerId: 1, clientX: 50, clientY: 80 });
      fireEvent.pointerMove(clip, { pointerId: 1, clientX: 150, clientY: 80 });
      pressUndo();

      expect(project().clips).toHaveLength(1);
      fireEvent.pointerUp(clip, { pointerId: 1, clientX: 150, clientY: 80 });
      expect(project().clips[0]?.start).toBe(2_000_000);

      // 놓은 뒤에는 이동이 되돌아간다
      pressUndo();
      expect(project().clips[0]?.start).toBe(0);
    });
  });
});

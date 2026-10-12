import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAddAssetCommand } from '@/core/commands/addAsset.ts';
import { createAddClipCommand } from '@/core/commands/addClip.ts';
import { toPersisted } from '@/core/persistence/persistedProject.ts';
import { DEFAULT_VIDEO_TRACK_ID } from '@/core/project.ts';
import { mediaStore } from '@/store/mediaStore.ts';
import { repository } from '@/features/persistence/session.ts';
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

  describe('키보드 단축키', () => {
    function addClip(start = 0) {
      const { dispatch, project: current } = projectStore.getState();
      if (!current.assets.some((asset) => asset.id === 'a')) {
        dispatch(
          createAddAssetCommand({ id: 'a', type: 'video', name: 'a.mp4', duration: 4_000_000 }),
        );
      }
      dispatch(
        createAddClipCommand({
          id: `c-${String(start)}`,
          assetId: 'a',
          trackId: DEFAULT_VIDEO_TRACK_ID,
          start,
          inPoint: 0,
          outPoint: 4_000_000,
        }),
      );
    }

    function press(
      key: string,
      init: Partial<KeyboardEventInit> = {},
      target: Element | Window = window,
    ) {
      fireEvent.keyDown(target, { key, ...init });
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('Space로 재생/일시정지를 토글하고, 키를 누르고 있어 반복되는 입력은 무시한다', () => {
      addClip();
      const toggle = vi.spyOn(playbackEngine, 'toggle').mockImplementation(() => undefined);
      render(<App />);

      press(' ', { code: 'Space' });
      press(' ', { code: 'Space', repeat: true });

      expect(toggle).toHaveBeenCalledOnce();
    });

    it('포커스된 버튼에서 Space를 눌러도 버튼 기본 동작 대신 재생을 토글한다', () => {
      addClip();
      const toggle = vi.spyOn(playbackEngine, 'toggle').mockImplementation(() => undefined);
      render(<App />);
      const button = screen.getByRole('button', { name: '텍스트' });
      button.focus();

      const notPrevented = fireEvent.keyDown(button, { key: ' ', code: 'Space' });

      expect(notPrevented).toBe(false);
      expect(toggle).toHaveBeenCalledOnce();
    });

    it('S로 플레이헤드 위치에서 자른다 (한글 입력 상태의 ㄴ도 같다)', () => {
      addClip();
      render(<App />);
      fireEvent.pointerDown(screen.getByTestId('timeline-content'), { button: 0, clientX: 50 });

      press('s', { code: 'KeyS' });
      expect(project().clips).toHaveLength(2);

      fireEvent.pointerDown(screen.getByTestId('timeline-content'), { button: 0, clientX: 150 });
      press('ㄴ', { code: 'KeyS' });
      expect(project().clips).toHaveLength(3);
    });

    it('Delete·Backspace로 선택한 항목을 지우고 undo로 되돌린다', () => {
      addClip(0);
      addClip(5_000_000);
      render(<App />);
      const [first, second] = screen.getAllByRole('listitem', { name: '클립 a.mp4' });
      if (!first || !second) {
        throw new Error('clips expected');
      }

      fireEvent.pointerDown(first, { button: 0, pointerId: 1, clientX: 10, clientY: 80 });
      fireEvent.pointerUp(first, { pointerId: 1, clientX: 10, clientY: 80 });
      press('Delete');
      expect(project().clips.map((clip) => clip.id)).toEqual(['c-5000000']);
      expect(timelineStore.getState().selectedItemId).toBeNull();

      fireEvent.pointerDown(second, { button: 0, pointerId: 2, clientX: 260, clientY: 80 });
      fireEvent.pointerUp(second, { pointerId: 2, clientX: 260, clientY: 80 });
      press('Backspace');
      expect(project().clips).toEqual([]);

      pressUndo();
      pressUndo();
      expect(project().clips.map((clip) => clip.id)).toEqual(['c-0', 'c-5000000']);
    });

    it('선택한 텍스트도 Delete로 지운다', () => {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: '텍스트' }));

      press('Delete');

      expect(project().overlays).toEqual([]);
    });

    it('입력칸에서는 띄어쓰기·s·Backspace가 단축키로 동작하지 않는다', () => {
      addClip();
      const toggle = vi.spyOn(playbackEngine, 'toggle').mockImplementation(() => undefined);
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: '텍스트' }));
      const textarea = screen.getByLabelText('내용');

      fireEvent.pointerDown(screen.getByTestId('timeline-content'), { button: 0, clientX: 50 });
      timelineStore.getState().selectItem(project().overlays[0]?.id ?? null);
      press(' ', { code: 'Space' }, textarea);
      press('s', { code: 'KeyS' }, textarea);
      press('Backspace', {}, textarea);

      expect(toggle).not.toHaveBeenCalled();
      expect(project().clips).toHaveLength(1);
      expect(project().overlays).toHaveLength(1);
    });

    it('한글 조합 중인 입력은 무시한다', () => {
      addClip();
      render(<App />);
      fireEvent.pointerDown(screen.getByTestId('timeline-content'), { button: 0, clientX: 50 });

      press('Process', { code: 'KeyS', isComposing: true });

      expect(project().clips).toHaveLength(1);
    });

    it('빈 트랙은 헤더의 삭제 버튼으로 지우고, 마지막 비디오 트랙은 지울 수 없다', () => {
      render(<App />);
      expect(screen.queryByRole('button', { name: '트랙 V1 삭제' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '텍스트' }));
      press('Delete');
      fireEvent.click(screen.getByRole('button', { name: '트랙 T1 삭제' }));

      expect(project().tracks.map((track) => track.kind)).toEqual(['video']);
      pressUndo();
      expect(project().tracks.map((track) => track.kind)).toEqual(['video', 'text']);
    });
  });

  describe('저장과 새 프로젝트', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('원본 파일이 없는 에셋은 "파일 없음"으로 표시한다', () => {
      mediaStore.setState(mediaStore.getInitialState(), true);
      projectStore.getState().dispatch(
        createAddAssetCommand({
          id: 'lost',
          type: 'video',
          name: 'lost.mp4',
          duration: 1_000_000,
        }),
      );
      render(<App />);

      expect(screen.getByText('파일 없음')).toBeInTheDocument();
    });

    it('새 프로젝트는 확인을 받은 뒤 저장본을 지우고 빈 프로젝트로 시작한다', async () => {
      await repository.saveProject(toPersisted(project(), 1));
      projectStore
        .getState()
        .dispatch(
          createAddAssetCommand({ id: 'a', type: 'video', name: 'a.mp4', duration: 1_000_000 }),
        );
      const confirm = vi
        .spyOn(window, 'confirm')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      render(<App />);
      const button = screen.getByRole('button', { name: '새 프로젝트' });

      fireEvent.click(button);
      expect(project().assets).toHaveLength(1);

      fireEvent.click(button);
      await vi.waitFor(() => {
        expect(project().assets).toEqual([]);
      });
      expect(confirm).toHaveBeenCalledTimes(2);
      expect(projectStore.getState().past).toEqual([]);
      expect(await repository.loadLastProject()).toBeNull();
    });
  });
});

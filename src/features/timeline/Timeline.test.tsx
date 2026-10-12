import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAddAssetCommand } from '@/core/commands/addAsset.ts';
import type { Asset } from '@/core/project.ts';
import { AssetPanel } from '@/features/assets/AssetPanel.tsx';
import { playbackEngine } from '@/features/preview/playback.ts';
import { mediaStore } from '@/store/mediaStore.ts';
import { playbackStore } from '@/store/playbackStore.ts';
import { projectStore } from '@/store/projectStore.ts';
import { timelineStore } from '@/store/timelineStore.ts';
import { Timeline } from './Timeline.tsx';

// 기본 배율 50px/s, jsdom의 getBoundingClientRect는 left 0을 반환하므로 clientX 100px = 2초
const PX_PER_SECOND = 50;

const intro: Asset = { id: 'intro', type: 'video', name: 'intro.mp4', duration: 4_000_000 };
const outro: Asset = { id: 'outro', type: 'video', name: 'outro.mp4', duration: 2_000_000 };

/** jsdom에는 DataTransfer가 없어 필요한 부분만 흉내 낸다 */
function createDataTransfer() {
  const data = new Map<string, string>();
  return {
    dropEffect: 'none',
    effectAllowed: 'all',
    files: [],
    get types() {
      return [...data.keys()];
    },
    setData(type: string, value: string) {
      data.set(type, value);
    },
    getData(type: string) {
      return data.get(type) ?? '';
    },
  };
}

function dragAssetToTrack(assetName: string, clientX: number) {
  const dataTransfer = createDataTransfer();
  const track = screen.getByRole('list', { name: '트랙 V1' });
  fireEvent.dragStart(screen.getByRole('listitem', { name: assetName }), { dataTransfer });
  fireEvent.dragOver(track, { dataTransfer, clientX });
  fireEvent.drop(track, { dataTransfer, clientX });
}

function clipStarts(): number[] {
  return projectStore.getState().project.clips.map((clip) => clip.start);
}

describe('Timeline', () => {
  beforeEach(() => {
    projectStore.setState(projectStore.getInitialState(), true);
    mediaStore.setState(mediaStore.getInitialState(), true);
    timelineStore.setState(timelineStore.getInitialState(), true);
    playbackEngine.seek(0);
    projectStore.getState().dispatch(createAddAssetCommand(intro));
    projectStore.getState().dispatch(createAddAssetCommand(outro));
    render(
      <>
        <AssetPanel />
        <Timeline />
      </>,
    );
  });

  it('에셋을 트랙에 놓으면 놓은 위치에 클립을 만든다', () => {
    dragAssetToTrack('intro.mp4', 2 * PX_PER_SECOND);

    const [clip] = projectStore.getState().project.clips;
    expect(clip).toMatchObject({
      assetId: 'intro',
      start: 2_000_000,
      inPoint: 0,
      outPoint: 4_000_000,
    });

    const view = within(screen.getByRole('list', { name: '트랙 V1' })).getByRole('listitem', {
      name: '클립 intro.mp4',
    });
    expect(view).toHaveStyle({ left: '100px', width: '200px' });
  });

  it('기존 클립 위에 놓으면 그 클립 바로 뒤에 붙인다', () => {
    dragAssetToTrack('intro.mp4', 0);
    dragAssetToTrack('outro.mp4', 3 * PX_PER_SECOND);

    expect(clipStarts()).toEqual([0, 4_000_000]);
  });

  it('드래그 중에는 실제로 놓일 위치를 미리 보여준다', () => {
    dragAssetToTrack('intro.mp4', 0);
    const dataTransfer = createDataTransfer();
    const track = screen.getByRole('list', { name: '트랙 V1' });

    fireEvent.dragStart(screen.getByRole('listitem', { name: 'outro.mp4' }), { dataTransfer });
    fireEvent.dragOver(track, { dataTransfer, clientX: 3 * PX_PER_SECOND });

    expect(screen.getByTestId('drop-preview')).toHaveStyle({ left: '200px', width: '100px' });

    fireEvent.dragLeave(track, { dataTransfer, relatedTarget: document.body });
    expect(screen.queryByTestId('drop-preview')).not.toBeInTheDocument();
  });

  it('드롭 후 커맨드 히스토리로 되돌릴 수 있다', () => {
    dragAssetToTrack('intro.mp4', 0);

    act(() => {
      projectStore.getState().undo();
    });

    expect(projectStore.getState().project.clips).toEqual([]);
    expect(screen.queryByRole('listitem', { name: '클립 intro.mp4' })).not.toBeInTheDocument();
  });

  it('에셋이 아닌 드래그(외부 파일 등)는 무시한다', () => {
    const track = screen.getByRole('list', { name: '트랙 V1' });

    fireEvent.drop(track, { dataTransfer: createDataTransfer(), clientX: 0 });

    expect(projectStore.getState().project.clips).toEqual([]);
  });

  it('타임라인을 클릭하면 그 시각으로 이동하고 플레이헤드가 따라온다', () => {
    dragAssetToTrack('intro.mp4', 0);

    fireEvent.pointerDown(screen.getByTestId('timeline-content'), {
      button: 0,
      clientX: 2 * PX_PER_SECOND,
    });

    expect(playbackStore.getState().currentTime).toBe(2_000_000);
    expect(screen.getByTestId('playhead')).toHaveStyle({ transform: 'translateX(100px)' });
  });

  it('프로젝트 끝보다 뒤를 클릭하면 끝으로 이동한다', () => {
    dragAssetToTrack('intro.mp4', 0);

    fireEvent.pointerDown(screen.getByTestId('timeline-content'), {
      button: 0,
      clientX: 20 * PX_PER_SECOND,
    });

    expect(playbackStore.getState().currentTime).toBe(4_000_000);
  });

  describe('클립 이동', () => {
    // 세로 배치: 눈금 0~24, 새 트랙 영역 24~56, 트랙은 56부터 56px씩 (위 트랙이 먼저)
    const NEW_TRACK_Y = 40;
    const FIRST_ROW_Y = 80;

    function clipElement(name: string) {
      return screen.getByRole('listitem', { name: `클립 ${name}` });
    }

    function dragClip(name: string, from: { x: number; y: number }, to: { x: number; y: number }) {
      const element = clipElement(name);
      fireEvent.pointerDown(element, { button: 0, pointerId: 1, clientX: from.x, clientY: from.y });
      fireEvent.pointerMove(element, { pointerId: 1, clientX: to.x, clientY: to.y });
      fireEvent.pointerUp(element, { pointerId: 1, clientX: to.x, clientY: to.y });
    }

    function clipsByTrack() {
      const { project } = projectStore.getState();
      return project.clips.map((clip) => ({
        asset: clip.assetId,
        start: clip.start,
        track: project.tracks.findIndex((track) => track.id === clip.trackId),
      }));
    }

    it('같은 트랙 안에서 끈 거리만큼 옮긴다', () => {
      dragAssetToTrack('intro.mp4', 0);

      dragClip('intro.mp4', { x: 50, y: FIRST_ROW_Y }, { x: 150, y: FIRST_ROW_Y });

      expect(clipStarts()).toEqual([2_000_000]);
    });

    it('겹치는 위치로 옮기면 가장 가까운 빈자리에 놓는다', () => {
      dragAssetToTrack('intro.mp4', 0);
      dragAssetToTrack('outro.mp4', 10 * PX_PER_SECOND);

      // outro(10s~12s)를 왼쪽으로 7s 끌면 3s → intro(0~4s)와 겹쳐 4s에 붙는다
      dragClip('outro.mp4', { x: 510, y: FIRST_ROW_Y }, { x: 160, y: FIRST_ROW_Y });

      expect(clipStarts()).toEqual([0, 4_000_000]);
    });

    it('끄는 동안 실제로 놓일 자리를 미리 보여주고 원래 클립은 흐리게 표시한다', () => {
      dragAssetToTrack('intro.mp4', 0);
      const element = clipElement('intro.mp4');

      fireEvent.pointerDown(element, {
        button: 0,
        pointerId: 1,
        clientX: 50,
        clientY: FIRST_ROW_Y,
      });
      fireEvent.pointerMove(element, { pointerId: 1, clientX: 100, clientY: FIRST_ROW_Y });

      expect(screen.getByTestId('drop-preview')).toHaveStyle({ left: '50px', width: '200px' });
      expect(element).toHaveClass('opacity-40');
      expect(clipStarts()).toEqual([0]);
    });

    it('새 트랙 영역에 놓으면 위에 트랙을 만들고 옮긴다', () => {
      dragAssetToTrack('intro.mp4', 0);

      dragClip('intro.mp4', { x: 50, y: FIRST_ROW_Y }, { x: 100, y: NEW_TRACK_Y });

      expect(projectStore.getState().project.tracks).toHaveLength(2);
      expect(clipsByTrack()).toEqual([{ asset: 'intro', start: 1_000_000, track: 1 }]);
      const trackNames = screen.getAllByRole('list', { name: /^트랙/ }).map((el) => el.ariaLabel);
      expect(trackNames).toEqual(['트랙 V2', '트랙 V1']);
    });

    it('다른 트랙으로 옮긴다', () => {
      dragAssetToTrack('intro.mp4', 0);
      dragAssetToTrack('outro.mp4', 10 * PX_PER_SECOND);
      // outro를 새 트랙(V2, 맨 위 56~112)으로 올린다
      dragClip('outro.mp4', { x: 510, y: FIRST_ROW_Y }, { x: 510, y: NEW_TRACK_Y });

      // intro(V1, 이제 112~168)를 V2로 올린다
      dragClip('intro.mp4', { x: 50, y: 140 }, { x: 50, y: FIRST_ROW_Y });

      const v2 = projectStore.getState().project.tracks[1]?.id;
      expect(projectStore.getState().project.clips.every((clip) => clip.trackId === v2)).toBe(true);
    });

    it('새 트랙으로 옮긴 것은 undo 한 번에 트랙까지 되돌린다', () => {
      dragAssetToTrack('intro.mp4', 0);
      dragClip('intro.mp4', { x: 50, y: FIRST_ROW_Y }, { x: 100, y: NEW_TRACK_Y });

      act(() => {
        projectStore.getState().undo();
      });

      expect(projectStore.getState().project.tracks).toHaveLength(1);
      expect(clipsByTrack()).toEqual([{ asset: 'intro', start: 0, track: 0 }]);
    });

    it('Esc를 누르면 이동을 취소한다', () => {
      dragAssetToTrack('intro.mp4', 0);
      const element = clipElement('intro.mp4');

      fireEvent.pointerDown(element, {
        button: 0,
        pointerId: 1,
        clientX: 50,
        clientY: FIRST_ROW_Y,
      });
      fireEvent.pointerMove(element, { pointerId: 1, clientX: 200, clientY: FIRST_ROW_Y });
      fireEvent.keyDown(window, { key: 'Escape' });
      fireEvent.pointerUp(element, { pointerId: 1, clientX: 200, clientY: FIRST_ROW_Y });

      expect(clipStarts()).toEqual([0]);
      expect(screen.queryByTestId('drop-preview')).not.toBeInTheDocument();
    });

    it('거의 움직이지 않고 떼면 클립을 선택하고 탐색하지 않는다', () => {
      dragAssetToTrack('intro.mp4', 0);
      const element = clipElement('intro.mp4');

      dragClip('intro.mp4', { x: 100, y: FIRST_ROW_Y }, { x: 102, y: FIRST_ROW_Y });

      expect(element).toHaveAttribute('data-selected', 'true');
      expect(playbackStore.getState().currentTime).toBe(0);
      // 에셋 추가 2개 + 클립 추가 1개만 있고 이동 커맨드는 없다
      expect(projectStore.getState().past.map((command) => command.label)).toEqual([
        '에셋 추가',
        '에셋 추가',
        '클립 추가',
      ]);
    });

    it('빈 곳을 클릭하면 선택을 해제한다', () => {
      dragAssetToTrack('intro.mp4', 0);
      dragClip('intro.mp4', { x: 100, y: FIRST_ROW_Y }, { x: 100, y: FIRST_ROW_Y });

      fireEvent.pointerDown(screen.getByTestId('timeline-content'), { button: 0, clientX: 400 });

      expect(clipElement('intro.mp4')).toHaveAttribute('data-selected', 'false');
    });
  });

  it('새 트랙 영역에 에셋을 놓으면 트랙을 만들고 클립을 추가한다', () => {
    const dataTransfer = createDataTransfer();
    const zone = screen.getByRole('region', { name: '새 트랙' });

    fireEvent.dragStart(screen.getByRole('listitem', { name: 'outro.mp4' }), { dataTransfer });
    fireEvent.dragOver(zone, { dataTransfer, clientX: 100 });
    fireEvent.drop(zone, { dataTransfer, clientX: 100 });

    const { project } = projectStore.getState();
    expect(project.tracks).toHaveLength(2);
    expect(project.clips[0]).toMatchObject({ trackId: project.tracks[1]?.id, start: 2_000_000 });
  });
});

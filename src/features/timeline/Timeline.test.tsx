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

  describe('트리밍과 자르기', () => {
    function handle(name: string, edge: '시작' | '끝') {
      return screen.getByRole('separator', { name: `${name} ${edge} 지점 트리밍` });
    }

    function dragHandle(name: string, edge: '시작' | '끝', fromX: number, toX: number) {
      const element = handle(name, edge);
      fireEvent.pointerDown(element, { button: 0, pointerId: 2, clientX: fromX, clientY: 80 });
      fireEvent.pointerMove(element, { pointerId: 2, clientX: toX, clientY: 80 });
      fireEvent.pointerUp(element, { pointerId: 2, clientX: toX, clientY: 80 });
    }

    function timings() {
      return projectStore
        .getState()
        .project.clips.map(({ start, inPoint, outPoint }) => ({ start, inPoint, outPoint }));
    }

    it('끝 손잡이를 끌면 outPoint를 줄인다', () => {
      dragAssetToTrack('intro.mp4', 0);

      dragHandle('intro.mp4', '끝', 200, 100);

      expect(timings()).toEqual([{ start: 0, inPoint: 0, outPoint: 2_000_000 }]);
    });

    it('시작 손잡이를 끌면 start와 inPoint를 함께 옮긴다', () => {
      dragAssetToTrack('intro.mp4', 0);

      dragHandle('intro.mp4', '시작', 0, 50);

      expect(timings()).toEqual([{ start: 1_000_000, inPoint: 1_000_000, outPoint: 4_000_000 }]);
    });

    it('원본 길이와 이웃 클립을 넘어 늘릴 수 없다', () => {
      dragAssetToTrack('intro.mp4', 0);
      dragAssetToTrack('outro.mp4', 5 * PX_PER_SECOND);
      dragHandle('intro.mp4', '끝', 200, 100);

      // 원본은 4s까지지만 outro가 5s에 있어도 원본 끝(4s)에서 멈춘다
      dragHandle('intro.mp4', '끝', 100, 400);
      // outro 시작을 앞으로 늘리면 intro 끝(4s)에서 멈춘다
      dragHandle('outro.mp4', '시작', 250, 0);

      expect(timings()).toEqual([
        { start: 0, inPoint: 0, outPoint: 4_000_000 },
        { start: 5_000_000, inPoint: 0, outPoint: 2_000_000 },
      ]);
    });

    it('트리밍 중에는 클립을 미리 줄여 보여주고 손잡이 드래그로 클립이 이동하지 않는다', () => {
      dragAssetToTrack('intro.mp4', 0);
      const element = handle('intro.mp4', '끝');

      fireEvent.pointerDown(element, { button: 0, pointerId: 2, clientX: 200, clientY: 80 });
      fireEvent.pointerMove(element, { pointerId: 2, clientX: 150, clientY: 80 });

      const clip = screen.getByRole('listitem', { name: '클립 intro.mp4' });
      expect(clip).toHaveStyle({ left: '0px', width: '150px' });
      expect(clip).not.toHaveClass('opacity-40');
      expect(timings()).toEqual([{ start: 0, inPoint: 0, outPoint: 4_000_000 }]);
    });

    it('Esc를 누르면 트리밍을 취소한다', () => {
      dragAssetToTrack('intro.mp4', 0);
      const element = handle('intro.mp4', '끝');

      fireEvent.pointerDown(element, { button: 0, pointerId: 2, clientX: 200, clientY: 80 });
      fireEvent.pointerMove(element, { pointerId: 2, clientX: 100, clientY: 80 });
      fireEvent.keyDown(window, { key: 'Escape' });
      fireEvent.pointerUp(element, { pointerId: 2, clientX: 100, clientY: 80 });

      expect(timings()).toEqual([{ start: 0, inPoint: 0, outPoint: 4_000_000 }]);
      expect(screen.getByRole('listitem', { name: '클립 intro.mp4' })).toHaveStyle({
        width: '200px',
      });
    });

    it('플레이헤드 위치에서 자르고 undo하면 합친다', () => {
      dragAssetToTrack('intro.mp4', 0);
      fireEvent.pointerDown(screen.getByTestId('timeline-content'), { button: 0, clientX: 75 });

      fireEvent.click(screen.getByRole('button', { name: '자르기' }));

      expect(timings()).toEqual([
        { start: 0, inPoint: 0, outPoint: 1_500_000 },
        { start: 1_500_000, inPoint: 1_500_000, outPoint: 4_000_000 },
      ]);
      expect(screen.getAllByRole('listitem', { name: '클립 intro.mp4' })).toHaveLength(2);

      act(() => {
        projectStore.getState().undo();
      });
      expect(timings()).toEqual([{ start: 0, inPoint: 0, outPoint: 4_000_000 }]);
    });

    it('플레이헤드 아래에 클립이 없으면 자르기 버튼이 비활성화된다', () => {
      dragAssetToTrack('intro.mp4', 0);
      fireEvent.pointerDown(screen.getByTestId('timeline-content'), { button: 0, clientX: 0 });

      expect(screen.getByRole('button', { name: '자르기' })).toBeDisabled();

      fireEvent.pointerDown(screen.getByTestId('timeline-content'), { button: 0, clientX: 100 });
      expect(screen.getByRole('button', { name: '자르기' })).toBeEnabled();
    });
  });

  describe('스냅과 프레임 정렬', () => {
    // 50px/s에서 스냅 거리 8px = 0.16초
    const ROW_Y = 80;

    function startDrag(name: string, fromX: number) {
      const element = screen.getByRole('listitem', { name: `클립 ${name}` });
      fireEvent.pointerDown(element, { button: 0, pointerId: 3, clientX: fromX, clientY: ROW_Y });
      return {
        move: (toX: number, altKey = false) => {
          fireEvent.pointerMove(element, { pointerId: 3, clientX: toX, clientY: ROW_Y, altKey });
        },
        drop: (toX: number) => {
          fireEvent.pointerUp(element, { pointerId: 3, clientX: toX, clientY: ROW_Y });
        },
      };
    }

    function startOf(assetId: string) {
      return projectStore.getState().project.clips.find((clip) => clip.assetId === assetId)?.start;
    }

    beforeEach(() => {
      dragAssetToTrack('intro.mp4', 0); // 0s~4s
      dragAssetToTrack('outro.mp4', 10 * PX_PER_SECOND); // 10s~12s
    });

    it('클립을 옮기면 다른 클립 경계에 붙고 안내선을 보여준다', () => {
      // outro를 왼쪽으로 295px → 시작 4.1s, intro 끝(4s)에서 0.1s 거리
      const drag = startDrag('outro.mp4', 510);
      drag.move(215);

      expect(screen.getByTestId('snap-line')).toHaveStyle({ left: '200px' });

      drag.drop(215);
      expect(startOf('outro')).toBe(4_000_000);
      expect(screen.queryByTestId('snap-line')).not.toBeInTheDocument();
    });

    it('Alt를 누른 채 끌면 스냅하지 않고 프레임 경계에만 맞춘다', () => {
      const drag = startDrag('outro.mp4', 510);
      drag.move(215, true);

      expect(screen.queryByTestId('snap-line')).not.toBeInTheDocument();
      drag.drop(215);
      expect(startOf('outro')).toBe(4_100_000);
    });

    it('툴바에서 스냅을 끄면 붙지 않는다', () => {
      const toggle = screen.getByRole('button', { name: '스냅' });
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-pressed', 'false');

      const drag = startDrag('outro.mp4', 510);
      drag.move(215);
      drag.drop(215);

      expect(startOf('outro')).toBe(4_100_000);
    });

    it('스냅되지 않은 위치는 가장 가까운 프레임 경계로 맞춘다', () => {
      fireEvent.click(screen.getByRole('button', { name: '스냅' }));

      // outro를 왼쪽으로 299px → 4.02s → 30fps 프레임 경계 4.033333s
      const drag = startDrag('outro.mp4', 510);
      drag.move(211);
      drag.drop(211);

      expect(startOf('outro')).toBe(4_033_333);
    });

    it('트리밍하는 끝이 플레이헤드에 붙는다', () => {
      fireEvent.pointerDown(screen.getByTestId('timeline-content'), { button: 0, clientX: 150 });
      const handle = screen.getByRole('separator', { name: 'intro.mp4 끝 지점 트리밍' });

      // 끝(4s)을 3.06s로 → 플레이헤드(3s)에 붙는다
      fireEvent.pointerDown(handle, { button: 0, pointerId: 4, clientX: 200, clientY: ROW_Y });
      fireEvent.pointerMove(handle, { pointerId: 4, clientX: 153, clientY: ROW_Y });
      expect(screen.getByTestId('snap-line')).toHaveStyle({ left: '150px' });
      fireEvent.pointerUp(handle, { pointerId: 4, clientX: 153, clientY: ROW_Y });

      expect(projectStore.getState().project.clips[0]?.outPoint).toBe(3_000_000);
    });

    it('에셋을 놓을 때도 클립 경계에 붙는다', () => {
      const dataTransfer = createDataTransfer();
      const zone = screen.getByRole('region', { name: '새 트랙' });

      fireEvent.dragStart(screen.getByRole('listitem', { name: 'outro.mp4' }), { dataTransfer });
      fireEvent.dragOver(zone, { dataTransfer, clientX: 205 });
      expect(screen.getByTestId('snap-line')).toHaveStyle({ left: '200px' });
      fireEvent.drop(zone, { dataTransfer, clientX: 205 });

      expect(projectStore.getState().project.clips.at(-1)?.start).toBe(4_000_000);
    });

    it('타임라인 클릭 탐색 위치도 프레임 경계로 맞춘다', () => {
      fireEvent.pointerDown(screen.getByTestId('timeline-content'), { button: 0, clientX: 101 });

      // 2.02s → 2.033333s
      expect(playbackStore.getState().currentTime).toBe(2_033_333);
    });
  });
});

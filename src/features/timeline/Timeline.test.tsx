import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAddAssetCommand } from '@/core/commands/addAsset.ts';
import type { Asset } from '@/core/project.ts';
import { AssetPanel } from '@/features/assets/AssetPanel.tsx';
import { mediaStore } from '@/store/mediaStore.ts';
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
});

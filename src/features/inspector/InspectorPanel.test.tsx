import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAddAssetCommand } from '@/core/commands/addAsset.ts';
import { createAddClipCommand } from '@/core/commands/addClip.ts';
import { DEFAULT_VIDEO_TRACK_ID } from '@/core/project.ts';
import { buildAddTextCommand } from '@/core/text.ts';
import { projectStore } from '@/store/projectStore.ts';
import { timelineStore } from '@/store/timelineStore.ts';
import { InspectorPanel } from './InspectorPanel.tsx';

function addText() {
  const { project, dispatch } = projectStore.getState();
  dispatch(buildAddTextCommand(project, 1_000_000, { overlayId: 'x', trackId: 'text-track' }));
  timelineStore.getState().selectItem('x');
}

function overlay() {
  return projectStore.getState().project.overlays[0];
}

describe('InspectorPanel', () => {
  beforeEach(() => {
    projectStore.setState(projectStore.getInitialState(), true);
    timelineStore.setState(timelineStore.getInitialState(), true);
  });

  it('선택한 항목이 없으면 안내 문구를 보여준다', () => {
    render(<InspectorPanel />);

    expect(screen.getByText('편집할 항목을 선택하세요')).toBeInTheDocument();
  });

  it('텍스트를 선택하면 내용·시작·길이를 보여준다', () => {
    addText();
    render(<InspectorPanel />);

    expect(screen.getByLabelText('내용')).toHaveValue('텍스트');
    expect(screen.getByText('00:00:01:00')).toBeInTheDocument();
    expect(screen.getByText('00:00:03:00')).toBeInTheDocument();
  });

  it('내용을 연속으로 입력하면 히스토리 한 항목으로 합쳐지고 undo 한 번에 되돌아간다', () => {
    addText();
    render(<InspectorPanel />);
    const historyBefore = projectStore.getState().past.length;
    const textarea = screen.getByLabelText('내용');

    fireEvent.change(textarea, { target: { value: '안' } });
    fireEvent.change(textarea, { target: { value: '안녕' } });
    fireEvent.change(textarea, { target: { value: '안녕하세요' } });

    expect(overlay()?.text).toBe('안녕하세요');
    expect(projectStore.getState().past).toHaveLength(historyBefore + 1);

    act(() => {
      projectStore.getState().undo();
    });
    expect(overlay()?.text).toBe('텍스트');
    expect(textarea).toHaveValue('텍스트');
  });

  it('글자 크기·색상·위치를 바꾼다', () => {
    addText();
    render(<InspectorPanel />);

    // 슬라이더는 키보드로 1씩, 숫자 칸은 값을 바로 바꾼다
    fireEvent.keyDown(screen.getByRole('slider', { name: '글자 크기' }), { key: 'ArrowRight' });
    expect(overlay()?.style.fontSize).toBe(73);
    fireEvent.change(screen.getByLabelText('글자 크기 값'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('색상'), { target: { value: '#ff0000' } });
    fireEvent.change(screen.getByLabelText('X'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('Y'), { target: { value: '900' } });

    expect(overlay()?.style).toEqual({ fontSize: 120, color: '#ff0000', x: 300, y: 900 });
  });

  it('숫자가 아닌 입력은 무시한다', () => {
    addText();
    render(<InspectorPanel />);

    fireEvent.change(screen.getByLabelText('X'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('글자 크기 값'), { target: { value: '0' } });

    expect(overlay()?.style).toMatchObject({ fontSize: 72, x: 960 });
  });

  it('클립을 선택하면 위치·크기를 바꾸고 원위치로 되돌린다', () => {
    const { dispatch } = projectStore.getState();
    dispatch(
      createAddAssetCommand({ id: 'img', type: 'image', name: 'photo.png', duration: 5_000_000 }),
    );
    dispatch(
      createAddClipCommand({
        id: 'c',
        assetId: 'img',
        trackId: DEFAULT_VIDEO_TRACK_ID,
        start: 0,
        inPoint: 0,
        outPoint: 5_000_000,
      }),
    );
    timelineStore.getState().selectItem('c');
    render(<InspectorPanel />);
    const clip = () => projectStore.getState().project.clips[0];

    expect(screen.getByLabelText('X')).toHaveValue(960);
    expect(screen.getByRole('button', { name: '원위치' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('크기 값'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('X'), { target: { value: '400' } });
    expect(clip()?.transform).toEqual({ x: 400, y: 540, scale: 0.5 });

    fireEvent.click(screen.getByRole('button', { name: '원위치' }));
    expect(clip()).not.toHaveProperty('transform');
    expect(screen.getByLabelText('크기 값')).toHaveValue(100);
  });
});

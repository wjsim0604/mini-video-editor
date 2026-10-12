import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildAddTextCommand } from '@/core/text.ts';
import { playbackStore } from '@/store/playbackStore.ts';
import { projectStore } from '@/store/projectStore.ts';
import { timelineStore } from '@/store/timelineStore.ts';
import { TextOverlayHandles } from './TextOverlayHandles.tsx';

// 1920×1080 출력을 960×540으로 표시 → 화면 1px = 출력 2px
const WIDTH = 960;
const HEIGHT = 540;

function overlay() {
  return projectStore.getState().project.overlays[0];
}

function box() {
  return screen.getByRole('button', { name: '텍스트 상자 텍스트' });
}

describe('TextOverlayHandles', () => {
  beforeEach(() => {
    projectStore.setState(projectStore.getInitialState(), true);
    timelineStore.setState(timelineStore.getInitialState(), true);
    playbackStore.setState({ currentTime: 1_000_000, isPlaying: false });
    const { project, dispatch } = projectStore.getState();
    // 0~3초에 화면 가운데(960, 540) 텍스트
    dispatch(buildAddTextCommand(project, 0, { overlayId: 'x', trackId: 'text-track' }));
  });

  it('현재 시각에 보이는 텍스트 위치에 조작 영역을 그린다 (화면 배율 적용)', () => {
    render(<TextOverlayHandles width={WIDTH} height={HEIGHT} />);

    const style = box().style;
    const centerX = Number.parseFloat(style.left) + Number.parseFloat(style.width) / 2;
    const centerY = Number.parseFloat(style.top) + Number.parseFloat(style.height) / 2;
    expect(centerX).toBeCloseTo(480);
    expect(centerY).toBeCloseTo(270);
  });

  it('현재 시각에 없는 텍스트나 재생 중에는 그리지 않는다', () => {
    render(<TextOverlayHandles width={WIDTH} height={HEIGHT} />);

    act(() => {
      playbackStore.setState({ currentTime: 5_000_000 });
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    act(() => {
      playbackStore.setState({ currentTime: 1_000_000, isPlaying: true });
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('클릭하면 텍스트를 선택한다', () => {
    render(<TextOverlayHandles width={WIDTH} height={HEIGHT} />);

    fireEvent.pointerDown(box(), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(box(), { pointerId: 1, clientX: 100, clientY: 100 });

    expect(timelineStore.getState().selectedItemId).toBe('x');
    expect(box()).toHaveAttribute('aria-pressed', 'true');
    expect(overlay()?.style).toMatchObject({ x: 960, y: 540 });
  });

  it('끌면 출력 해상도 기준으로 위치를 옮기고 놓을 때 한 번만 기록한다', () => {
    render(<TextOverlayHandles width={WIDTH} height={HEIGHT} />);
    const historyBefore = projectStore.getState().past.length;
    const element = box();

    fireEvent.pointerDown(element, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(element, { pointerId: 1, clientX: 130, clientY: 110 });
    fireEvent.pointerMove(element, { pointerId: 1, clientX: 150, clientY: 120 });

    // 드래그 중에는 Project가 바뀌지 않는다
    expect(overlay()?.style).toMatchObject({ x: 960, y: 540 });

    fireEvent.pointerUp(element, { pointerId: 1, clientX: 150, clientY: 120 });

    // 화면 (50, 20) 이동 = 출력 (100, 40) 이동
    expect(overlay()?.style).toMatchObject({ x: 1060, y: 580 });
    expect(projectStore.getState().past).toHaveLength(historyBefore + 1);
  });

  it('Esc를 누르면 위치 이동을 취소한다', () => {
    render(<TextOverlayHandles width={WIDTH} height={HEIGHT} />);
    const element = box();

    fireEvent.pointerDown(element, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(element, { pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(element, { pointerId: 1, clientX: 200, clientY: 200 });

    expect(overlay()?.style).toMatchObject({ x: 960, y: 540 });
  });
});

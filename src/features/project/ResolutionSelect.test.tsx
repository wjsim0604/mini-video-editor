import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildAddTextCommand } from '@/core/text.ts';
import { projectStore } from '@/store/projectStore.ts';
import { ResolutionSelect } from './ResolutionSelect.tsx';

function select() {
  return screen.getByLabelText('출력 해상도');
}

describe('ResolutionSelect', () => {
  beforeEach(() => {
    projectStore.setState(projectStore.getInitialState(), true);
  });

  it('현재 해상도의 프리셋을 보여준다', () => {
    render(<ResolutionSelect />);

    expect(select()).toHaveValue('1080p');
  });

  it('프리셋을 고르면 해상도와 텍스트 위치를 바꾸고 undo 한 번에 되돌린다', () => {
    const { project, dispatch } = projectStore.getState();
    dispatch(buildAddTextCommand(project, 0, { overlayId: 'x', trackId: 't' }));
    render(<ResolutionSelect />);

    fireEvent.change(select(), { target: { value: 'vertical' } });

    const changed = projectStore.getState().project;
    expect(changed).toMatchObject({ width: 1080, height: 1920 });
    expect(changed.overlays[0]?.style).toMatchObject({ x: 540, y: 960 });
    expect(select()).toHaveValue('vertical');

    act(() => {
      projectStore.getState().undo();
    });
    expect(projectStore.getState().project).toMatchObject({ width: 1920, height: 1080 });
    expect(projectStore.getState().project.overlays[0]?.style).toMatchObject({ x: 960, y: 540 });
    expect(select()).toHaveValue('1080p');
  });

  it('프리셋에 없는 해상도(이전 저장본 등)는 그대로 표시한다', () => {
    projectStore.getState().loadProject({
      ...projectStore.getState().project,
      width: 1000,
      height: 500,
    });
    render(<ResolutionSelect />);

    expect(select()).toHaveValue('1000x500');
  });
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ProbeModule from '@/engine/media/probe.ts';
import { probeFile, UnsupportedMediaError, type ProbeResult } from '@/engine/media/probe.ts';
import { mediaStore } from '@/store/mediaStore.ts';
import { projectStore } from '@/store/projectStore.ts';
import { AssetPanel } from './AssetPanel.tsx';

vi.mock('@/engine/media/probe.ts', async (importOriginal) => {
  const original = await importOriginal<typeof ProbeModule>();
  return { ...original, probeFile: vi.fn() };
});

const probeFileMock = vi.mocked(probeFile);

const videoResult: ProbeResult = {
  type: 'video',
  duration: 65_000_000,
  width: 1920,
  height: 1080,
  thumbnail: new Blob(),
};

function selectFiles(files: File[]) {
  fireEvent.change(screen.getByTestId('asset-file-input'), { target: { files } });
}

describe('AssetPanel', () => {
  beforeEach(() => {
    projectStore.setState(projectStore.getInitialState(), true);
    mediaStore.setState(mediaStore.getInitialState(), true);
    URL.createObjectURL = vi.fn(() => 'blob:thumbnail');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('비어 있으면 안내 문구를 보여준다', () => {
    render(<AssetPanel />);

    expect(screen.getByText(/끌어다 놓으세요/)).toBeInTheDocument();
  });

  it('선택한 영상을 썸네일, 길이, 해상도와 함께 표시한다', async () => {
    probeFileMock.mockResolvedValue(videoResult);
    render(<AssetPanel />);

    selectFiles([new File([''], 'intro.mp4', { type: 'video/mp4' })]);

    const list = await screen.findByRole('list', { name: '에셋 목록' });
    await waitFor(() => {
      expect(within(list).getByText('intro.mp4')).toBeInTheDocument();
    });
    expect(within(list).getByText('1:05')).toBeInTheDocument();
    expect(within(list).getByText('1920×1080')).toBeInTheDocument();
    expect(list.querySelector('img')).toHaveAttribute('src', 'blob:thumbnail');
    expect(projectStore.getState().project.assets).toHaveLength(1);
  });

  it('여러 파일을 선택한 순서대로 등록한다', async () => {
    probeFileMock.mockResolvedValue(videoResult);
    render(<AssetPanel />);

    selectFiles([
      new File([''], 'a.mp4', { type: 'video/mp4' }),
      new File([''], 'b.mp4', { type: 'video/mp4' }),
    ]);

    await waitFor(() => {
      expect(projectStore.getState().project.assets.map((asset) => asset.name)).toEqual([
        'a.mp4',
        'b.mp4',
      ]);
    });
  });

  it('드롭한 파일을 가져온다', async () => {
    probeFileMock.mockResolvedValue({ ...videoResult, type: 'image' });
    render(<AssetPanel />);

    fireEvent.drop(screen.getByRole('region', { name: '에셋' }), {
      dataTransfer: { files: [new File([''], 'photo.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(projectStore.getState().project.assets.map((asset) => asset.name)).toEqual([
        'photo.png',
      ]);
    });
    expect(screen.getByText('photo.png')).toBeInTheDocument();
  });

  it('분석 중에는 불러오는 중 상태를 보여준다', async () => {
    let resolveProbe: (result: ProbeResult) => void = () => undefined;
    probeFileMock.mockReturnValue(
      new Promise((resolve) => {
        resolveProbe = resolve;
      }),
    );
    render(<AssetPanel />);

    selectFiles([new File([''], 'slow.mp4', { type: 'video/mp4' })]);

    expect(await screen.findByText('불러오는 중…')).toBeInTheDocument();
    resolveProbe(videoResult);
    await waitFor(() => {
      expect(screen.queryByText('불러오는 중…')).not.toBeInTheDocument();
    });
  });

  it('지원하지 않는 파일은 오류를 표시하고 닫을 수 있다', async () => {
    probeFileMock.mockRejectedValue(new UnsupportedMediaError('지원하지 않는 형식입니다'));
    render(<AssetPanel />);

    selectFiles([new File([''], 'notes.txt', { type: 'text/plain' })]);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('notes.txt');
    expect(alert).toHaveTextContent('지원하지 않는 형식입니다');
    expect(projectStore.getState().project.assets).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'notes.txt 오류 닫기' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  describe('SRT 자막', () => {
    const srt = (body: string) => new File([body], 'subs.srt', { type: '' });

    it('자막을 새 텍스트 트랙에 추가하고 에셋으로는 등록하지 않는다', async () => {
      render(<AssetPanel />);

      selectFiles([
        srt('1\n00:00:01,000 --> 00:00:02,000\n안녕\n\n2\n00:00:02,000 --> 00:00:03,000\n반가워\n'),
      ]);

      await waitFor(() => {
        expect(projectStore.getState().project.overlays).toHaveLength(2);
      });
      const { project } = projectStore.getState();
      expect(project.overlays.map((overlay) => overlay.text)).toEqual(['안녕', '반가워']);
      expect(project.tracks.filter((track) => track.kind === 'text')).toHaveLength(1);
      expect(project.assets).toHaveLength(0);
      expect(probeFileMock).not.toHaveBeenCalled();

      // undo 한 번에 트랙과 자막이 모두 사라진다
      projectStore.getState().undo();
      expect(projectStore.getState().project.overlays).toHaveLength(0);
      expect(projectStore.getState().project.tracks).toHaveLength(1);
    });

    it('자막을 찾지 못하면 오류를 보여준다', async () => {
      render(<AssetPanel />);

      selectFiles([srt('그냥 텍스트')]);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('자막을 찾지 못했습니다');
      expect(projectStore.getState().project.overlays).toHaveLength(0);
    });

    it('일부 블록을 건너뛰면 개수를 알려준다', async () => {
      render(<AssetPanel />);

      selectFiles([srt('1\n00:00:01,000 --> 00:00:02,000\n정상\n\n2\n잘못된 시간\n내용\n')]);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('1개를 가져왔고, 형식이 잘못된 1개는 건너뛰었습니다');
      expect(projectStore.getState().project.overlays).toHaveLength(1);
    });
  });
});

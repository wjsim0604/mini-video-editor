import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAddAssetCommand } from '@/core/commands/addAsset.ts';
import { createAddClipCommand } from '@/core/commands/addClip.ts';
import { DEFAULT_VIDEO_TRACK_ID } from '@/core/project.ts';
import type * as CodecModule from '@/engine/export/codec.ts';
import type * as ExportModule from '@/engine/export/exportVideo.ts';
import type { ExportOptions, ExportResult } from '@/engine/export/exportVideo.ts';
import { exportVideo, ExportUnsupportedError } from '@/engine/export/exportVideo.ts';
import { projectStore } from '@/store/projectStore.ts';
import { ExportButton } from './ExportButton.tsx';
import { ExportDialog } from './ExportDialog.tsx';
import { exportStore } from './exportStore.ts';

vi.mock('@/engine/export/exportVideo.ts', async (importOriginal) => {
  const original = await importOriginal<typeof ExportModule>();
  return { ...original, exportVideo: vi.fn() };
});

// jsdom에는 WebCodecs가 없으므로 내보내기 가능 여부 확인은 지원되는 것으로 둔다
vi.mock('@/engine/export/codec.ts', async (importOriginal) => {
  const original = await importOriginal<typeof CodecModule>();
  return { ...original, checkExportSupport: () => Promise.resolve(true) };
});

const exportVideoMock = vi.mocked(exportVideo);

/** 테스트가 진행률·완료·실패 시점을 제어하는 가짜 내보내기 */
function controllableExport() {
  let options: ExportOptions | null = null;
  let resolve: (result: ExportResult) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  exportVideoMock.mockImplementation((given) => {
    options = given;
    given.signal.addEventListener('abort', () => {
      reject(new DOMException('cancelled', 'AbortError'));
    });
    return new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
  });
  return {
    progress: (frame: number, total: number) => {
      act(() => {
        options?.onProgress({ frame, total });
      });
    },
    finish: async (result: ExportResult) => {
      await act(async () => {
        resolve(result);
        await Promise.resolve();
      });
    },
    fail: async (error: unknown) => {
      await act(async () => {
        reject(error);
        await Promise.resolve();
      });
    },
    signal: () => options?.signal,
  };
}

function addClip() {
  const { dispatch } = projectStore.getState();
  dispatch(createAddAssetCommand({ id: 'a', type: 'video', name: 'a.mp4', duration: 4_000_000 }));
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
}

describe('내보내기', () => {
  let clickedDownloads: string[];

  beforeEach(() => {
    projectStore.setState(projectStore.getInitialState(), true);
    exportStore.setState({ state: { status: 'idle' } });
    clickedDownloads = [];
    URL.createObjectURL = vi.fn(() => 'blob:export');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clickedDownloads.push(this.download);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderUi() {
    render(
      <>
        <ExportButton />
        <ExportDialog />
      </>,
    );
  }

  it('빈 프로젝트에서는 내보내기 버튼이 비활성화된다', () => {
    renderUi();

    expect(screen.getByRole('button', { name: '내보내기' })).toBeDisabled();
  });

  it('진행률을 보여주고, 완료되면 파일을 내려받는다', async () => {
    addClip();
    const fake = controllableExport();
    renderUi();

    fireEvent.click(screen.getByRole('button', { name: '내보내기' }));
    expect(screen.getByRole('dialog', { name: 'MP4로 내보내는 중' })).toBeInTheDocument();

    fake.progress(30, 120);
    expect(screen.getByRole('progressbar', { name: '내보내기 진행률' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    expect(screen.getByText('30 / 120 프레임 (25%)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '내보내기' })).toBeDisabled();

    await fake.finish({ blob: new Blob(['mp4']), codec: 'avc', codecLabel: 'H.264', frames: 120 });

    expect(screen.getByRole('dialog', { name: '내보내기 완료' })).toBeInTheDocument();
    expect(clickedDownloads).toEqual(['새 프로젝트.mp4']);
    expect(screen.queryByText(/H.264 인코더를 쓸 수 없어/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다시 받기' }));
    expect(clickedDownloads).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('H.264가 아닌 코덱으로 내보내면 재생 호환성을 안내한다', async () => {
    addClip();
    const fake = controllableExport();
    renderUi();
    fireEvent.click(screen.getByRole('button', { name: '내보내기' }));

    await fake.finish({ blob: new Blob(['mp4']), codec: 'vp9', codecLabel: 'VP9', frames: 120 });

    expect(screen.getByText(/H.264 인코더를 쓸 수 없어 VP9로 내보냈습니다/)).toBeInTheDocument();
  });

  it('취소하면 내보내기를 중단하고 내려받지 않는다', async () => {
    addClip();
    const fake = controllableExport();
    renderUi();
    fireEvent.click(screen.getByRole('button', { name: '내보내기' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '취소' }));
      await Promise.resolve();
    });

    expect(fake.signal()?.aborted).toBe(true);
    expect(screen.getByRole('dialog', { name: '내보내기를 취소했습니다' })).toBeInTheDocument();
    expect(clickedDownloads).toEqual([]);
  });

  it('인코딩을 지원하지 않으면 이유를 보여준다', async () => {
    addClip();
    const fake = controllableExport();
    renderUi();
    fireEvent.click(screen.getByRole('button', { name: '내보내기' }));

    await fake.fail(
      new ExportUnsupportedError('이 브라우저에서는 영상 인코딩(WebCodecs)을 사용할 수 없습니다'),
    );

    expect(screen.getByRole('dialog', { name: '내보내기 실패' })).toHaveTextContent('WebCodecs');
  });

  it('인코딩을 지원하지 않는 브라우저에서는 버튼을 끄고 이유를 알려준다', async () => {
    addClip();
    const codec = await import('@/engine/export/codec.ts');
    vi.spyOn(codec, 'checkExportSupport').mockResolvedValue(false);
    renderUi();

    const button = screen.getByRole('button', { name: '내보내기' });
    await vi.waitFor(() => {
      expect(button).toBeDisabled();
    });
    expect(button).toHaveAttribute('title', expect.stringContaining('WebCodecs'));
  });
});

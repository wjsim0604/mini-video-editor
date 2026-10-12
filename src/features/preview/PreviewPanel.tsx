import { useEffect, useRef, useState } from 'react';
import { containRect } from '@/core/render/fit.ts';
import { useProjectStore } from '@/store/projectStore.ts';
import { PlaybackControls } from './PlaybackControls.tsx';
import { playbackEngine, previewRenderer } from './playback.ts';
import { TextOverlayHandles } from './TextOverlayHandles.tsx';

/** 캔버스 주변 여백(px) */
const PREVIEW_MARGIN = 12;

export function PreviewPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outputWidth = useProjectStore((state) => state.project.width);
  const outputHeight = useProjectStore((state) => state.project.height);
  // 캔버스의 화면 크기. 텍스트 조작 레이어가 같은 크기로 겹쳐진다
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) {
      return;
    }

    // 출력 비율을 유지한 채 영역에 맞추고, 캔버스 픽셀 수는 화면 크기 × devicePixelRatio로 둔다
    const resize = () => {
      const fit = containRect(
        outputWidth,
        outputHeight,
        Math.max(0, container.clientWidth - PREVIEW_MARGIN * 2),
        Math.max(0, container.clientHeight - PREVIEW_MARGIN * 2),
      );
      const ratio = window.devicePixelRatio || 1;
      setDisplaySize((current) =>
        current.width === fit.width && current.height === fit.height
          ? current
          : { width: fit.width, height: fit.height },
      );
      previewRenderer.setCanvas(
        canvas,
        Math.max(1, Math.round(fit.width * ratio)),
        Math.max(1, Math.round(fit.height * ratio)),
      );
      playbackEngine.refresh();
    };

    resize();
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        previewRenderer.setCanvas(null);
      };
    }
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => {
      observer.disconnect();
      previewRenderer.setCanvas(null);
    };
  }, [outputWidth, outputHeight]);

  return (
    <section aria-label="프리뷰" className="flex min-h-0 min-w-0 flex-col bg-background">
      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
      >
        <div className="relative" style={displaySize}>
          <canvas
            ref={canvasRef}
            aria-label="프리뷰 화면"
            className="block h-full w-full bg-black"
          />
          <TextOverlayHandles width={displaySize.width} height={displaySize.height} />
        </div>
      </div>
      <PlaybackControls />
    </section>
  );
}

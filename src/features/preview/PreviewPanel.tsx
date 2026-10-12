import { useEffect, useRef } from 'react';
import { containRect } from '@/core/render/fit.ts';
import { useProjectStore } from '@/store/projectStore.ts';
import { PlaybackControls } from './PlaybackControls.tsx';
import { playbackEngine, previewRenderer } from './playback.ts';

/** 캔버스 주변 여백(px) */
const PREVIEW_MARGIN = 12;

export function PreviewPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outputWidth = useProjectStore((state) => state.project.width);
  const outputHeight = useProjectStore((state) => state.project.height);

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
      canvas.style.width = `${String(fit.width)}px`;
      canvas.style.height = `${String(fit.height)}px`;
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
    <section aria-label="프리뷰" className="flex min-h-0 min-w-0 flex-col bg-neutral-950">
      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
      >
        <canvas ref={canvasRef} aria-label="프리뷰 화면" className="bg-black" />
      </div>
      <PlaybackControls />
    </section>
  );
}

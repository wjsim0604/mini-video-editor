import { buildAddTextCommand } from '@/core/text.ts';
import { quantizeToFrame } from '@/core/time.ts';
import { findSplitTargets } from '@/core/timeline/split.ts';
import { sliderToZoom, stepZoom, zoomToSlider } from '@/core/timeline/zoom.ts';
import { playbackStore, usePlaybackStore } from '@/store/playbackStore.ts';
import { projectStore, useProjectStore } from '@/store/projectStore.ts';
import { timelineStore, useTimelineStore } from '@/store/timelineStore.ts';
import { saveSubtitlesAsSrt } from '@/features/subtitles/saveSubtitles.ts';
import { splitAtPlayhead } from './actions.ts';
import type { ZoomController } from './useZoomController.ts';

interface TimelineToolbarProps {
  pxPerSecond: number;
  zoom: ZoomController;
}

const ICON_BUTTON_CLASS =
  'flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs text-neutral-300 hover:bg-neutral-800';

export function TimelineToolbar({ pxPerSecond, zoom }: TimelineToolbarProps) {
  const project = useProjectStore((state) => state.project);
  const selectedItemId = useTimelineStore((state) => state.selectedItemId);
  const snapEnabled = useTimelineStore((state) => state.snapEnabled);
  const hasText = project.overlays.some((overlay) => overlay.text.trim() !== '');
  // currentTime은 재생 중 매 프레임 바뀌지만, 자를 수 있는지 여부(boolean)가 바뀔 때만 리렌더된다
  const canSplit = usePlaybackStore(
    (state) => findSplitTargets(project, state.currentTime, selectedItemId).length > 0,
  );

  const handleAddText = () => {
    const { project: latest, dispatch } = projectStore.getState();
    const overlayId = crypto.randomUUID();
    const time = quantizeToFrame(playbackStore.getState().currentTime, latest.fps);
    dispatch(buildAddTextCommand(latest, time, { overlayId, trackId: crypto.randomUUID() }));
    timelineStore.getState().selectItem(overlayId);
  };

  return (
    <div
      role="toolbar"
      aria-label="타임라인 도구"
      className="flex h-8 shrink-0 items-center gap-1 border-b border-neutral-800 px-2"
    >
      <button
        type="button"
        title="플레이헤드 위치에 텍스트 추가"
        className="flex h-6 items-center gap-1 rounded px-2 text-xs text-neutral-200 hover:bg-neutral-800"
        onClick={handleAddText}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 fill-none stroke-current"
          strokeWidth="1.5"
        >
          <path d="M3 4V3h10v1M8 3v10M6 13h4" />
        </svg>
        텍스트
      </button>
      <button
        type="button"
        title="플레이헤드 위치에서 자르기 (S)"
        disabled={!canSplit}
        className="flex h-6 items-center gap-1 rounded px-2 text-xs text-neutral-200 hover:bg-neutral-800 disabled:text-neutral-600 disabled:hover:bg-transparent"
        onClick={() => {
          splitAtPlayhead();
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 fill-none stroke-current"
          strokeWidth="1.5"
        >
          <circle cx="4" cy="4" r="2" />
          <circle cx="4" cy="12" r="2" />
          <path d="M5.5 5.5L14 12M5.5 10.5L14 4" />
        </svg>
        자르기
      </button>
      <div aria-hidden="true" className="mx-1 h-4 w-px bg-neutral-800" />
      <button
        type="button"
        aria-pressed={snapEnabled}
        title="스냅 켜기/끄기 (드래그 중 Alt를 누르면 일시 해제)"
        className={`flex h-6 items-center gap-1 rounded px-2 text-xs hover:bg-neutral-800 ${
          snapEnabled ? 'text-amber-300' : 'text-neutral-500'
        }`}
        onClick={() => {
          timelineStore.getState().toggleSnap();
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 fill-none stroke-current"
          strokeWidth="1.5"
        >
          <path d="M3 2v6a5 5 0 0 0 10 0V2M3 5h3M10 5h3" />
        </svg>
        스냅
      </button>
      <div aria-hidden="true" className="mx-1 h-4 w-px bg-neutral-800" />
      <button
        type="button"
        title={hasText ? '모든 텍스트를 SRT 자막 파일로 저장' : '저장할 텍스트가 없습니다'}
        disabled={!hasText}
        className="flex h-6 items-center gap-1 rounded px-2 text-xs text-neutral-200 hover:bg-neutral-800 disabled:text-neutral-600 disabled:hover:bg-transparent"
        onClick={() => {
          saveSubtitlesAsSrt();
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 fill-none stroke-current"
          strokeWidth="1.5"
        >
          <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
          <path d="M4 8.5h3M9 8.5h3M4 10.5h8" />
        </svg>
        SRT 저장
      </button>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label="축소"
          title="축소 (Ctrl/Cmd + 휠)"
          className={ICON_BUTTON_CLASS}
          onClick={() => {
            zoom.zoomTo(stepZoom(pxPerSecond, -1));
          }}
        >
          −
        </button>
        <input
          type="range"
          aria-label="타임라인 확대 비율"
          min={0}
          max={1}
          step={0.01}
          value={zoomToSlider(pxPerSecond)}
          className="w-28 accent-neutral-300"
          onChange={(event) => {
            zoom.zoomTo(sliderToZoom(Number(event.target.value)));
          }}
        />
        <button
          type="button"
          aria-label="확대"
          title="확대 (Ctrl/Cmd + 휠)"
          className={ICON_BUTTON_CLASS}
          onClick={() => {
            zoom.zoomTo(stepZoom(pxPerSecond, 1));
          }}
        >
          +
        </button>
        <button
          type="button"
          title="프로젝트 전체를 화면에 맞추기"
          className={ICON_BUTTON_CLASS}
          onClick={zoom.fitAll}
        >
          전체 보기
        </button>
      </div>
    </div>
  );
}

import { Captions, Magnet, Maximize2, Scissors, Type, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { Slider } from '@/components/ui/slider.tsx';
import { Toggle } from '@/components/ui/toggle.tsx';
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
      className="flex h-9 shrink-0 items-center gap-1 border-b bg-panel px-2"
    >
      <Button
        variant="ghost"
        size="xs"
        title="플레이헤드 위치에 텍스트 추가"
        onClick={handleAddText}
      >
        <Type />
        텍스트
      </Button>
      <Button
        variant="ghost"
        size="xs"
        title="플레이헤드 위치에서 자르기 (S)"
        disabled={!canSplit}
        onClick={() => {
          splitAtPlayhead();
        }}
      >
        <Scissors />
        자르기
      </Button>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
      <Toggle
        size="sm"
        pressed={snapEnabled}
        title="스냅 켜기/끄기 (드래그 중 Alt를 누르면 일시 해제)"
        className="h-6 min-w-6 gap-1 px-2 text-xs text-muted-foreground data-[state=on]:bg-warning/15 data-[state=on]:text-warning [&_svg:not([class*='size-'])]:size-3"
        onPressedChange={() => {
          timelineStore.getState().toggleSnap();
        }}
      >
        <Magnet />
        스냅
      </Toggle>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
      <Button
        variant="ghost"
        size="xs"
        title={hasText ? '모든 텍스트를 SRT 자막 파일로 저장' : '저장할 텍스트가 없습니다'}
        disabled={!hasText}
        onClick={() => {
          saveSubtitlesAsSrt();
        }}
      >
        <Captions />
        SRT 저장
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="축소"
          title="축소 (Ctrl/Cmd + 휠)"
          onClick={() => {
            zoom.zoomTo(stepZoom(pxPerSecond, -1));
          }}
        >
          <ZoomOut />
        </Button>
        <Slider
          aria-label="타임라인 확대 비율"
          min={0}
          max={1}
          step={0.01}
          value={[zoomToSlider(pxPerSecond)]}
          className="w-28"
          onValueChange={([value]) => {
            if (value !== undefined) {
              zoom.zoomTo(sliderToZoom(value));
            }
          }}
        />
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="확대"
          title="확대 (Ctrl/Cmd + 휠)"
          onClick={() => {
            zoom.zoomTo(stepZoom(pxPerSecond, 1));
          }}
        >
          <ZoomIn />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          title="프로젝트 전체를 화면에 맞추기"
          onClick={zoom.fitAll}
        >
          <Maximize2 />
          전체 보기
        </Button>
      </div>
    </div>
  );
}

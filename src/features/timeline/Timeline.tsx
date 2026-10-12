import { useMemo, useRef, type PointerEvent } from 'react';
import { projectDuration } from '@/core/composition.ts';
import { pxToUs, usToPx } from '@/core/timeline/coords.ts';
import { quantizeToFrame, US_PER_SECOND } from '@/core/time.ts';
import { timelineItems } from '@/core/timelineItem.ts';
import { sortTracksForDisplay, trackLabels } from '@/core/track.ts';
import { playbackEngine } from '@/features/preview/playback.ts';
import { useProjectStore } from '@/store/projectStore.ts';
import { timelineStore, useTimelineStore } from '@/store/timelineStore.ts';
import { NEW_TRACK_ZONE_HEIGHT, RULER_HEIGHT, TRACK_HEIGHT } from './layout.ts';
import { NewTrackZone } from './NewTrackZone.tsx';
import { Playhead } from './Playhead.tsx';
import { SnapLine } from './SnapLine.tsx';
import { TimelineToolbar } from './TimelineToolbar.tsx';
import { TimeRuler } from './TimeRuler.tsx';
import { TrackRow } from './TrackRow.tsx';
import { useTimelineViewport } from './useTimelineViewport.ts';
import { useWheelZoom } from './useWheelZoom.ts';
import { useZoomController } from './useZoomController.ts';

/** 마지막 클립 뒤에 남겨둘 여유 공간 (뒤에 이어 붙일 자리) */
const TRAILING_SPACE = 30 * US_PER_SECOND;

export function Timeline() {
  const project = useProjectStore((state) => state.project);
  const pxPerSecond = useTimelineStore((state) => state.pxPerSecond);
  const scrollRef = useRef<HTMLDivElement>(null);

  const range = useTimelineViewport(scrollRef, pxPerSecond);
  const zoom = useZoomController(scrollRef, pxPerSecond);
  useWheelZoom(scrollRef, zoom.zoomTo);

  const tracks = sortTracksForDisplay(project.tracks);
  const labels = trackLabels(project.tracks);
  const contentDuration = projectDuration(project) + TRAILING_SPACE;
  const items = timelineItems(project);
  const assetsById = useMemo(
    () => new Map(project.assets.map((asset) => [asset.id, asset])),
    [project.assets],
  );

  // 빈 곳(눈금·트랙)을 클릭하면 그 시각으로 이동하고 선택을 해제한다. 항목 위 클릭은 항목이 처리한다.
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    // 탐색 위치도 프레임 경계로 맞춰, 그 위치에서 자른 클립 경계가 프레임 중간에 걸리지 않게 한다
    playbackEngine.seek(
      quantizeToFrame(pxToUs(event.clientX - rect.left, pxPerSecond), project.fps),
    );
    timelineStore.getState().selectItem(null);
  };

  return (
    <section
      aria-label="타임라인"
      className="col-span-3 flex min-h-0 flex-col border-t border-neutral-800"
    >
      <TimelineToolbar pxPerSecond={pxPerSecond} zoom={zoom} />
      {/* 헤더 열과 트랙이 함께 세로 스크롤되도록 같은 스크롤 컨테이너 안에 둔다 */}
      <div className="flex min-h-0 flex-1 items-start overflow-y-auto">
        <div className="sticky left-0 w-14 shrink-0 border-r border-neutral-800">
          <div className="border-b border-neutral-800" style={{ height: RULER_HEIGHT }} />
          <div className="border-b border-neutral-800" style={{ height: NEW_TRACK_ZONE_HEIGHT }} />
          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-center border-b border-neutral-800 text-xs text-neutral-400"
              style={{ height: TRACK_HEIGHT }}
            >
              {labels.get(track.id)}
            </div>
          ))}
        </div>
        <div
          ref={scrollRef}
          data-timeline-scroll
          data-testid="timeline-scroll"
          className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
        >
          <div
            data-timeline-content
            data-testid="timeline-content"
            className="relative min-w-full"
            style={{ width: usToPx(contentDuration, pxPerSecond) }}
            onPointerDown={handlePointerDown}
          >
            <TimeRuler duration={contentDuration} pxPerSecond={pxPerSecond} range={range} />
            <NewTrackZone pxPerSecond={pxPerSecond} />
            {tracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                label={labels.get(track.id) ?? ''}
                items={items.filter((item) => item.trackId === track.id)}
                assetsById={assetsById}
                pxPerSecond={pxPerSecond}
                range={range}
              />
            ))}
            <SnapLine pxPerSecond={pxPerSecond} />
            <Playhead pxPerSecond={pxPerSecond} />
          </div>
        </div>
      </div>
    </section>
  );
}

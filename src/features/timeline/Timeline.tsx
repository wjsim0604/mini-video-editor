import { clipEnd } from '@/core/clip.ts';
import { usToPx } from '@/core/timeline/coords.ts';
import { US_PER_SECOND } from '@/core/time.ts';
import { useProjectStore } from '@/store/projectStore.ts';
import { useTimelineStore } from '@/store/timelineStore.ts';
import { TimeRuler } from './TimeRuler.tsx';
import { TrackRow } from './TrackRow.tsx';

/** 마지막 클립 뒤에 남겨둘 여유 공간 (뒤에 이어 붙일 자리) */
const TRAILING_SPACE = 30 * US_PER_SECOND;

export function Timeline() {
  const project = useProjectStore((state) => state.project);
  const pxPerSecond = useTimelineStore((state) => state.pxPerSecond);

  const tracks = [...project.tracks].sort((a, b) => a.order - b.order);
  const contentEnd = project.clips.reduce((end, clip) => Math.max(end, clipEnd(clip)), 0);
  const contentDuration = contentEnd + TRAILING_SPACE;

  return (
    <section aria-label="타임라인" className="col-span-3 flex min-h-0 border-t border-neutral-800">
      <div className="w-14 shrink-0 border-r border-neutral-800">
        <div className="h-6 border-b border-neutral-800" />
        {tracks.map((track, index) => (
          <div
            key={track.id}
            className="flex h-14 items-center justify-center border-b border-neutral-800 text-xs text-neutral-400"
          >
            {trackLabel(track.kind, index)}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="min-w-full" style={{ width: usToPx(contentDuration, pxPerSecond) }}>
          <TimeRuler duration={contentDuration} pxPerSecond={pxPerSecond} />
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              label={trackLabel(track.kind, index)}
              clips={project.clips.filter((clip) => clip.trackId === track.id)}
              assets={project.assets}
              pxPerSecond={pxPerSecond}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function trackLabel(kind: 'video' | 'text' | 'audio', index: number): string {
  const prefix = { video: 'V', text: 'T', audio: 'A' }[kind];
  return `${prefix}${String(index + 1)}`;
}

import { buildSplitCommand } from '@/core/commands/splitClip.ts';
import { findSplitTargets } from '@/core/timeline/split.ts';
import { playbackStore, usePlaybackStore } from '@/store/playbackStore.ts';
import { projectStore, useProjectStore } from '@/store/projectStore.ts';
import { timelineStore, useTimelineStore } from '@/store/timelineStore.ts';

export function TimelineToolbar() {
  const project = useProjectStore((state) => state.project);
  const selectedClipId = useTimelineStore((state) => state.selectedClipId);
  // currentTime은 재생 중 매 프레임 바뀌지만, 자를 수 있는지 여부(boolean)가 바뀔 때만 리렌더된다
  const canSplit = usePlaybackStore(
    (state) => findSplitTargets(project, state.currentTime, selectedClipId).length > 0,
  );

  const handleSplit = () => {
    const { project: latest, dispatch } = projectStore.getState();
    const command = buildSplitCommand(
      latest,
      playbackStore.getState().currentTime,
      timelineStore.getState().selectedClipId,
      () => crypto.randomUUID(),
    );
    if (command) {
      dispatch(command);
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="타임라인 도구"
      className="flex h-8 shrink-0 items-center gap-1 border-b border-neutral-800 px-2"
    >
      <button
        type="button"
        title="플레이헤드 위치에서 자르기"
        disabled={!canSplit}
        className="flex h-6 items-center gap-1 rounded px-2 text-xs text-neutral-200 hover:bg-neutral-800 disabled:text-neutral-600 disabled:hover:bg-transparent"
        onClick={handleSplit}
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
    </div>
  );
}

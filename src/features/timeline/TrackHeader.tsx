import { canRemoveTrack, createRemoveTrackCommand } from '@/core/commands/removeItem.ts';
import { projectStore, useProjectStore } from '@/store/projectStore.ts';
import { TRACK_HEIGHT } from './layout.ts';

interface TrackHeaderProps {
  trackId: string;
  label: string;
}

/** 트랙 이름. 빈 트랙이면 마우스를 올렸을 때 삭제 버튼을 보여준다 (마지막 비디오 트랙 제외) */
export function TrackHeader({ trackId, label }: TrackHeaderProps) {
  const removable = useProjectStore((state) => canRemoveTrack(state.project, trackId));

  return (
    <div
      className="group relative flex items-center justify-center border-b text-xs text-muted-foreground"
      style={{ height: TRACK_HEIGHT }}
    >
      {label}
      {removable && (
        <button
          type="button"
          aria-label={`트랙 ${label} 삭제`}
          title="빈 트랙 삭제"
          className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground focus:opacity-100"
          onClick={() => {
            const { project, dispatch } = projectStore.getState();
            const command = createRemoveTrackCommand(project, trackId);
            if (command) {
              dispatch(command);
            }
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

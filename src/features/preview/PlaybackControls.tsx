import { useEffect, useRef } from 'react';
import { projectDuration } from '@/core/composition.ts';
import { formatTimecode } from '@/core/time.ts';
import { playbackStore, usePlaybackStore } from '@/store/playbackStore.ts';
import { useProjectStore } from '@/store/projectStore.ts';
import { playbackEngine } from './playback.ts';

export function PlaybackControls() {
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const duration = useProjectStore((state) => projectDuration(state.project));
  const fps = useProjectStore((state) => state.project.fps);
  const currentTimeRef = useRef<HTMLSpanElement>(null);

  // 현재 시각은 매 프레임 바뀌므로 리렌더 없이 텍스트만 갱신한다
  useEffect(() => {
    const update = (time: number) => {
      if (currentTimeRef.current) {
        currentTimeRef.current.textContent = formatTimecode(time, fps);
      }
    };
    update(playbackStore.getState().currentTime);
    return playbackStore.subscribe((state, previous) => {
      if (state.currentTime !== previous.currentTime) {
        update(state.currentTime);
      }
    });
  }, [fps]);

  return (
    <div className="flex h-10 shrink-0 items-center justify-center gap-3 border-t border-neutral-800 text-xs">
      <button
        type="button"
        aria-label={isPlaying ? '일시정지' : '재생'}
        title={isPlaying ? '일시정지 (Space)' : '재생 (Space)'}
        disabled={duration === 0}
        className="flex h-7 w-7 items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40"
        onClick={() => {
          playbackEngine.toggle();
        }}
      >
        {isPlaying ? (
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
            <rect x="3" y="2" width="3.5" height="12" />
            <rect x="9.5" y="2" width="3.5" height="12" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
            <path d="M4 2l10 6-10 6z" />
          </svg>
        )}
      </button>
      <p className="font-mono text-neutral-300 tabular-nums">
        <span ref={currentTimeRef} data-testid="current-timecode" />
        <span className="text-neutral-500"> / {formatTimecode(duration, fps)}</span>
      </p>
    </div>
  );
}

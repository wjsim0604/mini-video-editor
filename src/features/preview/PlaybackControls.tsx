import { Pause, Play } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button.tsx';
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
    <div className="flex h-11 shrink-0 items-center justify-center gap-3 border-t bg-panel text-xs">
      <Button
        size="icon-sm"
        variant="secondary"
        className="rounded-full"
        aria-label={isPlaying ? '일시정지' : '재생'}
        title={isPlaying ? '일시정지 (Space)' : '재생 (Space)'}
        disabled={duration === 0}
        onClick={() => {
          playbackEngine.toggle();
        }}
      >
        {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current" />}
      </Button>
      <p className="font-mono text-foreground tabular-nums">
        <span ref={currentTimeRef} data-testid="current-timecode" />
        <span className="text-muted-foreground"> / {formatTimecode(duration, fps)}</span>
      </p>
    </div>
  );
}

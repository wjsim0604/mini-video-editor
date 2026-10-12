import { timelineRenders } from '@/devtools/profiler.ts';
import { MediaSources } from '@/engine/media/mediaSources.ts';
import { PlaybackEngine } from '@/engine/playback/PlaybackEngine.ts';
import { PreviewRenderer } from '@/engine/render/PreviewRenderer.ts';
import { mediaStore } from '@/store/mediaStore.ts';
import { playbackStore } from '@/store/playbackStore.ts';
import { projectStore } from '@/store/projectStore.ts';

// 앱 전체에서 하나의 프리뷰 재생 세션을 사용한다. engine/은 store를 모르므로 여기서 연결한다.

export const mediaSources = new MediaSources(
  (assetId) => mediaStore.getState().entries[assetId]?.file,
);

export const previewRenderer = new PreviewRenderer(mediaSources);

export const playbackEngine = new PlaybackEngine({
  renderer: previewRenderer,
  getProject: () => projectStore.getState().project,
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => {
    cancelAnimationFrame(id);
  },
  onStateChange: (state) => {
    playbackStore.setState(state);
  },
});

projectStore.subscribe((state, previous) => {
  if (state.project !== previous.project) {
    playbackEngine.refresh();
  }
});

if (import.meta.env.DEV) {
  // 개발 중 재생 품질(늦은 프레임 수 등)을 콘솔/E2E에서 확인하기 위한 디버그 핸들
  Object.assign(window, {
    __preview: {
      stats: previewRenderer.stats,
      engine: playbackEngine,
      project: () => projectStore.getState().project,
      dispatch: projectStore.getState().dispatch,
      timelineRenders,
    },
  });
}

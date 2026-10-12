import type { Clip, Project, TextOverlay } from './project.ts';

export interface Resolution {
  width: number;
  height: number;
}

export interface ResolutionPreset extends Resolution {
  id: string;
  label: string;
}

/** 선택할 수 있는 출력 해상도. 모두 짝수라 H.264 인코더 제약(4:2:0)에 맞는다 */
export const RESOLUTION_PRESETS: readonly ResolutionPreset[] = [
  { id: '1080p', label: '16:9 · 1080p', width: 1920, height: 1080 },
  { id: '720p', label: '16:9 · 720p', width: 1280, height: 720 },
  { id: '4k', label: '16:9 · 4K', width: 3840, height: 2160 },
  { id: 'vertical', label: '9:16 · 세로', width: 1080, height: 1920 },
  { id: 'square', label: '1:1 · 정사각', width: 1080, height: 1080 },
  { id: 'portrait', label: '4:5 · 세로', width: 1080, height: 1350 },
];

export function findPreset(resolution: Resolution): ResolutionPreset | undefined {
  return RESOLUTION_PRESETS.find(
    (preset) => preset.width === resolution.width && preset.height === resolution.height,
  );
}

/**
 * 출력 해상도를 바꾸며 텍스트·클립 배치를 화면 대비 같은 자리로 옮긴다.
 * 위치는 가로·세로 각각 비례, 글자 크기는 짧은 변 비율로 바꾼다 (같은 비율이면 결과가 똑같이 보인다).
 * 클립 배율은 "화면에 꽉 맞춘 크기 대비"라 이미 해상도와 무관하므로 그대로 둔다.
 */
export function rescaleProject(project: Project, next: Resolution): Project {
  const sx = next.width / project.width;
  const sy = next.height / project.height;
  const sFont = Math.min(next.width, next.height) / Math.min(project.width, project.height);
  return {
    ...project,
    width: next.width,
    height: next.height,
    overlays: project.overlays.map((overlay): TextOverlay => ({
      ...overlay,
      style: {
        ...overlay.style,
        x: Math.round(overlay.style.x * sx),
        y: Math.round(overlay.style.y * sy),
        fontSize: Math.max(1, Math.round(overlay.style.fontSize * sFont)),
      },
    })),
    clips: project.clips.map((clip): Clip =>
      clip.transform
        ? {
            ...clip,
            transform: {
              ...clip.transform,
              x: Math.round(clip.transform.x * sx),
              y: Math.round(clip.transform.y * sy),
            },
          }
        : clip,
    ),
  };
}

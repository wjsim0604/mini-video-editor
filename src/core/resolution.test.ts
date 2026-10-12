import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Project } from './project.ts';
import { findPreset, RESOLUTION_PRESETS, rescaleProject } from './resolution.ts';

const S = 1_000_000;

function project(): Project {
  const base = createEmptyProject('p', 'test');
  return {
    ...base,
    tracks: [...base.tracks, { id: 't1', kind: 'text', order: 1 }],
    assets: [{ id: 'a', type: 'image', name: 'a.png', duration: 5 * S }],
    clips: [
      {
        id: 'moved',
        assetId: 'a',
        trackId: base.tracks[0]?.id ?? '',
        start: 0,
        inPoint: 0,
        outPoint: S,
        transform: { x: 480, y: 270, scale: 0.5 },
      },
      {
        id: 'plain',
        assetId: 'a',
        trackId: base.tracks[0]?.id ?? '',
        start: S,
        inPoint: 0,
        outPoint: S,
      },
    ],
    overlays: [
      {
        id: 'x',
        trackId: 't1',
        start: 0,
        duration: S,
        text: '자막',
        style: { fontSize: 72, color: '#ffffff', x: 960, y: 972 },
      },
    ],
  };
}

describe('RESOLUTION_PRESETS', () => {
  it('모든 크기가 짝수이고 기본 해상도(1920×1080)를 포함한다', () => {
    for (const preset of RESOLUTION_PRESETS) {
      expect(preset.width % 2).toBe(0);
      expect(preset.height % 2).toBe(0);
    }
    expect(findPreset({ width: 1920, height: 1080 })?.id).toBe('1080p');
    expect(findPreset({ width: 1000, height: 1000 })).toBeUndefined();
  });
});

describe('rescaleProject', () => {
  it('같은 비율이면 위치·글자 크기를 같은 배율로 바꾼다', () => {
    const result = rescaleProject(project(), { width: 1280, height: 720 });

    expect(result).toMatchObject({ width: 1280, height: 720 });
    expect(result.overlays[0]?.style).toMatchObject({ x: 640, y: 648, fontSize: 48 });
    expect(result.clips[0]?.transform).toEqual({ x: 320, y: 180, scale: 0.5 });
  });

  it('비율이 바뀌면 위치는 축별로, 글자 크기는 짧은 변 비율로 바꾼다', () => {
    const result = rescaleProject(project(), { width: 1080, height: 1920 });

    // 짧은 변 1080 → 1080: 글자 크기 유지, 하단 자막은 세로 화면 하단 같은 비율 자리로
    expect(result.overlays[0]?.style).toMatchObject({ x: 540, y: 1728, fontSize: 72 });
    expect(result.clips[0]?.transform).toEqual({ x: 270, y: 480, scale: 0.5 });
  });

  it('기본 배치 클립은 그대로 둔다 (새 화면에서도 가운데·꽉 맞춤)', () => {
    const result = rescaleProject(project(), { width: 1080, height: 1080 });

    expect(result.clips[1]).not.toHaveProperty('transform');
  });
});

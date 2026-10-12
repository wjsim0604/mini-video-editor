import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Project } from '../project.ts';
import {
  estimateRemainingMs,
  exportFileName,
  exportFrameCount,
  exportFrameTiming,
} from './exportPlan.ts';

function projectOf(duration: number, fps = 30): Project {
  const base = createEmptyProject('p', 'test');
  const trackId = base.tracks[0]?.id ?? '';
  return {
    ...base,
    fps,
    clips:
      duration > 0
        ? [{ id: 'c', assetId: 'a', trackId, start: 0, inPoint: 0, outPoint: duration }]
        : [],
  };
}

describe('exportFrameCount', () => {
  it('30초 30fps는 900프레임', () => {
    expect(exportFrameCount(projectOf(30_000_000))).toBe(900);
  });

  it('프레임 경계에 맞지 않는 끝은 마지막 프레임을 포함한다', () => {
    expect(exportFrameCount(projectOf(1_000_001))).toBe(31);
    expect(exportFrameCount(projectOf(33_333))).toBe(1);
  });

  it('빈 프로젝트는 0', () => {
    expect(exportFrameCount(projectOf(0))).toBe(0);
  });
});

describe('exportFrameTiming', () => {
  it('프레임 시각과 길이는 정수 μs이고 이어 붙이면 빈틈이 없다', () => {
    let end = 0;
    for (let index = 0; index < 90; index++) {
      const { time, duration } = exportFrameTiming(index, 30);
      expect(time).toBe(end);
      expect(Number.isInteger(duration)).toBe(true);
      end = time + duration;
    }
    expect(end).toBe(3_000_000);
  });
});

describe('exportFileName', () => {
  it('파일 이름에 쓸 수 없는 문자를 바꾼다', () => {
    expect(exportFileName('여행 브이로그')).toBe('여행 브이로그.mp4');
    expect(exportFileName('a/b:c*?')).toBe('a_b_c__.mp4');
    expect(exportFileName('   ')).toBe('project.mp4');
  });

  it('다른 확장자를 붙일 수 있다', () => {
    expect(exportFileName('자막', 'srt')).toBe('자막.srt');
  });
});

describe('estimateRemainingMs', () => {
  it('지금까지의 속도로 남은 시간을 계산한다', () => {
    expect(estimateRemainingMs(100, 900, 10_000)).toBe(80_000);
  });

  it('처음 몇 프레임은 추정하지 않는다', () => {
    expect(estimateRemainingMs(2, 900, 100)).toBeNull();
  });
});

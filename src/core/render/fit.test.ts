import { describe, expect, it } from 'vitest';
import { clipRect, containRect, defaultClipTransform } from './fit.ts';

describe('containRect', () => {
  it('같은 비율이면 대상 영역을 꽉 채운다', () => {
    expect(containRect(1280, 720, 1920, 1080)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it('더 넓은 원본은 위아래에 여백을 둔다 (letterbox)', () => {
    expect(containRect(2000, 500, 1000, 500)).toEqual({ x: 0, y: 125, width: 1000, height: 250 });
  });

  it('더 좁은 원본은 좌우에 여백을 둔다 (pillarbox)', () => {
    expect(containRect(800, 600, 1920, 1080)).toEqual({ x: 240, y: 0, width: 1440, height: 1080 });
  });

  it('크기가 0이면 빈 사각형', () => {
    expect(containRect(0, 600, 1920, 1080)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(containRect(800, 600, 0, 1080)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe('clipRect', () => {
  const output = { width: 1920, height: 1080 };

  it('transform이 없으면 화면 가운데에 꽉 맞춘다', () => {
    expect(clipRect({ width: 800, height: 600 }, output)).toEqual({
      x: 240,
      y: 0,
      width: 1440,
      height: 1080,
    });
  });

  it('(x, y)를 중심으로 scale 배율만큼 그린다', () => {
    expect(clipRect({ width: 800, height: 600 }, output, { x: 400, y: 300, scale: 0.5 })).toEqual({
      x: 40,
      y: 30,
      width: 720,
      height: 540,
    });
  });

  it('원본 크기를 모르면 출력 화면 전체를 기준으로 한다', () => {
    expect(clipRect(undefined, output, { x: 960, y: 540, scale: 0.5 })).toEqual({
      x: 480,
      y: 270,
      width: 960,
      height: 540,
    });
  });

  it('기본 배치는 화면 중심, 배율 1', () => {
    expect(defaultClipTransform(output)).toEqual({ x: 960, y: 540, scale: 1 });
  });
});

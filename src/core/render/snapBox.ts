import { findSnap } from '../timeline/snap.ts';
import type { Rect } from './fit.ts';

/** 축별 스냅 기준선(출력 해상도 기준 px). 정렬·중복 제거된 배열 */
export interface BoxSnapTargets {
  x: number[];
  y: number[];
}

export interface BoxSnapResult {
  /** 상자 위치에 더해야 할 보정값 */
  dx: number;
  dy: number;
  /** 붙은 기준선 (안내선 표시용). 붙지 않은 축은 null */
  guideX: number | null;
  guideY: number | null;
}

function sortedUnique(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

/** 상자의 가장자리와 중심선: [왼쪽, 가운데, 오른쪽] / [위, 가운데, 아래] */
function edgesX(box: Rect): number[] {
  return [box.x, box.x + box.width / 2, box.x + box.width];
}

function edgesY(box: Rect): number[] {
  return [box.y, box.y + box.height / 2, box.y + box.height];
}

/**
 * 프리뷰 드래그의 스냅 기준선: 화면 가장자리·중앙선 + 다른 요소(같은 시각에 보이는 텍스트)의 가장자리·중심.
 * 드래그 시작 시 한 번만 만든다.
 */
export function collectBoxSnapTargets(
  output: { width: number; height: number },
  others: readonly Rect[],
): BoxSnapTargets {
  const screen: Rect = { x: 0, y: 0, width: output.width, height: output.height };
  return {
    x: sortedUnique([screen, ...others].flatMap(edgesX)),
    y: sortedUnique([screen, ...others].flatMap(edgesY)),
  };
}

/**
 * 끌고 있는 상자의 가장자리·중심 중 기준선에 가장 가까운 것을 축마다 따로 붙인다.
 * 거리가 threshold(출력 px) 이하일 때만 붙는다.
 */
export function snapBox(box: Rect, targets: BoxSnapTargets, threshold: number): BoxSnapResult {
  const matchX = findSnap(edgesX(box), targets.x, threshold);
  const matchY = findSnap(edgesY(box), targets.y, threshold);
  return {
    dx: matchX?.delta ?? 0,
    dy: matchY?.delta ?? 0,
    guideX: matchX?.target ?? null,
    guideY: matchY?.target ?? null,
  };
}

import { describe, expect, it } from 'vitest';
import { rowAtY } from './layout.ts';

describe('rowAtY', () => {
  it('눈금과 새 트랙 영역은 새 트랙', () => {
    expect(rowAtY(0, 2)).toEqual({ kind: 'new-track' });
    expect(rowAtY(55, 2)).toEqual({ kind: 'new-track' });
  });

  it('트랙 영역은 표시 순서 index', () => {
    expect(rowAtY(56, 2)).toEqual({ kind: 'track', index: 0 });
    expect(rowAtY(111, 2)).toEqual({ kind: 'track', index: 0 });
    expect(rowAtY(112, 2)).toEqual({ kind: 'track', index: 1 });
  });

  it('마지막 트랙 아래는 마지막 트랙', () => {
    expect(rowAtY(1000, 2)).toEqual({ kind: 'track', index: 1 });
  });

  it('트랙이 없으면 새 트랙', () => {
    expect(rowAtY(100, 0)).toEqual({ kind: 'new-track' });
  });
});

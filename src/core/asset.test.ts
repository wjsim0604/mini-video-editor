import { describe, expect, it } from 'vitest';
import { detectAssetType } from './asset.ts';

describe('detectAssetType', () => {
  it.each([
    ['video/mp4', 'video'],
    ['video/webm', 'video'],
    ['video/quicktime', 'video'],
    ['image/png', 'image'],
    ['image/jpeg', 'image'],
    ['image/webp', 'image'],
  ])('%s → %s', (mimeType, expected) => {
    expect(detectAssetType(mimeType)).toBe(expected);
  });

  it.each(['audio/mpeg', 'text/plain', 'application/pdf', 'image/svg+xml', ''])(
    '%s는 지원하지 않는다',
    (mimeType) => {
      expect(detectAssetType(mimeType)).toBeNull();
    },
  );
});

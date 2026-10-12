import { describe, expect, it } from 'vitest';
import { detectCapabilities } from '@/engine/capabilities.ts';
import { describeLimitations } from './compatibility.ts';

describe('detectCapabilities', () => {
  it('전역 객체에 있는 기능을 확인한다', () => {
    expect(
      detectCapabilities({
        isSecureContext: true,
        VideoDecoder: {},
        VideoEncoder: {},
        OffscreenCanvas: {},
      }),
    ).toEqual({ secureContext: true, videoDecoding: true, videoEncoding: true });
    expect(detectCapabilities({ isSecureContext: false, VideoDecoder: {} })).toEqual({
      secureContext: false,
      videoDecoding: true,
      videoEncoding: false,
    });
  });
});

describe('describeLimitations', () => {
  it('모든 기능을 쓸 수 있으면 안내가 없다', () => {
    expect(
      describeLimitations({ secureContext: true, videoDecoding: true, videoEncoding: true }),
    ).toEqual([]);
  });

  it('보안 연결이 아니면 그것 하나만 안내한다 (다른 기능이 꺼진 원인이므로)', () => {
    const messages = describeLimitations({
      secureContext: false,
      videoDecoding: false,
      videoEncoding: false,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('HTTPS');
  });

  it('디코딩·인코딩이 없는 이유를 각각 안내한다', () => {
    expect(
      describeLimitations({ secureContext: true, videoDecoding: false, videoEncoding: false }),
    ).toEqual([
      expect.stringContaining('가져오기와 미리보기'),
      expect.stringContaining('MP4로 내보낼 수 없습니다'),
    ]);
    expect(
      describeLimitations({ secureContext: true, videoDecoding: true, videoEncoding: false }),
    ).toEqual([expect.stringContaining('MP4로 내보낼 수 없습니다')]);
  });
});

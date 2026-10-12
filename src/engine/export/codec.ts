import type { VideoCodec } from 'mediabunny';

/** 거의 모든 플레이어에서 재생되는 H.264를 우선하고, 인코더가 없으면 VP9 → AV1 */
export const PREFERRED_CODECS: VideoCodec[] = ['avc', 'vp9', 'av1'];

export const CODEC_LABEL: Record<string, string> = {
  avc: 'H.264',
  vp9: 'VP9',
  av1: 'AV1',
};

/** 이 브라우저에서 해당 해상도로 인코딩할 수 있는 첫 코덱. 없으면 null */
export async function pickExportCodec(
  width: number,
  height: number,
  frameRate: number,
): Promise<VideoCodec | null> {
  if (typeof VideoEncoder === 'undefined') {
    return null;
  }
  const { getFirstEncodableVideoCodec, QUALITY_HIGH } = await import('mediabunny');
  return getFirstEncodableVideoCodec(PREFERRED_CODECS, {
    width,
    height,
    frameRate,
    quality: QUALITY_HIGH,
  });
}

/** 코덱 지원 확인용 WebCodecs 코덱 문자열 (1080p를 다룰 수 있는 프로필) */
const CODEC_STRINGS = ['avc1.640028', 'vp09.00.40.08', 'av01.0.08M.08'];

let supportCheck: Promise<boolean> | null = null;

/**
 * 이 브라우저에서 MP4로 내보낼 수 있는지 미리 확인한다 (내보내기 버튼 활성화용).
 * 무거운 mediabunny를 불러오지 않고 WebCodecs에 직접 물어본다. 결과는 한 번만 계산한다.
 */
export function checkExportSupport(width = 1920, height = 1080): Promise<boolean> {
  supportCheck ??= (async () => {
    if (typeof VideoEncoder === 'undefined' || typeof OffscreenCanvas === 'undefined') {
      return false;
    }
    for (const codec of CODEC_STRINGS) {
      try {
        const { supported } = await VideoEncoder.isConfigSupported({
          codec,
          width,
          height,
          bitrate: 8_000_000,
        });
        if (supported) {
          return true;
        }
      } catch {
        // 이 코덱 문자열을 모르는 브라우저: 다음 코덱을 확인한다
      }
    }
    return false;
  })();
  return supportCheck;
}

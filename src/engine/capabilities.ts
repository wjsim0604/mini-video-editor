/** 이 앱이 쓰는 브라우저 기능 */
export interface BrowserCapabilities {
  /** WebCodecs 등 강력한 기능은 HTTPS·localhost(보안 컨텍스트)에서만 켜진다 */
  secureContext: boolean;
  /** 영상 가져오기·미리보기 (WebCodecs VideoDecoder) */
  videoDecoding: boolean;
  /** MP4 내보내기 (WebCodecs VideoEncoder + OffscreenCanvas) */
  videoEncoding: boolean;
}

/** 전역 객체에서 기능 존재 여부만 확인한다 (코덱 지원 여부는 checkExportSupport가 따로 확인) */
export function detectCapabilities(scope: object = globalThis): BrowserCapabilities {
  const has = (name: string) => name in scope;
  return {
    secureContext:
      'isSecureContext' in scope ? Boolean(Reflect.get(scope, 'isSecureContext')) : true,
    videoDecoding: has('VideoDecoder'),
    videoEncoding: has('VideoEncoder') && has('OffscreenCanvas'),
  };
}

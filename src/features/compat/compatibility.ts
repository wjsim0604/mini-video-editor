import type { BrowserCapabilities } from '@/engine/capabilities.ts';

export const RECOMMENDED_BROWSERS = '최신 Chrome 또는 Edge를 권장합니다.';

/** 사용할 수 없는 기능과 이유. 모두 사용할 수 있으면 빈 배열 */
export function describeLimitations(capabilities: BrowserCapabilities): string[] {
  if (!capabilities.secureContext) {
    return [
      '보안 연결(HTTPS)이 아니어서 영상 기능이 꺼져 있습니다. HTTPS 주소(또는 localhost)로 열어 주세요.',
    ];
  }
  const messages: string[] = [];
  if (!capabilities.videoDecoding) {
    messages.push(
      '이 브라우저는 영상 디코딩(WebCodecs)을 지원하지 않아 영상 가져오기와 미리보기를 할 수 없습니다. 이미지와 텍스트 편집은 사용할 수 있습니다.',
    );
  }
  if (!capabilities.videoEncoding) {
    messages.push('이 브라우저는 영상 인코딩(WebCodecs)을 지원하지 않아 MP4로 내보낼 수 없습니다.');
  }
  return messages;
}

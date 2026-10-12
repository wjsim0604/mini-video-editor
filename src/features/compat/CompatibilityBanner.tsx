import { useState } from 'react';
import { detectCapabilities, type BrowserCapabilities } from '@/engine/capabilities.ts';
import { describeLimitations, RECOMMENDED_BROWSERS } from './compatibility.ts';

const detected = detectCapabilities();

/** 이 브라우저에서 쓸 수 없는 기능을 상단에 안내한다. 닫으면 이번 세션 동안 숨긴다 */
export function CompatibilityBanner({
  capabilities = detected,
}: {
  capabilities?: BrowserCapabilities;
}) {
  const [dismissed, setDismissed] = useState(false);
  const messages = describeLimitations(capabilities);
  if (dismissed || messages.length === 0) {
    return null;
  }
  return (
    <div
      role="alert"
      aria-label="브라우저 호환성 안내"
      className="flex items-start gap-3 border-b border-amber-800 bg-amber-950/70 px-4 py-2 text-xs text-amber-100"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
        <p className="text-amber-300">{RECOMMENDED_BROWSERS}</p>
      </div>
      <button
        type="button"
        aria-label="호환성 안내 닫기"
        className="px-1 text-amber-300 hover:text-amber-100"
        onClick={() => {
          setDismissed(true);
        }}
      >
        ×
      </button>
    </div>
  );
}

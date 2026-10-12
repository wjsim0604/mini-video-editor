import { TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';
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
    <div className="border-b px-4 py-2">
      <Alert variant="warning" aria-label="브라우저 호환성 안내" className="relative pr-12">
        <TriangleAlert />
        <AlertTitle>이 브라우저에서는 일부 기능을 쓸 수 없습니다</AlertTitle>
        <AlertDescription>
          {messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
          <p className="text-muted-foreground">{RECOMMENDED_BROWSERS}</p>
        </AlertDescription>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="호환성 안내 닫기"
          className="absolute top-2.5 right-2.5"
          onClick={() => {
            setDismissed(true);
          }}
        >
          <X />
        </Button>
      </Alert>
    </div>
  );
}

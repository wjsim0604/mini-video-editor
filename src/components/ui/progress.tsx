'use client';

import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import { Progress as ProgressPrimitive } from 'radix-ui';

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      // 편집기 수정: 원본은 value를 Root에 넘기지 않아 aria-valuenow가 빠진다 (보조기기가 진행률을 읽지 못함)
      value={value}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${String(100 - (value ?? 0))}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };

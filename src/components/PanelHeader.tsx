import type { ReactNode } from 'react';

/** 패널 상단 제목 줄. 오른쪽에 동작 버튼을 둘 수 있다 */
export function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

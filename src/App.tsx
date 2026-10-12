import { Profiler } from 'react';
import { onTimelineRender } from '@/devtools/profiler.ts';
import { AssetPanel } from '@/features/assets/AssetPanel.tsx';
import { PreviewPanel } from '@/features/preview/PreviewPanel.tsx';
import { Timeline } from '@/features/timeline/Timeline.tsx';

function App() {
  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex h-12 items-center border-b border-neutral-800 px-4">
        <h1 className="text-sm font-semibold">Mini Video Editor</h1>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-[240px_1fr_240px] grid-rows-[1fr_240px]">
        <AssetPanel />
        <PreviewPanel />
        <section aria-label="인스펙터" className="border-l border-neutral-800" />
        <Profiler id="timeline" onRender={onTimelineRender}>
          <Timeline />
        </Profiler>
      </main>
    </div>
  );
}

export default App;

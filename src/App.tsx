import { Profiler } from 'react';
import { onTimelineRender } from '@/devtools/profiler.ts';
import { AssetPanel } from '@/features/assets/AssetPanel.tsx';
import { CompatibilityBanner } from '@/features/compat/CompatibilityBanner.tsx';
import { ExportButton } from '@/features/export/ExportButton.tsx';
import { ExportDialog } from '@/features/export/ExportDialog.tsx';
import { useExportState } from '@/features/export/exportStore.ts';
import { HistoryControls } from '@/features/history/HistoryControls.tsx';
import { useSelectionCleanup } from '@/features/history/useSelectionCleanup.ts';
import { NewProjectButton } from '@/features/persistence/NewProjectButton.tsx';
import { SaveStatusIndicator } from '@/features/persistence/SaveStatusIndicator.tsx';
import { InspectorPanel } from '@/features/inspector/InspectorPanel.tsx';
import { PreviewPanel } from '@/features/preview/PreviewPanel.tsx';
import { useGlobalShortcuts } from '@/features/shortcuts/useGlobalShortcuts.ts';
import { Timeline } from '@/features/timeline/Timeline.tsx';

function App() {
  useGlobalShortcuts();
  useSelectionCleanup();
  // 내보내기 창이 떠 있으면 뒤의 편집기는 클릭·포커스·보조기기 접근을 모두 막는다
  const isDialogOpen = useExportState().status !== 'idle';

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <div className="flex min-h-0 flex-1 flex-col" inert={isDialogOpen}>
        <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-4">
          <h1 className="text-sm font-semibold">Mini Video Editor</h1>
          <div className="flex items-center gap-3">
            <SaveStatusIndicator />
            <NewProjectButton />
            <HistoryControls />
            <ExportButton />
          </div>
        </header>
        <CompatibilityBanner />
        <main className="grid min-h-0 flex-1 grid-cols-[240px_1fr_240px] grid-rows-[1fr_240px]">
          <AssetPanel />
          <PreviewPanel />
          <InspectorPanel />
          <Profiler id="timeline" onRender={onTimelineRender}>
            <Timeline />
          </Profiler>
        </main>
      </div>
      <ExportDialog />
    </div>
  );
}

export default App;
